/**
 * Options for automated graph source linking (deferred from SSR).
 */
import { json } from "@sveltejs/kit";
import { loadGraphSourceLinkOptions } from "$lib/server/connect/graph-source-link-options";
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

  const linkSources = await loadGraphSourceLinkOptions(ctx.workspaceId);
  return json({ linkSources });
};
