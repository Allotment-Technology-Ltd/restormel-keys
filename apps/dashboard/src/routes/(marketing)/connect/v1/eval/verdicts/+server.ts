/**
 * POST /connect/v1/eval/verdicts — persist an eval verdict (CLI / CI action)
 * GET  /connect/v1/eval/verdicts — list quality-history timeline for a workspace
 *
 * Auth: Gateway key (rk_… — same as all other Knowledge v1 routes).
 * Stage 2.4 — docs/product/verified-context-pivot-roadmap.md §Stage 2.4
 */
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import {
  handlePostEvalVerdict,
  handleListEvalVerdicts,
} from "$lib/server/connect-v1/eval-history-handler";

export const POST: RequestHandler = async ({ request, url, locals }) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid_json" }, { status: 400 });
  }
  const workspaceId = url.searchParams.get("workspace_id");
  const projectId = url.searchParams.get("project_id") ?? undefined;
  const outcome = await handlePostEvalVerdict({ locals, workspaceId, projectId, body });
  return json(outcome.body, { status: outcome.status });
};

export const GET: RequestHandler = async ({ url, locals }) => {
  const workspaceId = url.searchParams.get("workspace_id");
  const projectId = url.searchParams.get("project_id") ?? undefined;
  const limitRaw = url.searchParams.get("limit");
  const limit = limitRaw !== null ? parseInt(limitRaw, 10) : null;
  const beforeId = url.searchParams.get("before_id");
  const outcome = await handleListEvalVerdicts({
    locals,
    workspaceId,
    projectId,
    limit: Number.isFinite(limit) ? limit : null,
    beforeId,
  });
  return json(outcome.body, { status: outcome.status });
};
