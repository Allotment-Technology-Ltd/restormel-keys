/**
 * Graph Designer: propose a Domain Pack draft from intent + sample documents.
 * Returns a draft for review/edit — does NOT save it (the operator saves via
 * POST /domain-packs after editing).
 */
import { json } from "@sveltejs/kit";
import { z } from "zod";
import { draftDomainPackFromIntent } from "$lib/server/connect/designer";
import {
  isKnowledgeSessionFailure,
  resolveKnowledgeSessionContext,
} from "$lib/server/connect/session-context";
import type { RequestHandler } from "./$types";

const DesignSchema = z.object({
  intent: z.string().min(8).max(4000),
  domain_name: z.string().min(1).max(120).optional(),
  document_ids: z.array(z.string().uuid()).max(50).optional(),
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
  const parsed = DesignSchema.safeParse(body);
  if (!parsed.success) {
    return json(
      { error: "invalid_request", message: parsed.error.issues.map((i) => i.message).join("; ") },
      { status: 400 },
    );
  }
  const result = await draftDomainPackFromIntent({
    workspaceId: ctx.workspaceId,
    userId: ctx.userId,
    intent: parsed.data.intent,
    domainName: parsed.data.domain_name,
    documentIds: parsed.data.document_ids,
  });
  if (!result.ok) {
    return json({ error: result.error, message: result.message }, { status: result.status });
  }
  return json({ draft: result.draft, rationale: result.rationale, sampled: result.sampled });
};
