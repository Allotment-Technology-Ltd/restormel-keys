/**
 * Lazy validation-route options for graph explorer (deferred from SSR).
 */
import { json } from "@sveltejs/kit";
import { loadGraphRevalidateOptions } from "$lib/server/connect/graph-revalidate-options";
import {
  isKnowledgeSessionFailure,
  resolveKnowledgeSessionContext,
} from "$lib/server/connect/session-context";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ locals }) => {
  const ctx = await resolveKnowledgeSessionContext(locals);
  if (isKnowledgeSessionFailure(ctx)) {
    return json({ error: ctx.error, message: ctx.message }, { status: ctx.status });
  }

  const revalidate = await loadGraphRevalidateOptions(ctx.workspaceId, ctx.userId);
  return json({ revalidate });
};
