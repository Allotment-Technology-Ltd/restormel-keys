/**
 * POST /connect/v1/retrieve
 */
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { handleKnowledgeRetrieve } from "$lib/server/connect-v1/retrieve-handler";

function requestId(request: Request): string {
  return request.headers.get("x-request-id")?.trim() || crypto.randomUUID();
}

export const POST: RequestHandler = async ({ request, locals }) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid_json" }, { status: 400 });
  }

  const id = requestId(request);
  const outcome = await handleKnowledgeRetrieve({ locals, body, requestId: id });
  if (!outcome.ok) {
    return json(outcome.body, { status: outcome.status });
  }
  return json(outcome.body, {
    status: 200,
    headers: { "X-Request-Id": id },
  });
};
