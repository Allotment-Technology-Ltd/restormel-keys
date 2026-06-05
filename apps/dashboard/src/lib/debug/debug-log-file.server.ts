import { appendFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/** NDJSON log for homepage 500 investigation — dev only. */
export const DEBUG_SESSION_ID = "3ca71a";

const LOG_DIR = join(dirname(fileURLToPath(import.meta.url)), "../../../.dev");
const LOG_PATH = join(LOG_DIR, `client-debug-${DEBUG_SESSION_ID}.ndjson`);

export type DebugLogEntry = {
  sessionId: string;
  channel: "server" | "client" | "client-api";
  location: string;
  message: string;
  data?: Record<string, unknown>;
  hypothesisId?: string;
  runId?: string;
  timestamp: number;
};

/** Append one NDJSON line (server-side; no secrets). */
export function appendDebugLog(entry: DebugLogEntry): void {
  if (!import.meta.env.DEV) return;
  try {
    mkdirSync(LOG_DIR, { recursive: true });
    appendFileSync(LOG_PATH, `${JSON.stringify(entry)}\n`, "utf8");
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[debug-log-file] append failed:", msg.slice(0, 120));
  }
}

export function debugLogPath(): string {
  return LOG_PATH;
}
