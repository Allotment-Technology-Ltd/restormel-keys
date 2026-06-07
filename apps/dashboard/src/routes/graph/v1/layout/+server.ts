/**
 * POST /graph/v1/layout — compute Contract v0 orbital layout (Phase 2).
 * Auth: gateway key, management key, or session (I4).
 */
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { computeGraphLayoutFromBody } from "$lib/server/graph-v1-layout";

function isAuthenticated(locals: App.Locals): boolean {
  return Boolean(locals.user);
}

export const POST: RequestHandler = async ({ request, locals }) => {
  if (!isAuthenticated(locals)) {
    return json(
      { error: "unauthorized", message: "Gateway key, management key, or session required" },
      { status: 401 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid_json", message: "Request body must be valid JSON" }, { status: 400 });
  }

  const outcome = computeGraphLayoutFromBody(body);
  if ("error" in outcome && !("layout" in outcome)) {
    return json(
      { error: outcome.error, message: outcome.message },
      { status: outcome.status }
    );
  }

  return json(outcome);
};
