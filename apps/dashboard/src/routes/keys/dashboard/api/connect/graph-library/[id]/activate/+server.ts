/**
 * Graph Library — switch the workspace's active graph. Activating hydrates the
 * live routing config (domain pack, ingest selection, stop-after-stage) from the
 * graph's saved bundle so retrieval, ingest, and the MCP orchestrator follow.
 */
import { json } from "@sveltejs/kit";
import {
  setActiveGraphTarget,
  listGraphTargetsForUi,
} from "$lib/server/connect/graph-target-service";
import {
  isKnowledgeSessionFailure,
  resolveKnowledgeSessionContext,
} from "$lib/server/connect/session-context";
import type { RequestHandler } from "./$types";

export const POST: RequestHandler = async ({ locals, params }) => {
  const ctx = await resolveKnowledgeSessionContext(locals);
  if (isKnowledgeSessionFailure(ctx)) {
    return json({ error: ctx.error, message: ctx.message }, { status: ctx.status });
  }
  const result = await setActiveGraphTarget(ctx.workspaceId, params.id);
  if (!result.ok) {
    return json({ error: result.error, message: "Graph not found." }, { status: result.status });
  }
  const graphs = await listGraphTargetsForUi(ctx.workspaceId);
  return json({ ok: true, graphs });
};
