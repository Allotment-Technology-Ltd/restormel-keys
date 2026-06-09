/**
 * Verdict mapping for `keys connect eval` (Stage 2.1 — Context Regression CI).
 * Pure functions — no I/O — so verdict mapping and exit codes are unit-testable.
 *
 * The G2 math (rounding, targets) is NOT reimplemented here: it is imported from
 * @restormel/connect-core/ingest/golden-eval so the CLI judges with exactly the same
 * bar as the ingest pipeline. The output shape is the versioned CI contract in
 * @restormel/contracts/connect-eval.
 */
import {
  assertG2Targets,
  computeG2Metrics,
  G2_OK_PCT_TARGET,
  G2_UNSUPPORTED_PCT_MAX,
} from "@restormel/connect-core/ingest/golden-eval";
import {
  CONNECT_EVAL_VERDICT_SCHEMA_VERSION,
  ConnectEvalVerdictSchema,
  type ConnectEvalSource,
  type ConnectEvalVerdict,
} from "@restormel/contracts/connect-eval";
import type { ConnectIngestJob, ConnectIngestQualityReport } from "@restormel/contracts/connect";

/** Stable exit codes (packages/validate precedent: 2 is reserved for config/usage errors). */
export const EVAL_EXIT_PASS = 0;
export const EVAL_EXIT_QUALITY_FAIL = 1;
export const EVAL_EXIT_CONFIG_ERROR = 2;

export interface EvalCounts {
  ok: number;
  weak: number;
  unsupported: number;
}

export interface EvalCountsInput {
  counts: EvalCounts;
  trust_score?: number;
  coverage_gaps?: number;
  fingerprint?: string;
  assessed_at?: string;
}

export type ParseCountsResult =
  | { ok: true; input: EvalCountsInput }
  | { ok: false; error: string };

function isNonNegativeInt(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

/**
 * Parse a local counts document. Two shapes are accepted:
 *  1. Canonical counts: `{ ok, weak, unsupported, trust_score?, coverage_gaps?, fingerprint? }`
 *  2. A run's public quality report (ConnectIngestQualityReport, as returned by
 *     GET /connect/v1/ingest/jobs): `{ supported_count, weak_count, unsupported_count, trust_score, assessed_at, … }`
 */
export function parseCountsInput(json: unknown): ParseCountsResult {
  if (json === null || typeof json !== "object" || Array.isArray(json)) {
    return { ok: false, error: "Counts input must be a JSON object." };
  }
  const rec = json as Record<string, unknown>;

  let counts: EvalCounts;
  if ("supported_count" in rec || "weak_count" in rec || "unsupported_count" in rec) {
    // Public quality-report shape (C2 contract).
    if (
      !isNonNegativeInt(rec.supported_count) ||
      !isNonNegativeInt(rec.weak_count) ||
      !isNonNegativeInt(rec.unsupported_count)
    ) {
      return {
        ok: false,
        error:
          "Quality-report input requires non-negative integer supported_count, weak_count, and unsupported_count.",
      };
    }
    counts = { ok: rec.supported_count, weak: rec.weak_count, unsupported: rec.unsupported_count };
  } else {
    if (!isNonNegativeInt(rec.ok) || !isNonNegativeInt(rec.weak) || !isNonNegativeInt(rec.unsupported)) {
      return {
        ok: false,
        error:
          "Counts input requires non-negative integer ok, weak, and unsupported fields " +
          "(or a quality report with supported_count/weak_count/unsupported_count).",
      };
    }
    counts = { ok: rec.ok, weak: rec.weak, unsupported: rec.unsupported };
  }

  const input: EvalCountsInput = { counts };
  if (rec.trust_score !== undefined) {
    if (typeof rec.trust_score !== "number" || rec.trust_score < 0 || rec.trust_score > 100) {
      return { ok: false, error: "trust_score must be a number between 0 and 100." };
    }
    input.trust_score = rec.trust_score;
  }
  if (rec.coverage_gaps !== undefined) {
    if (!isNonNegativeInt(rec.coverage_gaps)) {
      return { ok: false, error: "coverage_gaps must be a non-negative integer." };
    }
    input.coverage_gaps = rec.coverage_gaps;
  }
  if (rec.fingerprint !== undefined) {
    if (typeof rec.fingerprint !== "string" || rec.fingerprint.length === 0) {
      return { ok: false, error: "fingerprint must be a non-empty string." };
    }
    input.fingerprint = rec.fingerprint;
  }
  if (typeof rec.assessed_at === "string") input.assessed_at = rec.assessed_at;
  return { ok: true, input };
}

/**
 * Compute the verdict: G2 metrics + the published targets (assertG2Targets) → pass/reasons.
 * Validated against the contract schema before returning, so the CLI can never emit a
 * verdict that violates @restormel/contracts/connect-eval.
 */
export function buildEvalVerdict(args: {
  counts: EvalCounts;
  source: ConnectEvalSource;
  evaluatedAt: string;
  trust_score?: number;
  coverage_gaps?: number;
  fingerprint?: string;
}): ConnectEvalVerdict {
  const g2 = computeG2Metrics(args.counts);
  const { pass, reasons } = assertG2Targets(g2);
  return ConnectEvalVerdictSchema.parse({
    schema_version: CONNECT_EVAL_VERDICT_SCHEMA_VERSION,
    evaluated_at: args.evaluatedAt,
    source: args.source,
    g2,
    targets: { ok_pct_min: G2_OK_PCT_TARGET, unsupported_pct_max: G2_UNSUPPORTED_PCT_MAX },
    ...(args.trust_score !== undefined ? { trust_score: args.trust_score } : {}),
    ...(args.coverage_gaps !== undefined ? { coverage_gaps: args.coverage_gaps } : {}),
    ...(args.fingerprint !== undefined ? { fingerprint: args.fingerprint } : {}),
    pass,
    reasons,
  });
}

/** Verdict from a run's public quality report (GET /connect/v1/ingest/jobs/{jobId} → job.quality_report). */
export function verdictFromQualityReport(args: {
  report: ConnectIngestQualityReport;
  source: ConnectEvalSource;
  evaluatedAt: string;
}): ConnectEvalVerdict {
  return buildEvalVerdict({
    counts: {
      ok: args.report.supported_count,
      weak: args.report.weak_count,
      unsupported: args.report.unsupported_count,
    },
    source: { ...args.source, assessed_at: args.report.assessed_at },
    evaluatedAt: args.evaluatedAt,
    trust_score: args.report.trust_score,
  });
}

/**
 * Pick the most recently assessed job that carries a quality report.
 * Jobs without a quality_report (still running, failed before stats, pre-C2 runs) are skipped.
 */
export function pickLatestAssessedJob(jobs: ConnectIngestJob[]): ConnectIngestJob | null {
  const assessed = jobs.filter((j) => j.quality_report != null);
  if (assessed.length === 0) return null;
  return assessed.reduce((latest, j) =>
    Date.parse(j.quality_report!.assessed_at) > Date.parse(latest.quality_report!.assessed_at) ? j : latest,
  );
}

/** Quality verdict → process exit code. Config errors use EVAL_EXIT_CONFIG_ERROR at the command layer. */
export function exitCodeForVerdict(verdict: ConnectEvalVerdict): number {
  return verdict.pass ? EVAL_EXIT_PASS : EVAL_EXIT_QUALITY_FAIL;
}
