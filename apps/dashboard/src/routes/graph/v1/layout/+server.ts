/**
 * POST /graph/v1/layout — compute Contract v0 orbital layout (Phase 2).
 */
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { computeGraphLayoutFromBody } from "$lib/server/graph-v1-layout";

export const POST: RequestHandler = async ({ request }) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid_json" }, { status: 400 });
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
