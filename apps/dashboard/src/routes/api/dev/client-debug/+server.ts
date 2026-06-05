// Use import.meta.env.DEV instead of $app/environment to avoid SSR issues
// where $app/environment might not be available in certain contexts.
const dev = import.meta.env.DEV;
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { appendDebugLog, DEBUG_SESSION_ID } from "$lib/debug/debug-log-file.server";

type Payload = {
  sessionId?: string;
  channel?: string;
  location?: string;
  message?: string;
  data?: Record<string, unknown>;
  hypothesisId?: string;
  runId?: string;
  timestamp?: number;
};

/** Dev-only sink: persists client diagnostics to NDJSON on disk for agent/user inspection. */
export const POST: RequestHandler = async ({ request }) => {
  if (!dev) {
    return json({ error: "not_available" }, { status: 404 });
  }

  let body: Payload;
  try {
    body = (await request.json()) as Payload;
  } catch {
    return json({ error: "invalid_json" }, { status: 400 });
  }

  const location = String(body.location ?? "unknown").slice(0, 200);
  const message = String(body.message ?? "").slice(0, 500);

  appendDebugLog({
    sessionId: body.sessionId === DEBUG_SESSION_ID ? DEBUG_SESSION_ID : DEBUG_SESSION_ID,
    channel: "client-api",
    location,
    message,
    data: sanitizeData(body.data),
    hypothesisId: body.hypothesisId?.slice(0, 20),
    runId: body.runId?.slice(0, 40),
    timestamp: typeof body.timestamp === "number" ? body.timestamp : Date.now(),
  });

  return new Response(null, { status: 204 });
};

function sanitizeData(data: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  if (!data) return undefined;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) {
    if (/key|token|secret|password|authorization/i.test(k)) continue;
    const val =
      typeof v === "string"
        ? v.slice(0, 4000)
        : v && typeof v === "object"
          ? JSON.parse(JSON.stringify(v).slice(0, 8000))
          : v;
    out[k] = val;
  }
  return out;
}
