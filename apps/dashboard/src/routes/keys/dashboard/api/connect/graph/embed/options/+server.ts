/**
 * Lazy embed-backfill options for graph explorer Tools panel.
 */
import { json } from "@sveltejs/kit";
import { loadGraphEmbedBackfillOptions } from "$lib/server/connect/graph-embed-backfill-options";
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

  const embedBackfill = await loadGraphEmbedBackfillOptions(ctx.workspaceId, ctx.userId);
  return json({ embedBackfill });
};
