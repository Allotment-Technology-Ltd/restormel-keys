/**
 * Configuration — reads, validates and types the server's environment.
 *
 * All knobs come from RESTORMEL_* env vars (see .env.example). `loadConfig`
 * collects validation problems rather than throwing on the first one, so the
 * health check can report every misconfiguration in a single startup message.
 */
import type { GraphStoreCredentials, VerificationCategory } from "@restormel/graphrag-core";

export type GraphStoreType = "surrealdb" | "neo4j";
export type LogLevel = "debug" | "info" | "warn" | "error";
export type Transport = "stdio" | "http";

/** Parsed credentials, compatible with graphrag-core's GraphStoreCredentials. */
export type GraphStoreCreds = GraphStoreCredentials;

export interface ServerConfig {
  graphStoreType: GraphStoreType;
  graphStoreUrl: string;
  graphStoreCreds: GraphStoreCreds;
  workspaceId: string;
  defaultVerification: VerificationCategory[];
  maxTokens: number;
  logLevel: LogLevel;
  transport: Transport;
  port: number;
}

export interface ConfigLoadResult {
  config?: ServerConfig;
  errors: string[];
}

const VERIFICATION_CATEGORIES: VerificationCategory[] = ["supported", "weak", "unsupported"];
const LOG_LEVELS: LogLevel[] = ["debug", "info", "warn", "error"];

function envStr(name: string): string | undefined {
  const v = process.env[name];
  if (v === undefined) return undefined;
  const trimmed = v.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function parseVerification(raw: string | undefined, errors: string[]): VerificationCategory[] {
  if (!raw) return ["supported"];
  const parts = raw
    .split(",")
    .map((p) => p.trim().toLowerCase())
    .filter(Boolean);
  const out: VerificationCategory[] = [];
  for (const part of parts) {
    if ((VERIFICATION_CATEGORIES as string[]).includes(part)) {
      if (!out.includes(part as VerificationCategory)) out.push(part as VerificationCategory);
    } else {
      errors.push(
        `RESTORMEL_DEFAULT_VERIFICATION contains unknown category "${part}". Allowed: ${VERIFICATION_CATEGORIES.join(", ")}.`,
      );
    }
  }
  return out.length > 0 ? out : ["supported"];
}

function parseCreds(raw: string | undefined, errors: string[]): GraphStoreCreds {
  if (!raw) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    errors.push(
      "RESTORMEL_GRAPH_STORE_CREDS must be valid JSON, e.g. {\"username\":\"root\",\"password\":\"root\"}.",
    );
    return {};
  }
  if (typeof parsed !== "object" || parsed === null) {
    errors.push("RESTORMEL_GRAPH_STORE_CREDS must be a JSON object.");
    return {};
  }
  const obj = parsed as Record<string, unknown>;
  const username = obj.username ?? obj.user;
  const password = obj.password;
  return {
    ...(typeof username === "string" ? { username } : {}),
    ...(typeof password === "string" ? { password } : {}),
  };
}

function parsePositiveInt(
  raw: string | undefined,
  fallback: number,
  name: string,
  errors: string[],
): number {
  if (!raw) return fallback;
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) {
    errors.push(`${name} must be a positive integer (got "${raw}").`);
    return fallback;
  }
  return n;
}

/** Read and validate the environment into a typed config plus a list of problems. */
export function loadConfig(): ConfigLoadResult {
  const errors: string[] = [];

  const typeRaw = (envStr("RESTORMEL_GRAPH_STORE_TYPE") ?? "surrealdb").toLowerCase();
  let graphStoreType: GraphStoreType = "surrealdb";
  if (typeRaw === "surrealdb" || typeRaw === "neo4j") {
    graphStoreType = typeRaw;
  } else {
    errors.push(`RESTORMEL_GRAPH_STORE_TYPE must be surrealdb or neo4j (got "${typeRaw}").`);
  }

  const graphStoreUrl = envStr("RESTORMEL_GRAPH_STORE_URL");
  if (!graphStoreUrl) {
    errors.push("RESTORMEL_GRAPH_STORE_URL is required.");
  }

  const workspaceId = envStr("RESTORMEL_WORKSPACE_ID");
  if (!workspaceId) {
    errors.push("RESTORMEL_WORKSPACE_ID is required.");
  }

  const graphStoreCreds = parseCreds(envStr("RESTORMEL_GRAPH_STORE_CREDS"), errors);
  const defaultVerification = parseVerification(envStr("RESTORMEL_DEFAULT_VERIFICATION"), errors);
  const maxTokens = parsePositiveInt(envStr("RESTORMEL_MAX_TOKENS"), 2000, "RESTORMEL_MAX_TOKENS", errors);

  const logLevelRaw = (envStr("RESTORMEL_LOG_LEVEL") ?? "info").toLowerCase();
  let logLevel: LogLevel = "info";
  if ((LOG_LEVELS as string[]).includes(logLevelRaw)) {
    logLevel = logLevelRaw as LogLevel;
  } else {
    errors.push(`RESTORMEL_LOG_LEVEL must be one of ${LOG_LEVELS.join(", ")} (got "${logLevelRaw}").`);
  }

  const transportRaw = (envStr("RESTORMEL_TRANSPORT") ?? "stdio").toLowerCase();
  let transport: Transport = "stdio";
  if (transportRaw === "stdio" || transportRaw === "http") {
    transport = transportRaw;
  } else {
    errors.push(`RESTORMEL_TRANSPORT must be stdio or http (got "${transportRaw}").`);
  }

  const port = parsePositiveInt(envStr("RESTORMEL_PORT"), 3000, "RESTORMEL_PORT", errors);

  if (errors.length > 0) return { errors };

  return {
    errors: [],
    config: {
      graphStoreType,
      graphStoreUrl: graphStoreUrl as string,
      graphStoreCreds,
      workspaceId: workspaceId as string,
      defaultVerification,
      maxTokens,
      logLevel,
      transport,
      port,
    },
  };
}
