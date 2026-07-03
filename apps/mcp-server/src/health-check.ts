/**
 * health-check — startup validation. Run a strict sequence of checks before the
 * server accepts traffic. Any failure logs a human-readable explanation to
 * stderr and exits the process (no silent degraded starts).
 */
import type { GraphStoreAdapter, GraphStoreConnectionConfig } from "@restormel/graphrag-core";
import type { ServerConfig } from "./config.js";
import { loadConfig } from "./config.js";
import { buildGraphRuntime, type GraphRuntime } from "./graph-store.js";
import { logError, logInfo } from "./logger.js";

export interface StartupResult {
  config: ServerConfig;
  runtime: GraphRuntime;
}

function fail(reason: string, fixes: string[]): never {
  logError(`Startup failed: ${reason}`);
  for (const fix of fixes) logError(`  → ${fix}`);
  process.exit(1);
}

/** Build the connection config the adapter records on connect(). */
function connectionConfig(config: ServerConfig): GraphStoreConnectionConfig {
  return {
    type: config.graphStoreType,
    schemaMode: "fresh",
    credentials: config.graphStoreCreds,
    connectionString: config.graphStoreUrl,
  };
}

/** Probe whether the workspace has ingested content (proxy for "domain pack configured"). */
async function workspaceHasContent(adapter: GraphStoreAdapter): Promise<boolean> {
  try {
    const stats = await adapter.getWorkspaceStats();
    return (stats.nodeCount ?? 0) > 0;
  } catch {
    return false;
  }
}

/**
 * Validate env, connect to the graph store, and confirm the workspace is usable.
 * Returns the loaded config + built runtime on success; exits the process otherwise.
 */
export async function runStartup(): Promise<StartupResult> {
  // 1. Required env vars present + well-formed.
  const { config, errors } = loadConfig();
  if (!config) {
    fail("invalid configuration", errors.length > 0 ? errors : ["See .env.example for the required variables."]);
  }

  logInfo(
    `Configured: type=${config.graphStoreType} workspace=${config.workspaceId} ` +
      `verification=[${config.defaultVerification.join(",")}] transport=${config.transport}`,
  );

  const runtime = buildGraphRuntime(config);

  // 2. Graph store connection reachable.
  try {
    await runtime.adapter.connect(connectionConfig(config));
  } catch (err) {
    fail(`could not initialise the ${config.graphStoreType} adapter: ${err instanceof Error ? err.message : String(err)}`, [
      "Check RESTORMEL_GRAPH_STORE_URL and RESTORMEL_GRAPH_STORE_CREDS.",
    ]);
  }

  const health = await runtime.adapter.healthCheck();
  if (!health.ok) {
    fail(`graph store health check failed: ${health.error ?? "unknown error"}`, [
      `Verify RESTORMEL_GRAPH_STORE_URL (${config.graphStoreUrl}) is reachable.`,
      "Verify RESTORMEL_GRAPH_STORE_CREDS are correct (JSON with username/password).",
      "Confirm the graph store is running and accepting connections.",
    ]);
  }
  logInfo(`Graph store reachable (${health.latencyMs ?? "?"}ms).`);

  // 3. Workspace has content / domain pack configured (warn-then-fail).
  const hasContent = await workspaceHasContent(runtime.adapter);
  if (!hasContent) {
    fail(`workspace "${config.workspaceId}" has no graph content (empty or no domain pack configured)`, [
      "Ingest a domain pack into this workspace before serving retrieval.",
      "Confirm RESTORMEL_WORKSPACE_ID points at a populated workspace.",
    ]);
  }
  logInfo("Workspace has graph content.");

  return { config, runtime };
}
