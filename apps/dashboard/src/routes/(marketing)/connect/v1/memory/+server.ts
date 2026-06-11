/**
 * POST /connect/v1/memory — agent observation write path (Stage 3.4).
 * Auth + rate limit + the EBV quality gate live in the handler/service; this route
 * only parses JSON (with a hard body-size ceiling) and shapes the HTTP response.
 */
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { handleConnectMemoryWrite } from "$lib/server/connect-v1/memory-handler";

function requestId(request: Request): string {
  return request.headers.get("x-request-id")?.trim() || crypto.randomUUID();
}

/**
 * Hard request-body ceiling. The contract already caps a max-size payload well below
 * this (10 observations × ≤10KB evidence each ≈ 110KB); anything bigger is rejected
 * before JSON parsing ever allocates it.
 */
const MAX_BODY_BYTES = 256 * 1024;

export const POST: RequestHandler = async ({ request, locals }) => {
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return json(
      { error: "payload_too_large", message: `Request body exceeds ${MAX_BODY_BYTES} bytes` },
      { status: 413 },
    );
  }

  let raw: string;
  try {
    raw = await request.text();
  } catch {
    return json({ error: "invalid_body" }, { status: 400 });
  }
  if (raw.length > MAX_BODY_BYTES) {
    return json(
      { error: "payload_too_large", message: `Request body exceeds ${MAX_BODY_BYTES} bytes` },
      { status: 413 },
    );
  }

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return json({ error: "invalid_json" }, { status: 400 });
  }

  const id = requestId(request);
  const outcome = await handleConnectMemoryWrite({ locals, body, requestId: id });
  if (!outcome.ok) {
    const headers: Record<string, string> = { "X-Request-Id": id };
    if (outcome.retryAfterSeconds) headers["Retry-After"] = String(outcome.retryAfterSeconds);
    return json(outcome.body, { status: outcome.status, headers });
  }
  return json(outcome.body, { status: 200, headers: { "X-Request-Id": id } });
};
