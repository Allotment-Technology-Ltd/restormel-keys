/**
 * Pre-check a URL or text upload for provenance metadata before full parse/import.
 */
import { json } from "@sveltejs/kit";
import { ConnectSourceDocumentPreviewRequestSchema } from "@restormel/contracts/connect";
import { previewSourceDocument } from "$lib/server/connect/source-document-preview";
import {
  isKnowledgeSessionFailure,
  resolveKnowledgeSessionContext,
} from "$lib/server/connect/session-context";
import type { RequestHandler } from "./$types";

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

  const parsed = ConnectSourceDocumentPreviewRequestSchema.safeParse(body);
  if (!parsed.success) {
    return json(
      { error: "invalid_request", message: parsed.error.issues.map((i) => i.message).join("; ") },
      { status: 400 },
    );
  }

  const result = await previewSourceDocument(parsed.data);
  if (!result.ok) {
    return json({ error: "preview_failed", message: result.message }, { status: 400 });
  }

  return json(result);
};
