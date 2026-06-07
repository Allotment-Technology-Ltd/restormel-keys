/**
 * POST /connect/v1/retrieve
 */
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { handleKnowledgeRetrieve } from "$lib/server/connect-v1/retrieve-handler";

function requestId(request: Request): string {
  return request.headers.get("x-request-id")?.trim() || crypto.randomUUID();
}

/**
 * Deprecation signalling (RFC 8594 / draft-deprecation-header). This endpoint is
 * superseded by POST /connect/v1/graph (RetrievalOrchestrator). Sunset is set to
 * six months from the unification date (2026-06-07).
 */
const DEPRECATION_HEADERS = {
  Deprecation: "true",
  Sunset: "Mon, 07 Dec 2026 00:00:00 GMT",
  Link: '</connect/v1/graph>; rel="successor-version"',
} as const;

export const POST: RequestHandler = async ({ request, locals }) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid_json" }, { status: 400, headers: { ...DEPRECATION_HEADERS } });
  }

  const id = requestId(request);
  const outcome = await handleKnowledgeRetrieve({ locals, body, requestId: id });
  if (!outcome.ok) {
    return json(outcome.body, { status: outcome.status, headers: { ...DEPRECATION_HEADERS } });
  }
  return json(outcome.body, {
    status: 200,
    headers: { "X-Request-Id": id, ...DEPRECATION_HEADERS },
  });
};
