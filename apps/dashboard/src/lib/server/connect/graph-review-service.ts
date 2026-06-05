/**
 * Operator review of ingested graph units — update validation after AI pass.
 */
import type { ConnectDomainPack } from "@restormel/contracts/connect";
import { formatHumanReviewNote } from "$lib/connect/validation-status";
import { domainPackRecordToApi } from "$lib/server/connect/domain-pack-service";
import { surrealRecordRef } from "$lib/server/connect/graph-writer";
import { buildWorkspaceGraphStore } from "$lib/server/connect/surreal-graph-store";
import {
  extractAiFlagReason,
  recordReviewSignal,
} from "$lib/server/connect/review-signal-service";
import {
  getConnectDomainPackById,
  getConnectGraphTargetForWorkspace,
  getConnectGraphUnitForReview,
  getConnectReviewSignalContext,
  deleteUnitPostgres,
  updateUnitValidationPostgres,
} from "$lib/server/neon";

export const UNIT_VALIDATION_STATUSES = ["ok", "weak", "unsupported"] as const;
export type UnitValidationStatus = (typeof UNIT_VALIDATION_STATUSES)[number];

export function isUnitValidationStatus(value: string): value is UnitValidationStatus {
  return (UNIT_VALIDATION_STATUSES as readonly string[]).includes(value);
}

async function resolvePack(
  workspaceId: string,
  domainPackId: string | null | undefined,
): Promise<ConnectDomainPack | null> {
  if (!domainPackId) return null;
  const row = await getConnectDomainPackById({ id: domainPackId, workspaceId });
  if (!row) return null;
  try {
    return domainPackRecordToApi(row);
  } catch {
    return null;
  }
}

async function loadPriorUnitPostgres(workspaceId: string, unitId: string) {
  return getConnectGraphUnitForReview({ workspaceId, unitId });
}

async function loadPriorUnitSurreal(
  workspaceId: string,
  unitId: string,
): Promise<{
  validationStatus: string | null;
  validationNote: string | null;
  unitType: string | null;
  domainPackId: string | null;
} | null> {
  const store = await buildWorkspaceGraphStore(workspaceId);
  if (!store) return null;
  try {
    const res = await store.query<unknown>(
      `SELECT validation_status, validation_note, unit_type, domain_pack_id FROM ${surrealRecordRef(unitId)};`,
    );
    const row = Array.isArray(res) ? res[0] : null;
    if (!row || typeof row !== "object") return null;
    const rec = row as Record<string, unknown>;
    return {
      validationStatus:
        rec.validation_status != null ? String(rec.validation_status) : null,
      validationNote: rec.validation_note != null ? String(rec.validation_note) : null,
      unitType: rec.unit_type != null ? String(rec.unit_type) : null,
      domainPackId: rec.domain_pack_id != null ? String(rec.domain_pack_id) : null,
    };
  } catch {
    return null;
  }
}

export async function updateConnectUnitValidation(params: {
  workspaceId: string;
  unitId: string;
  status: UnitValidationStatus;
  note?: string | null;
  domainPackId?: string | null;
}): Promise<{ ok: true } | { ok: false; status: number; message: string }> {
  const note = formatHumanReviewNote(params.status, params.note);
  const target = await getConnectGraphTargetForWorkspace(params.workspaceId);
  if (!target) {
    return { ok: false, status: 503, message: "No graph store configured for this workspace." };
  }

  const prior =
    target.provider === "surreal"
      ? await loadPriorUnitSurreal(params.workspaceId, params.unitId)
      : await loadPriorUnitPostgres(params.workspaceId, params.unitId);

  const packId = params.domainPackId ?? prior?.domainPackId ?? null;
  const pack = await resolvePack(params.workspaceId, packId);
  const signalCtx = await getConnectReviewSignalContext({
    workspaceId: params.workspaceId,
    sourceId: prior && "sourceId" in prior ? (prior.sourceId as string | null) : null,
    domainPackId: packId,
  });

  if (target.provider === "postgres" && target.useDashboardDatabase) {
    const updated = await updateUnitValidationPostgres({
      workspaceId: params.workspaceId,
      results: [{ unitId: params.unitId, status: params.status, note }],
    });
    if (updated === 0) {
      return { ok: false, status: 404, message: "Unit not found in Postgres graph spine." };
    }
  } else if (target.provider === "surreal" && target.endpoint && target.namespace && target.database) {
    if (!pack) {
      return { ok: false, status: 400, message: "Domain pack context is required for SurrealDB review." };
    }
    const store = await buildWorkspaceGraphStore(params.workspaceId);
    if (!store) {
      return { ok: false, status: 503, message: "Could not connect to your SurrealDB graph store." };
    }
    try {
      await store.query(
        `UPDATE ${surrealRecordRef(params.unitId)} MERGE { validation_status: ${JSON.stringify(params.status)}, validation_note: ${JSON.stringify(note)} };`,
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Update failed";
      return { ok: false, status: 502, message: msg.slice(0, 280) };
    }
  } else {
    const updated = await updateUnitValidationPostgres({
      workspaceId: params.workspaceId,
      results: [{ unitId: params.unitId, status: params.status, note }],
    });
    if (updated === 0) {
      return { ok: false, status: 404, message: "Unit not found." };
    }
  }

  await recordReviewSignal({
    workspaceId: params.workspaceId,
    unitId: params.unitId,
    aiStatus: prior?.validationStatus ?? null,
    aiFlagReason: extractAiFlagReason(prior?.validationNote),
    humanStatus: params.status,
    humanNote: params.note ?? null,
    pack,
    unitType: prior?.unitType ?? null,
    sourceKind: signalCtx.sourceKind,
    ingestJobId: signalCtx.ingestJobId,
    timeSinceIngestCompleteMs: signalCtx.timeSinceIngestCompleteMs,
    telemetryEnabled: signalCtx.telemetryEnabled,
  }).catch(() => undefined);

  return { ok: true };
}

/** Permanently remove a unit from the graph store (operator curation — true but irrelevant, etc.). */
export async function removeConnectUnitFromGraph(params: {
  workspaceId: string;
  unitId: string;
  domainPackId?: string | null;
}): Promise<{ ok: true } | { ok: false; status: number; message: string }> {
  const target = await getConnectGraphTargetForWorkspace(params.workspaceId);
  const prior =
    target?.provider === "surreal"
      ? await loadPriorUnitSurreal(params.workspaceId, params.unitId)
      : await loadPriorUnitPostgres(params.workspaceId, params.unitId);

  const packId = params.domainPackId ?? prior?.domainPackId ?? null;
  const pack = await resolvePack(params.workspaceId, packId);
  const signalCtx = await getConnectReviewSignalContext({
    workspaceId: params.workspaceId,
    sourceId: prior && "sourceId" in prior ? (prior.sourceId as string | null) : null,
    domainPackId: packId,
  });

  if (target?.provider === "surreal" && target.endpoint && target.namespace && target.database) {
    const store = await buildWorkspaceGraphStore(params.workspaceId);
    if (!store) {
      return { ok: false, status: 503, message: "Could not connect to your SurrealDB graph store." };
    }
    try {
      await store.query(`DELETE ${surrealRecordRef(params.unitId)};`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Delete failed";
      return { ok: false, status: 502, message: msg.slice(0, 280) };
    }
  } else if (target?.provider === "postgres" && target.useDashboardDatabase) {
    try {
      await deleteUnitPostgres({ workspaceId: params.workspaceId, unitId: params.unitId });
    } catch {
      return { ok: false, status: 404, message: "Unit not found in Postgres graph spine." };
    }
  } else {
    try {
      await deleteUnitPostgres({ workspaceId: params.workspaceId, unitId: params.unitId });
    } catch {
      return { ok: false, status: 404, message: "Unit not found." };
    }
  }

  await recordReviewSignal({
    workspaceId: params.workspaceId,
    unitId: params.unitId,
    aiStatus: prior?.validationStatus ?? null,
    aiFlagReason: extractAiFlagReason(prior?.validationNote),
    humanStatus: "removed",
    humanNote: null,
    removed: true,
    pack,
    unitType: prior?.unitType ?? null,
    sourceKind: signalCtx.sourceKind,
    ingestJobId: signalCtx.ingestJobId,
    timeSinceIngestCompleteMs: signalCtx.timeSinceIngestCompleteMs,
    telemetryEnabled: signalCtx.telemetryEnabled,
  }).catch(() => undefined);

  return { ok: true };
}
