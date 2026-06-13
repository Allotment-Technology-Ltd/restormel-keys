/**
 * POST /connect/v1/testing/verdicts — persist a testing run verdict (CI / CLI)
 * GET  /connect/v1/testing/verdicts — list the Testing hub timeline for a workspace
 *
 * Auth: Gateway key (rk_… — same as all other v1 routes).
 * W3.8 — docs/design/dashboard-world-class-roadmap.md §Stage W3.8
 */
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import {
  handlePostTestingVerdict,
  handleListTestingVerdicts,
} from "$lib/server/connect-v1/testing-verdict-handler";

export const POST: RequestHandler = async ({ request, url, locals }) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid_json" }, { status: 400 });
  }
  const workspaceId = url.searchParams.get("workspace_id");
  const projectId = url.searchParams.get("project_id") ?? undefined;
  const outcome = await handlePostTestingVerdict({ locals, workspaceId, projectId, body });
  return json(outcome.body, { status: outcome.status });
};

export const GET: RequestHandler = async ({ url, locals }) => {
  const workspaceId = url.searchParams.get("workspace_id");
  const projectId = url.searchParams.get("project_id") ?? undefined;
  const limitRaw = url.searchParams.get("limit");
  const limit = limitRaw !== null ? parseInt(limitRaw, 10) : null;
  const beforeId = url.searchParams.get("before_id");
  const outcome = await handleListTestingVerdicts({
    locals,
    workspaceId,
    projectId,
    limit: Number.isFinite(limit) ? limit : null,
    beforeId,
  });
  return json(outcome.body, { status: outcome.status });
};
