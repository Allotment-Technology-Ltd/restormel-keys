/**
 * Fast graph-native provenance audit (Surreal aggregates — not a full idea scan).
 */
import { json } from "@sveltejs/kit";
import { loadGraphProvenanceAudit } from "$lib/server/connect/graph-provenance-audit";
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

  const provenanceAudit = await loadGraphProvenanceAudit(ctx.workspaceId);
  return json({ provenanceAudit });
};
