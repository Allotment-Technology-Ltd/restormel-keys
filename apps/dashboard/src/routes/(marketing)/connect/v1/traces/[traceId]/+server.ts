/**
 * GET /connect/v1/traces/{traceId} — fetch a stored provenance trace (ProvenanceTrace).
 */
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { handleGetProvenanceTrace } from "$lib/server/connect-v1/trace-handler";

export const GET: RequestHandler = async ({ params, url, locals }) => {
  const workspaceId = url.searchParams.get("workspace_id");
  const projectId = url.searchParams.get("project_id") ?? undefined;
  const outcome = await handleGetProvenanceTrace({
    locals,
    traceId: params.traceId,
    workspaceId,
    projectId,
  });
  if (!outcome.ok) {
    return json(outcome.body, { status: outcome.status });
  }
  return json(outcome.trace, { status: 200 });
};
