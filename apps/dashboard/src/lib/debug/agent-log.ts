import { reportClientDebug } from "$lib/debug/client-debug";

/**
 * Client-safe debug log. Do not import node:fs here — shared by Svelte components.
 * Server hooks should use `agentLogServer` from `agent-log.server.ts`.
 *
 * Note: We use typeof window to check for browser environment instead of $app/environment
 * to avoid SSR issues where $app/environment might not be available.
 *
 * Buffers to sessionStorage (via reportClientDebug) for in-browser inspection. The legacy
 * "Cursor debug ingest" — a hardcoded `fetch` to `http://127.0.0.1:7415/ingest/...` — was
 * removed: it shipped in the client bundle and fired `ERR_CONNECTION_REFUSED` on every page
 * for any browser without that local sink (i.e. all real users). No replacement needed.
 */
export function agentLog(
  location: string,
  message: string,
  data: Record<string, unknown>,
  hypothesisId: string,
  runId = "pre-fix"
): void {
  if (typeof window === "undefined") return;
  reportClientDebug(location, message, data, hypothesisId, runId);
}
