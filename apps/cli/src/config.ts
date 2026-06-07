/**
 * config — global CLI configuration resolved from three layers, lowest to
 * highest precedence: ~/.restormel/config.json, RESTORMEL_* env vars, and
 * explicit command-line flags. Commands receive a fully resolved
 * {@link ResolvedConfig} so they never read process.env or the disk directly.
 */
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

export type OutputFormat = "pretty" | "json" | "markdown";

/** Shape persisted to ~/.restormel/config.json. */
export interface StoredConfig {
  workspace?: string;
  apiKey?: string;
  graphStore?: string;
  apiBase?: string;
}

/** Flags shared by every command (commander parses these on the root program). */
export interface GlobalFlags {
  workspace?: string;
  apiKey?: string;
  graphStore?: string;
  output?: OutputFormat;
  quiet?: boolean;
}

/** Fully resolved config handed to commands. */
export interface ResolvedConfig {
  workspace?: string;
  apiKey?: string;
  graphStore?: string;
  apiBase: string;
  output: OutputFormat;
  quiet: boolean;
  /** Graph store credentials parsed from RESTORMEL_GRAPH_STORE_CREDS. */
  graphStoreCreds: { username?: string; password?: string };
  graphStoreType: "surrealdb" | "neo4j";
}

const DEFAULT_API_BASE = "https://api.restormel.dev";

export function configDir(): string {
  return path.join(os.homedir(), ".restormel");
}

export function configPath(): string {
  return path.join(configDir(), "config.json");
}

/** Read ~/.restormel/config.json, tolerating a missing or malformed file. */
export function readStoredConfig(): StoredConfig {
  try {
    const raw = fs.readFileSync(configPath(), "utf8");
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed === "object" && parsed !== null) return parsed as StoredConfig;
    return {};
  } catch {
    return {};
  }
}

/** Write ~/.restormel/config.json with 0600 perms (it may hold an API key). */
export function writeStoredConfig(config: StoredConfig): void {
  const dir = configDir();
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(configPath(), JSON.stringify(config, null, 2) + "\n", { mode: 0o600 });
}

function envStr(name: string): string | undefined {
  const v = process.env[name];
  if (v === undefined) return undefined;
  const trimmed = v.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function parseCreds(raw: string | undefined): { username?: string; password?: string } {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const username = parsed.username ?? parsed.user;
    const password = parsed.password;
    return {
      ...(typeof username === "string" ? { username } : {}),
      ...(typeof password === "string" ? { password } : {}),
    };
  } catch {
    return {};
  }
}

/** Merge stored config, env vars and flags into a single resolved config. */
export function resolveConfig(flags: GlobalFlags): ResolvedConfig {
  const stored = readStoredConfig();

  const output: OutputFormat = flags.output ?? "pretty";
  const typeRaw = (envStr("RESTORMEL_GRAPH_STORE_TYPE") ?? "surrealdb").toLowerCase();
  const graphStoreType = typeRaw === "neo4j" ? "neo4j" : "surrealdb";

  return {
    workspace: flags.workspace ?? envStr("RESTORMEL_WORKSPACE_ID") ?? stored.workspace,
    apiKey: flags.apiKey ?? envStr("RESTORMEL_API_KEY") ?? stored.apiKey,
    graphStore: flags.graphStore ?? envStr("RESTORMEL_GRAPH_STORE_URL") ?? stored.graphStore,
    apiBase: envStr("RESTORMEL_API_BASE") ?? stored.apiBase ?? DEFAULT_API_BASE,
    output,
    quiet: flags.quiet ?? false,
    graphStoreCreds: parseCreds(envStr("RESTORMEL_GRAPH_STORE_CREDS")),
    graphStoreType,
  };
}
