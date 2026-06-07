/**
 * Bundled graph tool options — one round-trip for Tools tab (revalidate, link, embed, audit).
 */
import { json } from "@sveltejs/kit";
import { loadGraphEmbedBackfillOptions } from "$lib/server/connect/graph-embed-backfill-options";
import { loadGraphProvenanceAudit } from "$lib/server/connect/graph-provenance-audit";
import { loadGraphRevalidateOptions } from "$lib/server/connect/graph-revalidate-options";
import { loadGraphSourceLinkOptions } from "$lib/server/connect/graph-source-link-options";
import {
  isKnowledgeSessionFailure,
  resolveKnowledgeSessionContext,
} from "$lib/server/connect/session-context";
import { getConnectGraphTargetForWorkspace } from "$lib/server/neon";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ locals }) => {
  const ctx = await resolveKnowledgeSessionContext(locals);
  if (isKnowledgeSessionFailure(ctx)) {
    return json({ error: ctx.error, message: ctx.message }, { status: ctx.status });
  }

  const target = await getConnectGraphTargetForWorkspace(ctx.workspaceId).catch(() => null);
  const surreal = target?.provider === "surreal";

  const [linkSources, embedBackfill, revalidate, provenanceAudit] = await Promise.all([
    loadGraphSourceLinkOptions(ctx.workspaceId),
    loadGraphEmbedBackfillOptions(ctx.workspaceId, ctx.userId),
    loadGraphRevalidateOptions(ctx.workspaceId, ctx.userId),
    surreal ? loadGraphProvenanceAudit(ctx.workspaceId) : Promise.resolve(null),
  ]);

  return json({ linkSources, embedBackfill, revalidate, provenanceAudit });
};
