/**
 * Dry-run extraction preview (session-scoped). Returns units/relations/warnings;
 * never writes to a store.
 */
import { json } from "@sveltejs/kit";
import { z } from "zod";
import { previewExtraction } from "$lib/server/connect/extraction-preview";
import {
  isKnowledgeSessionFailure,
  resolveKnowledgeSessionContext,
} from "$lib/server/connect/session-context";
import type { RequestHandler } from "./$types";

const PreviewSchema = z.object({
  domain_pack_id: z.string().uuid().optional(),
  document_ids: z.array(z.string().uuid()).max(20).optional(),
  text: z.string().max(20000).optional(),
});

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
  const parsed = PreviewSchema.safeParse(body);
  if (!parsed.success) {
    return json(
      { error: "invalid_request", message: parsed.error.issues.map((i) => i.message).join("; ") },
      { status: 400 },
    );
  }
  const result = await previewExtraction({
    workspaceId: ctx.workspaceId,
    userId: ctx.userId,
    packId: parsed.data.domain_pack_id,
    documentIds: parsed.data.document_ids,
    text: parsed.data.text,
  });
  if (!result.ok) {
    return json({ error: result.error, message: result.message }, { status: result.status });
  }
  return json({
    result: result.result,
    pack: result.pack,
    sampled_from: result.sampled_from,
    chunks_previewed: result.chunks_previewed,
  });
};
