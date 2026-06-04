/**
 * Operator validation review for a single graph unit (Postgres spine or Surreal BYO).
 */
import { json } from "@sveltejs/kit";
import { z } from "zod";
import {
  isUnitValidationStatus,
  removeConnectUnitFromGraph,
  updateConnectUnitValidation,
} from "$lib/server/connect/graph-review-service";
import {
  isKnowledgeSessionFailure,
  resolveKnowledgeSessionContext,
} from "$lib/server/connect/session-context";
import type { RequestHandler } from "./$types";

const PatchSchema = z.object({
  status: z.string().min(1).max(32),
  note: z.string().max(500).nullable().optional(),
  domain_pack_id: z.string().uuid().nullable().optional(),
});

export const PATCH: RequestHandler = async ({ locals, params, request }) => {
  const ctx = await resolveKnowledgeSessionContext(locals);
  if (isKnowledgeSessionFailure(ctx)) {
    return json({ error: ctx.error, message: ctx.message }, { status: ctx.status });
  }

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

  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return json(
      { error: "invalid_request", message: parsed.error.issues.map((i) => i.message).join("; ") },
      { status: 400 },
    );
  }

  if (!isUnitValidationStatus(parsed.data.status)) {
    return json(
      { error: "invalid_status", message: "Status must be ok, weak, or unsupported." },
      { status: 400 },
    );
  }

  const result = await updateConnectUnitValidation({
    workspaceId: ctx.workspaceId,
    unitId,
    status: parsed.data.status,
    note: parsed.data.note ?? null,
    domainPackId: parsed.data.domain_pack_id ?? null,
  });

  if (!result.ok) {
    return json({ error: "update_failed", message: result.message }, { status: result.status });
  }

  return json({ ok: true, unit_id: unitId, status: parsed.data.status, note: parsed.data.note ?? null });
};

export const DELETE: RequestHandler = async ({ locals, params }) => {
  const ctx = await resolveKnowledgeSessionContext(locals);
  if (isKnowledgeSessionFailure(ctx)) {
    return json({ error: ctx.error, message: ctx.message }, { status: ctx.status });
  }

  const unitId = decodeURIComponent(params.unitId ?? "").trim();
  if (!unitId) {
    return json({ error: "invalid_request", message: "Unit id is required." }, { status: 400 });
  }

  const result = await removeConnectUnitFromGraph({
    workspaceId: ctx.workspaceId,
    unitId,
  });

  if (!result.ok) {
    return json({ error: "delete_failed", message: result.message }, { status: result.status });
  }

  return json({ ok: true, unit_id: unitId, removed: true });
};
