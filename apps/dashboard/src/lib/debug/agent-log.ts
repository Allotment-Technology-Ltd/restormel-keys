import { reportClientDebug } from "$lib/debug/client-debug";

const DEBUG_SESSION_ID = "3ca71a";

/** Legacy Cursor debug ingest (best-effort). */
const LEGACY_INGEST = "http://127.0.0.1:7415/ingest/4d73a77a-e2c7-48aa-ae41-73a13b42405f";

/**
 * Client-safe debug log. Do not import node:fs here — shared by Svelte components.
 * Server hooks should use `agentLogServer` from `agent-log.server.ts`.
 *
 * Note: We use typeof window to check for browser environment instead of $app/environment
 * to avoid SSR issues where $app/environment might not be available.
 */
export function agentLog(
  location: string,
  message: string,
  data: Record<string, unknown>,
  hypothesisId: string,
  runId = "pre-fix"
): void {
  if (typeof window === "undefined") return;
  const timestamp = Date.now();
  reportClientDebug(location, message, data, hypothesisId, runId);
  fetch(LEGACY_INGEST, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Debug-Session-Id": DEBUG_SESSION_ID },
    body: JSON.stringify({
      sessionId: DEBUG_SESSION_ID,
      location,
      message,
      data,
      hypothesisId,
      runId,
      timestamp,
    }),
  }).catch(() => {});
}
