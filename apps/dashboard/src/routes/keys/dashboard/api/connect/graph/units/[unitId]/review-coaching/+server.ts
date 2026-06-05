/**
 * On-demand LLM review coaching for a single graph unit (operator expander).
 */
import { json } from "@sveltejs/kit";
import { z } from "zod";
import { loadGraphReviewCoaching } from "$lib/server/connect/graph-review-coaching-service";
import {
  isKnowledgeSessionFailure,
  resolveKnowledgeSessionContext,
} from "$lib/server/connect/session-context";
import type { RequestHandler } from "./$types";

const UnitBodySchema = z.object({
  text: z.string().min(1).max(20_000),
  validation_status: z.string().max(32).nullable().optional(),
  validation_note: z.string().max(2000).nullable().optional(),
  unit_type: z.string().max(120).nullable().optional(),
  source_title: z.string().max(500).nullable().optional(),
  source_url: z.string().max(2000).nullable().optional(),
  source_kind: z.string().max(120).nullable().optional(),
  domain_pack_id: z.string().uuid().nullable().optional(),
});

async function handleReviewCoaching(args: {
  locals: App.Locals;
  unitId: string;
  domainPackId: string | null;
  unit: z.infer<typeof UnitBodySchema> | null;
}) {
  const ctx = await resolveKnowledgeSessionContext(args.locals);
  if (isKnowledgeSessionFailure(ctx)) {
    return json({ error: ctx.error, message: ctx.message }, { status: ctx.status });
  }

  const result = await loadGraphReviewCoaching({
    workspaceId: ctx.workspaceId,
    userId: ctx.userId,
    unitId: args.unitId,
    domainPackId: args.domainPackId ?? args.unit?.domain_pack_id ?? null,
    unit: args.unit
      ? {
          text: args.unit.text,
          validationStatus: args.unit.validation_status ?? null,
          validationNote: args.unit.validation_note ?? null,
          unitType: args.unit.unit_type ?? null,
          sourceTitle: args.unit.source_title ?? null,
          sourceUrl: args.unit.source_url ?? null,
          sourceKind: args.unit.source_kind ?? null,
        }
      : null,
  });

  if (!result.ok) {
    return json(
      {
        error: "coaching_failed",
        message: result.message,
        ...(result.coaching ? { coaching: result.coaching } : {}),
      },
      { status: result.status },
    );
  }

  return json({ ok: true, coaching: result.coaching });
}

export const GET: RequestHandler = async ({ locals, params, url }) => {
  const unitId = decodeURIComponent(params.unitId ?? "").trim();
  if (!unitId) {
    return json({ error: "invalid_request", message: "Unit id is required." }, { status: 400 });
  }

  const domainPackId = url.searchParams.get("domain_pack_id")?.trim() || null;
  return handleReviewCoaching({ locals, unitId, domainPackId, unit: null });
};

export const POST: RequestHandler = async ({ locals, params, request }) => {
  const unitId = decodeURIComponent(params.unitId ?? "").trim();
  if (!unitId) {
    return json({ error: "invalid_request", message: "Unit id is required." }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid_json", message: "Request body must be JSON." }, { status: 400 });
  }

  const parsed = UnitBodySchema.safeParse(body);
  if (!parsed.success) {
    return json(
      { error: "invalid_request", message: parsed.error.issues.map((i) => i.message).join("; ") },
      { status: 400 },
    );
  }

  return handleReviewCoaching({
    locals,
    unitId,
    domainPackId: parsed.data.domain_pack_id ?? null,
    unit: parsed.data,
  });
};
