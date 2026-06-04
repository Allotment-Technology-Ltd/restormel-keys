/**
 * Delete a source document (session-scoped).
 */
import { json } from "@sveltejs/kit";
import { removeSourceDocument } from "$lib/server/connect/source-documents";
import {
  isKnowledgeSessionFailure,
  resolveKnowledgeSessionContext,
} from "$lib/server/connect/session-context";
import type { RequestHandler } from "./$types";

export const DELETE: RequestHandler = async ({ locals, params }) => {
  const ctx = await resolveKnowledgeSessionContext(locals);
  if (isKnowledgeSessionFailure(ctx)) {
    return json({ error: ctx.error, message: ctx.message }, { status: ctx.status });
  }
  const deleted = await removeSourceDocument(ctx.workspaceId, params.docId);
  if (!deleted) {
    return json({ error: "not_found", message: "Document not found." }, { status: 404 });
  }
  return json({ deleted: true });
};
