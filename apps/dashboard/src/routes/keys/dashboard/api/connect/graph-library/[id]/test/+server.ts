/**
 * Graph Library — run a connectivity check against one saved graph and persist
 * the resulting status (so the library card reflects ok/error/untested).
 */
import { json } from "@sveltejs/kit";
import {
  testGraphTargetConnection,
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
  const test = await testGraphTargetConnection(ctx.workspaceId, params.id);
  const graphs = await listGraphTargetsForUi(ctx.workspaceId);
  return json({ test, graphs });
};
