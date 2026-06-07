/**
 * Readiness runs orchestration.
 *
 * A readiness run is a named pass that takes a cohort — the next N still-unlinked
 * ideas — through link → embed → validate. The cohort is defined up front:
 * `createReadinessRun` resolves the next N unlinked unit ids and stamps them into
 * `knowledge_readiness_run_units`. Every step then scopes to that membership set
 * (the cohort filter in the link / embed / validate services).
 *
 * Run status is advanced by the ingest worker as each cohort job runs, so the
 * worker is the single source of truth for where a run is in the journey.
 */
import {
  insertReadinessRun,
  addReadinessRunUnits,
  updateReadinessRun,
  listReadinessRunsForWorkspace,
  listReadinessRunUnitIds,
  type ReadinessRunRecord,
  type ReadinessRunStatus,
  type ReadinessRunQualitySummary,
} from "$lib/server/connect/readiness-runs";
import { resolveNextCohortUnitIds } from "$lib/server/connect/graph-source-link-service";

/** Create a run, resolve its cohort (next N unlinked), and stamp membership. */
export async function createReadinessRun(params: {
  workspaceId: string;
  sizeTarget: number;
  domainPackId?: string | null;
  label?: string;
}): Promise<ReadinessRunRecord> {
  const { randomUUID } = await import("node:crypto");
  const sizeTarget = Math.min(Math.max(Math.floor(params.sizeTarget), 1), 100_000);

  // Resolve the cohort BEFORE creating the run — a resolution failure then surfaces
  // as an error instead of leaving behind a misleading empty (0-member) run.
  const unitIds = await resolveNextCohortUnitIds(params.workspaceId, sizeTarget);

  const existing = await listReadinessRunsForWorkspace({
    workspaceId: params.workspaceId,
    includeArchived: true,
    limit: 200,
  });
  const runNumber = existing.length + 1;
  const label = params.label?.trim() || `Run ${runNumber} · ${sizeTarget.toLocaleString()} ideas`;

  const run = await insertReadinessRun({
    id: randomUUID(),
    workspaceId: params.workspaceId,
    domainPackId: params.domainPackId ?? null,
    label,
    sizeTarget,
  });

  if (unitIds.length > 0) {
    await addReadinessRunUnits({ runId: run.id, unitIds });
  }
  const updated = await updateReadinessRun({
    runId: run.id,
    workspaceId: params.workspaceId,
    sizeActual: unitIds.length,
  });
  return updated ?? { ...run, sizeActual: unitIds.length };
}

/** Worker hook: advance a run's status as its cohort jobs start and finish. */
export async function markReadinessRunPhase(params: {
  runId: string;
  workspaceId: string;
  phase: ReadinessRunStatus;
  qualitySummary?: ReadinessRunQualitySummary | null;
}): Promise<void> {
  await updateReadinessRun({
    runId: params.runId,
    workspaceId: params.workspaceId,
    status: params.phase,
    ...(params.qualitySummary !== undefined ? { qualitySummary: params.qualitySummary } : {}),
  }).catch(() => null);
}

/**
 * Best-effort cohort validation breakdown for the run's quality summary.
 * Postgres only (plain unit ids); returns null for Surreal / on any error, in
 * which case the run still completes without a stored quality summary.
 */
export async function rollupReadinessRunQuality(params: {
  runId: string;
  workspaceId: string;
}): Promise<ReadinessRunQualitySummary | null> {
  try {
    const unitIds = await listReadinessRunUnitIds(params.runId);
    if (unitIds.length === 0) return null;
    const { getSql, ensureIngestionRoutingSchema } = await import("$lib/server/neon");
    await ensureIngestionRoutingSchema();
    const sql = getSql();
    const rows = (await sql`
      SELECT validation_status, COUNT(*)::int AS n
      FROM knowledge_graph_units
      WHERE workspace_id = ${params.workspaceId}
        AND id = ANY(${unitIds}::text[])
      GROUP BY validation_status
    `) as { validation_status: string | null; n: number }[];
    if (rows.length === 0) return null;

    let ok = 0;
    let weak = 0;
    let unsupported = 0;
    let unvalidated = 0;
    for (const row of rows) {
      const s = (row.validation_status ?? "").trim().toLowerCase();
      if (s === "ok") ok += row.n;
      else if (s === "weak") weak += row.n;
      else if (s === "unsupported") unsupported += row.n;
      else unvalidated += row.n;
    }
    const checked = ok + weak + unsupported;
    const total = checked + unvalidated;
    return {
      ok,
      weak,
      unsupported,
      unvalidated,
      ...(total > 0 ? { okPct: Math.round((ok / total) * 100) } : {}),
    };
  } catch {
    return null;
  }
}
