/**
 * Persist which parsed source documents are included in the next ingest run.
 * null / omitted ids = all parsed documents (legacy default).
 */
import { json } from "@sveltejs/kit";
import { z } from "zod";
import {
  getIngestDocumentSelection,
  setIngestDocumentSelection,
} from "$lib/server/connect/domain-pack-service";
import { listSourceDocuments } from "$lib/server/connect/source-documents";
import {
  isKnowledgeSessionFailure,
  resolveKnowledgeSessionContext,
} from "$lib/server/connect/session-context";
import type { RequestHandler } from "./$types";

const PutSchema = z.object({
  document_ids: z.array(z.string().uuid()).max(200).nullable(),
});

export const GET: RequestHandler = async ({ locals }) => {
  const ctx = await resolveKnowledgeSessionContext(locals);
  if (isKnowledgeSessionFailure(ctx)) {
    return json({ error: ctx.error, message: ctx.message }, { status: ctx.status });
  }
  const selection = await getIngestDocumentSelection(ctx.workspaceId);
  const documents = await listSourceDocuments(ctx.workspaceId);
  const parsedIds = documents.filter((d) => d.status === "parsed").map((d) => d.id);
  const effective =
    selection === null ? parsedIds : selection.filter((id) => parsedIds.includes(id));
  return json({
    document_ids: selection,
    effective_document_ids: effective,
    parsed_count: parsedIds.length,
  });
};

export const PUT: RequestHandler = async ({ locals, request }) => {
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

  const parsed = PutSchema.safeParse(body);
  if (!parsed.success) {
    return json(
      { error: "invalid_request", message: parsed.error.issues.map((i) => i.message).join("; ") },
      { status: 400 },
    );
  }

  const documents = await listSourceDocuments(ctx.workspaceId);
  const parsedIds = new Set(documents.filter((d) => d.status === "parsed").map((d) => d.id));

  if (parsed.data.document_ids !== null) {
    const invalid = parsed.data.document_ids.filter((id) => !parsedIds.has(id));
    if (invalid.length > 0) {
      return json(
        {
          error: "invalid_documents",
          message: "One or more document ids are missing or not parsed yet.",
        },
        { status: 400 },
      );
    }
  }

  await setIngestDocumentSelection(ctx.workspaceId, parsed.data.document_ids);
  const selection = await getIngestDocumentSelection(ctx.workspaceId);
  const effective =
    selection === null
      ? [...parsedIds]
      : selection.filter((id) => parsedIds.has(id));

  return json({
    document_ids: selection,
    effective_document_ids: effective,
    parsed_count: parsedIds.size,
  });
};
