/**
 * `keys replay [traceId | traceFile]` — deterministically reproduce a past retrieval (Stage 4D).
 *
 * Fetches a ProvenanceTrace (by id from the API, or from a local JSON file), re-runs the same
 * query against the current graph with the same verification policy / depth / token budget, and
 * reports what is STABLE, CHANGED, or NEW. Depends on Stage 4B (provenance trace export).
 */
import type { Command } from "commander";
import chalk from "chalk";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  ProvenanceTraceSchema,
  type ProvenanceTrace,
} from "@restormel/contracts/provenance-trace";
import type { ConnectGraphOpResponse } from "@restormel/contracts/connect";
import {
  buildReplayRequest,
  computeReplayDiff,
  currentClaimsFromResponse,
  originalClaimsFromTrace,
} from "../replay-diff.js";
import { renderReplay } from "../replay-format.js";

interface ReplayOptions {
  diff?: boolean;
  compare?: boolean;
  output?: string;
  workspace?: string;
  project?: string;
  siteBase?: string;
}

function fail(message: string, detail?: unknown): void {
  console.error(chalk.red(message), detail !== undefined ? detail : "");
  process.exitCode = 1;
}

function resolveSiteBase(opt?: string): string {
  const env = process.env.RESTORMEL_KEYS_BASE?.trim() || process.env.RESTORMEL_CONNECT_API_BASE?.trim();
  return (opt?.trim() || env || "https://restormel.dev").replace(/\/$/, "");
}

/** Treat the argument as a file when it points at an existing file or has a .json suffix. */
function looksLikeFile(ref: string): boolean {
  if (ref.endsWith(".json")) return true;
  if (ref.startsWith(".") || ref.startsWith("/") || ref.includes("/") || ref.includes("\\")) return true;
  return existsSync(resolve(process.cwd(), ref));
}

async function loadTraceFromFile(ref: string): Promise<ProvenanceTrace | null> {
  const abs = resolve(process.cwd(), ref);
  if (!existsSync(abs)) {
    fail(`Trace file not found: ${abs}`);
    return null;
  }
  let raw: string;
  try {
    raw = await readFile(abs, "utf-8");
  } catch (e) {
    fail("Could not read trace file:", e instanceof Error ? e.message : e);
    return null;
  }
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    fail(`Trace file is not valid JSON: ${abs}`);
    return null;
  }
  const parsed = ProvenanceTraceSchema.safeParse(json);
  if (!parsed.success) {
    fail("Trace file is not a valid ProvenanceTrace:", parsed.error.issues.map((i) => i.message).join("; "));
    return null;
  }
  return parsed.data;
}

async function loadTraceFromApi(args: {
  traceId: string;
  base: string;
  gatewayKey: string;
  workspaceId: string;
  projectId?: string;
}): Promise<ProvenanceTrace | null> {
  const params = new URLSearchParams({ workspace_id: args.workspaceId });
  if (args.projectId) params.set("project_id", args.projectId);
  const url = `${args.base}/connect/v1/traces/${encodeURIComponent(args.traceId)}?${params}`;

  let res: Response;
  try {
    res = await fetch(url, { headers: { Authorization: `Bearer ${args.gatewayKey}` } });
  } catch (e) {
    fail(`Could not reach ${url}`, e instanceof Error ? e.message : e);
    return null;
  }

  if (res.status === 404) {
    fail(
      `Trace ${args.traceId} not found. Traces are retained for 90 days. If this trace is older, ` +
        `use a locally saved trace file: keys replay ./trace.json`,
    );
    return null;
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    fail(`Could not fetch trace (${res.status}):`, body.message ?? body.error ?? res.statusText);
    return null;
  }

  const json = (await res.json().catch(() => null)) as unknown;
  const parsed = ProvenanceTraceSchema.safeParse(json);
  if (!parsed.success) {
    fail("API returned a trace that failed validation:", parsed.error.issues.map((i) => i.message).join("; "));
    return null;
  }
  return parsed.data;
}

async function runFreshQuery(args: {
  trace: ProvenanceTrace;
  base: string;
  gatewayKey: string;
  workspaceId: string;
  projectId?: string;
}): Promise<ConnectGraphOpResponse | null> {
  const request = buildReplayRequest(args.trace, { workspaceId: args.workspaceId, projectId: args.projectId });
  let res: Response;
  try {
    res = await fetch(`${args.base}/connect/v1/graph`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${args.gatewayKey}` },
      body: JSON.stringify(request),
    });
  } catch (e) {
    fail(`Could not reach ${args.base}/connect/v1/graph`, e instanceof Error ? e.message : e);
    return null;
  }
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    fail(`Replay query failed (${res.status}):`, json.message ?? json.error ?? res.statusText);
    return null;
  }
  return json as unknown as ConnectGraphOpResponse;
}

export function registerReplay(program: Command): void {
  program
    .command("replay")
    .argument("<traceRef>", "trace id (UUID from the API) or a path to a saved ProvenanceTrace .json file")
    .description("Replay a past retrieval query against the current graph and diff the results")
    .option("--diff", "show the full per-claim STABLE / CHANGED / NEW breakdown")
    .option("--compare", "list the original and current claim sets side by side")
    .option("--output <format>", "json | pretty | markdown", "pretty")
    .option("--workspace <id>", "Keys workspace id (default RESTORMEL_WORKSPACE_ID or the trace's workspace)")
    .option("--project <id>", "Keys project id (default RESTORMEL_PROJECT_ID)")
    .option("--site-base <url>", "Restormel site origin (default RESTORMEL_KEYS_BASE or https://restormel.dev)")
    .action(async (traceRef: string, opts: ReplayOptions) => {
      const format = (opts.output ?? "pretty").toLowerCase();
      if (!["pretty", "json", "markdown"].includes(format)) {
        fail(`Unknown --output ${opts.output}. Use pretty, json, or markdown.`);
        return;
      }

      const base = resolveSiteBase(opts.siteBase);
      const gatewayKey = process.env.RESTORMEL_GATEWAY_KEY?.trim();
      const envWorkspace = opts.workspace?.trim() || process.env.RESTORMEL_WORKSPACE_ID?.trim();
      const projectId = opts.project?.trim() || process.env.RESTORMEL_PROJECT_ID?.trim() || undefined;

      // Load the trace (file or API).
      let trace: ProvenanceTrace | null;
      if (looksLikeFile(traceRef)) {
        trace = await loadTraceFromFile(traceRef);
      } else {
        if (!gatewayKey) {
          fail("RESTORMEL_GATEWAY_KEY is required to fetch a trace by id (run `keys login`).");
          return;
        }
        if (!envWorkspace) {
          fail("A workspace is required to fetch a trace by id. Set RESTORMEL_WORKSPACE_ID or pass --workspace.");
          return;
        }
        trace = await loadTraceFromApi({ traceId: traceRef, base, gatewayKey, workspaceId: envWorkspace, projectId });
      }
      if (!trace) return;

      // Re-running the query always needs API access; default workspace to the trace's own.
      const workspaceId = envWorkspace || trace.workspace_id;
      if (!gatewayKey) {
        fail("RESTORMEL_GATEWAY_KEY is required to replay the query (run `keys login`).");
        return;
      }
      if (!workspaceId) {
        fail("A workspace is required to replay. Set RESTORMEL_WORKSPACE_ID or pass --workspace.");
        return;
      }

      const response = await runFreshQuery({ trace, base, gatewayKey, workspaceId, projectId });
      if (!response) return;

      const original = originalClaimsFromTrace(trace);
      const current = currentClaimsFromResponse(response);
      const diff = computeReplayDiff(original, current);

      const out = renderReplay(
        { trace, diff, replayedAt: new Date().toISOString(), original, current },
        format as "pretty" | "json" | "markdown",
        { detailed: Boolean(opts.diff), compare: Boolean(opts.compare) },
      );
      console.log(out);
    });
}
