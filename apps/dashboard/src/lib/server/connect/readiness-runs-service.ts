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

/** Tally raw validation_status values into a cohort quality summary. */
function summariseValidationCounts(counts: {
  ok: number;
  weak: number;
  unsupported: number;
  unvalidated: number;
}): ReadinessRunQualitySummary {
  const { ok, weak, unsupported, unvalidated } = counts;
  const total = ok + weak + unsupported + unvalidated;
  return {
    ok,
    weak,
    unsupported,
    unvalidated,
    ...(total > 0 ? { okPct: Math.round((ok / total) * 100) } : {}),
  };
}

function classifyValidationStatus(raw: unknown): "ok" | "weak" | "unsupported" | "unvalidated" {
  const s = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  if (s === "ok") return "ok";
  if (s === "weak") return "weak";
  if (s === "unsupported") return "unsupported";
  return "unvalidated";
}

/**
 * Surreal cohort breakdown. Fetches the cohort's records directly by id
 * (`SELECT … FROM <rec>, <rec>, …`) so it never scans the whole graph. Only
 * well-formed `table:id` refs are queried (best-effort — exotic ids are skipped).
 */
async function rollupSurrealCohortQuality(
  workspaceId: string,
  unitIds: string[],
): Promise<ReadinessRunQualitySummary | null> {
  const { buildWorkspaceGraphStore } = await import("$lib/server/connect/surreal-graph-store");
  const store = await buildWorkspaceGraphStore(workspaceId);
  if (!store) return null;
  const SAFE_RECORD_ID = /^[A-Za-z_][A-Za-z0-9_]*:[A-Za-z0-9_:-]+$/;
  const safe = unitIds.filter((id) => SAFE_RECORD_ID.test(id));
  if (safe.length === 0) return null;

  const counts = { ok: 0, weak: 0, unsupported: 0, unvalidated: 0 };
  const CHUNK = 200;
  let sawAny = false;
  for (let i = 0; i < safe.length; i += CHUNK) {
    const fromList = safe.slice(i, i + CHUNK).join(", ");
    const rows = await store.query<Record<string, unknown>[]>(
      `SELECT validation_status FROM ${fromList};`,
    );
    for (const row of Array.isArray(rows) ? rows : []) {
      sawAny = true;
      counts[classifyValidationStatus((row as Record<string, unknown>).validation_status)] += 1;
    }
  }
  return sawAny ? summariseValidationCounts(counts) : null;
}

/**
 * Best-effort cohort validation breakdown for the run's quality summary. Works
 * for both Postgres (grouped count) and Surreal (targeted record fetch). Returns
 * null on any error, in which case the run still completes without a summary.
 */
export async function rollupReadinessRunQuality(params: {
  runId: string;
  workspaceId: string;
}): Promise<ReadinessRunQualitySummary | null> {
  try {
    const unitIds = await listReadinessRunUnitIds(params.runId);
    if (unitIds.length === 0) return null;

    const { getConnectGraphTargetForWorkspace } = await import("$lib/server/neon");
    const target = await getConnectGraphTargetForWorkspace(params.workspaceId).catch(() => null);
    if (target?.provider === "surreal") {
      return await rollupSurrealCohortQuality(params.workspaceId, unitIds);
    }

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

    const counts = { ok: 0, weak: 0, unsupported: 0, unvalidated: 0 };
    for (const row of rows) {
      counts[classifyValidationStatus(row.validation_status)] += row.n;
    }
    return summariseValidationCounts(counts);
  } catch {
    return null;
  }
}
