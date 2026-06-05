/**
 * Bounded discourse-relation preview for graph cluster detail.
 */
import { json } from "@sveltejs/kit";
import { z } from "zod";
import { loadGraphRelationPreview } from "$lib/server/connect/graph-cluster-relations";
import {
  isKnowledgeSessionFailure,
  resolveKnowledgeSessionContext,
} from "$lib/server/connect/session-context";
import type { RequestHandler } from "./$types";

const BodySchema = z.object({
  unit_ids: z.array(z.string().min(1).max(256)).max(80),
  domain_pack_id: z.string().uuid().nullable().optional(),
  limit: z.number().int().min(1).max(24).optional(),
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

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return json(
      { error: "invalid_request", message: parsed.error.issues.map((i) => i.message).join("; ") },
      { status: 400 },
    );
  }

  const result = await loadGraphRelationPreview({
    workspaceId: ctx.workspaceId,
    unitIds: parsed.data.unit_ids,
    limit: parsed.data.limit,
    domainPackId: parsed.data.domain_pack_id ?? null,
  });

  if (!result.ok) {
    return json({ error: "preview_failed", message: result.message }, { status: result.status });
  }

  return json({
    ok: true,
    relations: result.relations,
    truncated: result.truncated,
  });
};
