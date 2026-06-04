/**
 * Session-scoped source documents: list and add (URL fetch or inline upload).
 * Documents are parsed with the pluggable parser and stored normalized for reuse.
 */
import { json } from "@sveltejs/kit";
import { ConnectSourceDocumentCreateSchema } from "@restormel/contracts/connect";
import { addSourceDocument, listSourceDocuments } from "$lib/server/connect/source-documents";
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
  const documents = await listSourceDocuments(ctx.workspaceId);
  return json({ documents });
};

export const POST: RequestHandler = async ({ locals, request }) => {
  const ctx = await resolveKnowledgeSessionContext(locals);
  if (isKnowledgeSessionFailure(ctx)) {
    return json({ error: ctx.error, message: ctx.message }, { status: ctx.status });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid_json", message: "Request body must be JSON." }, { status: 400 });
  }
  const parsed = ConnectSourceDocumentCreateSchema.safeParse(body);
  if (!parsed.success) {
    return json(
      { error: "invalid_request", message: parsed.error.issues.map((i) => i.message).join("; ") },
      { status: 400 },
    );
  }
  const document = await addSourceDocument(ctx.workspaceId, parsed.data);
  return json({ document }, { status: 201 });
};
