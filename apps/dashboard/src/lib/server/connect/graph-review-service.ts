/**
 * Operator review of ingested graph units — update validation after AI pass.
 */
import type { ConnectDomainPack } from "@restormel/contracts/connect";
import { domainPackRecordToApi } from "$lib/server/connect/domain-pack-service";
import { surrealRecordRef } from "$lib/server/connect/graph-writer";
import { buildWorkspaceGraphStore } from "$lib/server/connect/surreal-graph-store";
import {
  getConnectDomainPackById,
  getConnectGraphTargetForWorkspace,
  deleteUnitPostgres,
  updateUnitValidationPostgres,
} from "$lib/server/neon";

export const UNIT_VALIDATION_STATUSES = ["ok", "weak", "unsupported"] as const;
export type UnitValidationStatus = (typeof UNIT_VALIDATION_STATUSES)[number];

export function isUnitValidationStatus(value: string): value is UnitValidationStatus {
  return (UNIT_VALIDATION_STATUSES as readonly string[]).includes(value);
}

async function resolveSurrealPack(
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

export async function updateConnectUnitValidation(params: {
  workspaceId: string;
  unitId: string;
  status: UnitValidationStatus;
  note?: string | null;
  domainPackId?: string | null;
}): Promise<{ ok: true } | { ok: false; status: number; message: string }> {
  const note =
    params.note?.trim() ||
    (params.status === "ok" ? "Human review: supported" : `Human review: ${params.status}`);

  const target = await getConnectGraphTargetForWorkspace(params.workspaceId);
  if (!target) {
    return { ok: false, status: 503, message: "No graph store configured for this workspace." };
  }

  if (target.provider === "postgres" && target.useDashboardDatabase) {
    const updated = await updateUnitValidationPostgres({
      workspaceId: params.workspaceId,
      results: [{ unitId: params.unitId, status: params.status, note }],
    });
    if (updated === 0) {
      return { ok: false, status: 404, message: "Unit not found in Postgres graph spine." };
    }
    return { ok: true };
  }

  if (target.provider === "surreal" && target.endpoint && target.namespace && target.database) {
    const pack = await resolveSurrealPack(params.workspaceId, params.domainPackId);
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
      return { ok: true };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Update failed";
      return { ok: false, status: 502, message: msg.slice(0, 280) };
    }
  }

  // Legacy Postgres spine (no explicit target row).
  const updated = await updateUnitValidationPostgres({
    workspaceId: params.workspaceId,
    results: [{ unitId: params.unitId, status: params.status, note }],
  });
  if (updated === 0) {
    return { ok: false, status: 404, message: "Unit not found." };
  }
  return { ok: true };
}

/** Permanently remove a unit from the graph store (operator curation — true but irrelevant, etc.). */
export async function removeConnectUnitFromGraph(params: {
  workspaceId: string;
  unitId: string;
}): Promise<{ ok: true } | { ok: false; status: number; message: string }> {
  const target = await getConnectGraphTargetForWorkspace(params.workspaceId);

  if (target?.provider === "surreal" && target.endpoint && target.namespace && target.database) {
    const store = await buildWorkspaceGraphStore(params.workspaceId);
    if (!store) {
      return { ok: false, status: 503, message: "Could not connect to your SurrealDB graph store." };
    }
    try {
      await store.query(`DELETE ${surrealRecordRef(params.unitId)};`);
      return { ok: true };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Delete failed";
      return { ok: false, status: 502, message: msg.slice(0, 280) };
    }
  }

  if (target?.provider === "postgres" && target.useDashboardDatabase) {
    try {
      await deleteUnitPostgres({ workspaceId: params.workspaceId, unitId: params.unitId });
      return { ok: true };
    } catch {
      return { ok: false, status: 404, message: "Unit not found in Postgres graph spine." };
    }
  }

  try {
    await deleteUnitPostgres({ workspaceId: params.workspaceId, unitId: params.unitId });
    return { ok: true };
  } catch {
    return { ok: false, status: 404, message: "Unit not found." };
  }
}
