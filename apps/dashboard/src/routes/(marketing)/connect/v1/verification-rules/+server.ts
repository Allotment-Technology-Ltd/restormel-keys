/**
 * GET /connect/v1/verification-rules — the active verification rule set for a workspace.
 */
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { handleGetActiveVerificationRules } from "$lib/server/connect-v1/verification-rules-handler";

export const GET: RequestHandler = async ({ url, locals }) => {
  const workspaceId = url.searchParams.get("workspace_id");
  const projectId = url.searchParams.get("project_id") ?? undefined;
  const outcome = await handleGetActiveVerificationRules({ locals, workspaceId, projectId });
  if (!outcome.ok) {
    return json(outcome.body, { status: outcome.status });
  }
  return json(outcome.ruleSet, { status: 200 });
};
