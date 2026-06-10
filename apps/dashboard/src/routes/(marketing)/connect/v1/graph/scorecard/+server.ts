/**
 * GET /connect/v1/graph/scorecard — per-graph trust scorecard (ConnectTrustScorecardResponse).
 */
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { handleGetTrustScorecard } from "$lib/server/connect-v1/trust-scorecard-handler";

export const GET: RequestHandler = async ({ url, locals }) => {
  const workspaceId = url.searchParams.get("workspace_id");
  const projectId = url.searchParams.get("project_id") ?? undefined;
  const outcome = await handleGetTrustScorecard({ locals, workspaceId, projectId });
  return json(outcome.body, { status: outcome.status });
};
