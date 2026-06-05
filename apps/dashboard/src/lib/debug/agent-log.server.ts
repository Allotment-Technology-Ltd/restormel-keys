import { appendDebugLog, DEBUG_SESSION_ID } from "$lib/debug/debug-log-file.server";

/** Server-only debug log (NDJSON on disk). */
export function agentLogServer(
  location: string,
  message: string,
  data: Record<string, unknown>,
  hypothesisId: string,
  runId = "pre-fix"
): void {
  appendDebugLog({
    sessionId: DEBUG_SESSION_ID,
    channel: "server",
    location,
    message,
    data,
    hypothesisId,
    runId,
    timestamp: Date.now(),
  });
}
