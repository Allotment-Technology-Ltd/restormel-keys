/**
 * Evidence Dossier endpoints (W2.2) for a single graph claim.
 *
 * GET  — the full dossier: verification state, bound span located in source
 *        context, judgment audit trail, claim-version ledger.
 * POST — operator actions:
 *        { action: "recheck" }            deterministic Layer-1 re-check
 *                                         (verifyEvidenceSpan — no model keys),
 *        { action: "accept" }             → supported, guarded: bound spans only
 *                                         (claims ledger row 2),
 *        { action: "exclude", note? }     reversible soft-exclude (never hard-delete).
 */
import { json } from "@sveltejs/kit";
import { z } from "zod";
import {
  acceptConnectUnitAsSupported,
  excludeConnectUnit,
  loadConnectEvidenceDossier,
  recheckConnectUnitEvidence,
} from "$lib/server/connect/evidence-dossier-service";
import {
  isKnowledgeSessionFailure,
  resolveKnowledgeSessionContext,
} from "$lib/server/connect/session-context";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ locals, params, url }) => {
  const ctx = await resolveKnowledgeSessionContext(locals, { includeProjects: false });
  if (isKnowledgeSessionFailure(ctx)) {
    return json({ error: ctx.error, message: ctx.message }, { status: ctx.status });
  }

  const unitId = decodeURIComponent(params.unitId ?? "").trim();
  if (!unitId) {
    return json({ error: "invalid_request", message: "Claim id is required." }, { status: 400 });
  }

  const result = await loadConnectEvidenceDossier({
    workspaceId: ctx.workspaceId,
    unitId,
    domainPackId: url.searchParams.get("domain_pack_id")?.trim() || null,
  });
  if (!result.ok) {
    return json({ error: "dossier_failed", message: result.message }, { status: result.status });
  }
  return json({ ok: true, dossier: result.dossier });
};

const ActionSchema = z.object({
  action: z.enum(["recheck", "accept", "exclude"]),
  note: z.string().max(500).nullable().optional(),
  domain_pack_id: z.string().uuid().nullable().optional(),
});

export const POST: RequestHandler = async ({ locals, params, request }) => {
  const ctx = await resolveKnowledgeSessionContext(locals, { includeProjects: false });
  if (isKnowledgeSessionFailure(ctx)) {
    return json({ error: ctx.error, message: ctx.message }, { status: ctx.status });
  }

  const unitId = decodeURIComponent(params.unitId ?? "").trim();
  if (!unitId) {
    return json({ error: "invalid_request", message: "Claim id is required." }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid_json", message: "Request body must be JSON." }, { status: 400 });
  }
  const parsed = ActionSchema.safeParse(body);
  if (!parsed.success) {
    return json(
      { error: "invalid_request", message: parsed.error.issues.map((i) => i.message).join("; ") },
      { status: 400 },
    );
  }

  const domainPackId = parsed.data.domain_pack_id ?? null;
  const actor = `operator:${ctx.userId}`;

  if (parsed.data.action === "recheck") {
    const result = await recheckConnectUnitEvidence({
      workspaceId: ctx.workspaceId,
      unitId,
      domainPackId,
    });
    if (!result.ok) {
      return json({ error: "recheck_failed", message: result.message }, { status: result.status });
    }
    return json({ ok: true, action: "recheck", outcome: result.outcome });
  }

  const result =
    parsed.data.action === "accept"
      ? await acceptConnectUnitAsSupported({
          workspaceId: ctx.workspaceId,
          unitId,
          domainPackId,
          actor,
        })
      : await excludeConnectUnit({
          workspaceId: ctx.workspaceId,
          unitId,
          domainPackId,
          actor,
          note: parsed.data.note ?? null,
        });

  if (!result.ok) {
    return json({ error: "action_failed", message: result.message }, { status: result.status });
  }
  return json({
    ok: true,
    action: parsed.data.action,
    unit_id: unitId,
    verification_state: result.verificationState,
    ...(result.validationStatus ? { validation_status: result.validationStatus } : {}),
  });
};
