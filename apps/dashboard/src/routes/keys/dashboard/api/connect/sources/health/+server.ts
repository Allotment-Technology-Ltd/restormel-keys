/**
 * Phase 3 Stage 3 — watched-sources health BFF.
 *
 * Read-only, session-scoped roll-up of the workspace's source documents and ingest
 * runs into health cards + an exceptions queue. No mutations live here: the queue's
 * actions reuse the existing endpoints (failed run → /ingest/jobs/[id]/restart,
 * failed document → /sources/documents/[docId] DELETE), so this surface adds no new
 * write path or authz seam.
 */
import { json } from "@sveltejs/kit";
import {
  isKnowledgeSessionFailure,
  resolveKnowledgeSessionContext,
} from "$lib/server/connect/session-context";
import { loadSourceHealthSummary } from "$lib/server/connect/source-health";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ locals }) => {
  const ctx = await resolveKnowledgeSessionContext(locals, { includeProjects: false });
  if (isKnowledgeSessionFailure(ctx)) {
    return json({ error: ctx.error, message: ctx.message }, { status: ctx.status });
  }
  const summary = await loadSourceHealthSummary(ctx.workspaceId);
  return json(summary);
};
