import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

let cachedVersion: string | undefined;

function readPackageVersion(): string {
  if (cachedVersion !== undefined) return cachedVersion;
  try {
    const here = dirname(fileURLToPath(import.meta.url));
    const raw = readFileSync(join(here, "../package.json"), "utf8");
    const v = JSON.parse(raw) as { version?: string };
    cachedVersion = typeof v.version === "string" ? v.version : "unknown";
  } catch {
    cachedVersion = "unknown";
  }
  return cachedVersion;
}

export const SERVER_VERSION = readPackageVersion();

export type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_RANK: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

function minLevel(): LogLevel {
  const raw = (process.env.RESTORMEL_RUNS_LOG_LEVEL ?? "info").toLowerCase().trim();
  if (raw === "debug" || raw === "info" || raw === "warn" || raw === "error") return raw;
  return "info";
}

export type LogFields = Record<string, string | number | boolean | null | undefined>;

/**
 * One JSON object per line on **stderr** (safe for log aggregators; keeps stdout clean).
 */
export function logStructured(level: LogLevel, event: string, fields: LogFields): void {
  if (LEVEL_RANK[level] < LEVEL_RANK[minLevel()]) return;
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    event,
    service: "restormel-testing-runs-server",
    version: SERVER_VERSION,
    ...fields,
  });
  if (level === "error") console.error(line);
  else console.error(line);
}
