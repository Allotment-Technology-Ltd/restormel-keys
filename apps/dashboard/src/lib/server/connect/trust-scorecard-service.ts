/**
 * Per-graph trust scorecard (Stage 1.2) — productizes the run quality report into a
 * persistent, store-aware scorecard for the workspace's active graph.
 *
 * Reuse, not new stats machinery:
 *   - units/relations/embedded/validation come from resolveConnectGraphStats (cached,
 *     store-aware, force-refresh handled by the ingest worker — PR #191 semantics);
 *   - the trust score is the same kg-audit v1 number the hub pulse and run quality
 *     report compute (graphStatsToKgAuditInputs → computeTrustScoreBreakdown);
 *   - the EBV breakdown projects what the graph writers already persist
 *     (verification_state / evidence_status fields on Surreal units;
 *     connect_claim_versions rows on the Postgres spine).
 *
 * Fail-safe direction (matches verified-claims.ts): a unit the store carries no EBV
 * data for is unverified/unbound, never silently promoted; an unanswerable coverage
 * count is null (unknown), never zero.
 */
import {
  CONNECT_TRUST_SCORECARD_SCHEMA_VERSION,
  VERIFIED_CLAIM_STATES,
  type ConnectTrustScorecard,
  type VerifiedClaimState,
  type VerifiedClaimSummary,
} from "@restormel/contracts";
import {
  computeG2Metrics,
  computeTrustScoreBreakdown,
  G2_OK_PCT_TARGET,
  G2_UNSUPPORTED_PCT_MAX,
  TRUST_SCORE_FORMULA,
} from "@restormel/connect-core";
import { graphStatsToKgAuditInputs } from "$lib/connect/graph-health-summary";
import {
  peekConnectGraphStats,
  resolveConnectGraphStats,
  resolveSurrealGraphReadContext,
  surrealCountWhere,
  type ConnectGraphStatsView,
  type SurrealGraphReadContext,
} from "$lib/server/connect/graph-explorer-service";
import { REMOVED_VALIDATION_STATUS } from "$lib/server/connect/graph-writer";
import {
  getConnectClaimVersionBreakdownPostgres,
  getConnectGraphCoverageCountsPostgres,
  listConnectIngestJobsForWorkspace,
} from "$lib/server/neon";

const EBV_STATES: ReadonlySet<string> = new Set(VERIFIED_CLAIM_STATES);

/** Store-read EBV + coverage inputs; null counts mean "the store could not answer". */
export type TrustScorecardEbvInputs = {
  /** Raw verification_state → count (any vocabulary; non-EBV states fold into unverified). */
  verificationStates: Record<string, number>;
  /** Raw evidence_status → count (bound | unbound | no_evidence as persisted). */
  evidenceStatuses: Record<string, number>;
  validatorGaps: number | null;
  remediationDrops: number | null;
  lastJudgedAt: string | null;
};

/**
 * Pure composition: graph stats + EBV inputs → the contract scorecard.
 * Exported for tests — all store reads happen in the load functions below.
 */
export function composeTrustScorecard(args: {
  store: "postgres" | "surreal";
  stats: ConnectGraphStatsView;
  ebv: TrustScorecardEbvInputs;
  /** Fallback "last verified" — the latest completed run's quality assessment time. */
  lastAssessedAt: string | null;
  now?: Date;
}): ConnectTrustScorecard {
  const { stats, ebv } = args;
  const units = Math.max(0, stats.units);

  // Trust score — identical inputs to the hub pulse and the run quality report.
  const { metrics, issues } = graphStatsToKgAuditInputs(stats);
  const breakdown = computeTrustScoreBreakdown(metrics, issues);

  const g2 = computeG2Metrics({
    ok: stats.validation.ok,
    weak: stats.validation.weak,
    unsupported: stats.validation.unsupported,
  });

  // Per-EBV-state breakdown. Units with no persisted (or a non-EBV legacy)
  // verification_state are unverified — never silently blended as verified.
  const verification_states: VerifiedClaimSummary = {};
  let counted = 0;
  for (const [state, count] of Object.entries(ebv.verificationStates)) {
    if (!EBV_STATES.has(state) || count <= 0) continue;
    const key = state as VerifiedClaimState;
    verification_states[key] = (verification_states[key] ?? 0) + count;
    counted += count;
  }
  const unaccounted = Math.max(0, units - counted);
  if (unaccounted > 0) {
    verification_states.unverified = (verification_states.unverified ?? 0) + unaccounted;
  }

  // % evidence-bound over ALL units: a unit without a persisted evidence_status is
  // unbound (fail-safe). Counts are clamped so a stale version row can't exceed 100%.
  const bound = Math.min(Math.max(0, ebv.evidenceStatuses.bound ?? 0), units);
  const no_evidence = Math.min(Math.max(0, ebv.evidenceStatuses.no_evidence ?? 0), units - bound);
  const unbound = Math.max(0, units - bound - no_evidence);
  const bound_pct = units > 0 ? Math.round((bound / units) * 100) : 0;

  return {
    schema_version: CONNECT_TRUST_SCORECARD_SCHEMA_VERSION,
    generated_at: (args.now ?? new Date()).toISOString(),
    store: args.store,
    units,
    relations: Math.max(0, stats.relations),
    trust_score: breakdown.score,
    trust_formula: TRUST_SCORE_FORMULA,
    score_factors: breakdown.factors,
    g2,
    targets: { ok_pct_min: G2_OK_PCT_TARGET, unsupported_pct_max: G2_UNSUPPORTED_PCT_MAX },
    embedding: {
      embedded: Math.min(Math.max(0, stats.embedded), units),
      units,
      pct: units > 0 ? Math.round((Math.min(stats.embedded, units) / units) * 100) : 0,
    },
    evidence: { bound, unbound, no_evidence, bound_pct },
    verification_states,
    coverage: {
      validator_gaps: ebv.validatorGaps,
      remediation_drops: ebv.remediationDrops,
    },
    last_verified_at: ebv.lastJudgedAt ?? args.lastAssessedAt,
  };
}

function coerceTimestamp(value: unknown): string | null {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string" && value.trim()) return value;
  return null;
}

/** Aggregate `GROUP BY field` counts on the Surreal unit table; {} when the query fails. */
async function surrealGroupCounts(
  ctx: SurrealGraphReadContext,
  field: "verification_state" | "evidence_status",
): Promise<Record<string, number>> {
  try {
    const rows = await ctx.store.query<Record<string, unknown>[]>(
      `SELECT ${field}, count() AS count FROM ${ctx.unitTable} GROUP BY ${field};`,
    );
    const out: Record<string, number> = {};
    for (const row of Array.isArray(rows) ? rows : []) {
      const key = row[field];
      if (typeof key !== "string" || !key) continue;
      out[key] = (out[key] ?? 0) + Number(row.count ?? 0);
    }
    return out;
  } catch {
    return {};
  }
}

async function loadSurrealEbvInputs(ctx: SurrealGraphReadContext): Promise<TrustScorecardEbvInputs> {
  const notNullNote = "validation_note != NONE";
  const [verificationStates, evidenceStatuses, validatorGaps, remediationDrops, lastJudgedAt] =
    await Promise.all([
      surrealGroupCounts(ctx, "verification_state"),
      surrealGroupCounts(ctx, "evidence_status"),
      surrealCountWhere(
        ctx.store,
        ctx.unitTable,
        `${notNullNote} AND string::startsWith(validation_note, 'coverage_gap')`,
      ),
      surrealCountWhere(
        ctx.store,
        ctx.unitTable,
        `validation_status = '${REMOVED_VALIDATION_STATUS}' AND ${notNullNote} AND string::startsWith(validation_note, 'Remediation (')`,
      ),
      ctx.store
        .query<{ judged_at?: unknown }[]>(
          `SELECT judged_at FROM connect_claim_judgment ORDER BY judged_at DESC LIMIT 1;`,
        )
        .then((rows) => coerceTimestamp(rows?.[0]?.judged_at))
        .catch(() => null),
    ]);
  return { verificationStates, evidenceStatuses, validatorGaps, remediationDrops, lastJudgedAt };
}

async function loadPostgresEbvInputs(workspaceId: string): Promise<TrustScorecardEbvInputs> {
  const [breakdown, coverage] = await Promise.all([
    getConnectClaimVersionBreakdownPostgres(workspaceId).catch(() => null),
    getConnectGraphCoverageCountsPostgres(workspaceId).catch(() => null),
  ]);
  return {
    verificationStates: breakdown?.verificationStates ?? {},
    evidenceStatuses: breakdown?.evidenceStatuses ?? {},
    validatorGaps: coverage ? coverage.validatorGaps : null,
    remediationDrops: coverage ? coverage.remediationDrops : null,
    lastJudgedAt: breakdown?.lastJudgedAt ?? null,
  };
}

/** Latest completed run with a quality report — its update time is "last assessed". */
async function resolveLastAssessedAt(workspaceId: string): Promise<string | null> {
  try {
    const jobs = await listConnectIngestJobsForWorkspace({ workspaceId, limit: 50 });
    const assessed = jobs.find(
      (job) => job.status === "completed" && Boolean(job.progress?.quality_report),
    );
    return assessed ? new Date(assessed.updatedAt).toISOString() : null;
  } catch {
    return null;
  }
}

export type LoadConnectTrustScorecardOpts = {
  /**
   * "resolve" (default) serves cached stats or recomputes on a cold cache —
   * authoritative, used by the v1 endpoint and the hub panel. "peek" never scans a
   * BYO store (cached values only) — used inside the pipeline wizard so the launch
   * step stays fast; it can return null on a cold cache even when a graph exists.
   */
  statsMode?: "resolve" | "peek";
};

/**
 * Load the trust scorecard for the workspace's active graph. Null when no graph
 * store is connected or the graph has no units yet (the scorecard "empty" state).
 */
export async function loadConnectTrustScorecard(
  workspaceId: string,
  opts?: LoadConnectTrustScorecardOpts,
): Promise<ConnectTrustScorecard | null> {
  const stats =
    opts?.statsMode === "peek"
      ? await peekConnectGraphStats(workspaceId).catch(() => null)
      : await resolveConnectGraphStats(workspaceId).catch(() => null);
  if (!stats || stats.units <= 0) return null;

  const surrealCtx = await resolveSurrealGraphReadContext(workspaceId).catch(() => null);
  const ebv = surrealCtx
    ? await loadSurrealEbvInputs(surrealCtx)
    : await loadPostgresEbvInputs(workspaceId);
  const lastAssessedAt = await resolveLastAssessedAt(workspaceId);

  return composeTrustScorecard({
    store: surrealCtx ? "surreal" : "postgres",
    stats,
    ebv,
    lastAssessedAt,
  });
}
