/**
 * Connect quality-evaluation verdict (Context Regression CI, Stage 2.1).
 *
 * The machine-readable verdict emitted by `keys connect eval`: the G2 validation
 * breakdown (supported/weak/unsupported per CONNECT-INGEST-QUALITY-BAR) judged against
 * the published targets, plus the optional trust score and coverage-gap count. This is
 * the CI contract — Stage 2.2 baseline diffing and the Stage 2.3 CI gate consume and
 * persist this exact shape, so it is versioned independently of any internal report.
 *
 * Versioning: `schema_version` is bumped only on breaking shape changes. Additive,
 * backward-compatible fields do not bump it. Consumers MUST tolerate unknown fields.
 */
import { z } from 'zod';

/** Current connect-eval verdict schema version. Bumped only on breaking changes. */
export const CONNECT_EVAL_VERDICT_SCHEMA_VERSION = '1.0' as const;

/**
 * G2 validation breakdown. Counts are absolute unit counts; percentages are integers
 * (0–100) rounded exactly as `computeG2Metrics` in @restormel/connect-core rounds them,
 * over the validated denominator (ok + weak + unsupported).
 */
export const ConnectEvalG2Schema = z.object({
  ok: z.number().int().nonnegative(),
  weak: z.number().int().nonnegative(),
  unsupported: z.number().int().nonnegative(),
  ok_pct: z.number().min(0).max(100),
  unsupported_pct: z.number().min(0).max(100)
});
export type ConnectEvalG2 = z.infer<typeof ConnectEvalG2Schema>;

/** The published quality bar the verdict was judged against (echoed for auditability). */
export const ConnectEvalTargetsSchema = z.object({
  /** Minimum supported (ok) percentage. The published bar is 90. */
  ok_pct_min: z.number().min(0).max(100),
  /** Maximum unsupported percentage. The published bar is 2. */
  unsupported_pct_max: z.number().min(0).max(100)
});
export type ConnectEvalTargets = z.infer<typeof ConnectEvalTargetsSchema>;

/**
 * A claim cited by a verdict (claim-level regression diffing, Stage 2.2).
 * Identity for diffing is `id` when the producing pipeline has a stable claim id,
 * otherwise the normalized text + source_ref pair.
 */
export const ConnectEvalClaimRefSchema = z.object({
  /** Stable claim identity (graph claim id) when the producing pipeline has one. */
  id: z.string().min(1).optional(),
  /** The claim text — cited verbatim in regression reports. */
  text: z.string().min(1),
  /** Where the claim came from (source URL / document ref). */
  source_ref: z.string().min(1).optional()
});
export type ConnectEvalClaimRef = z.infer<typeof ConnectEvalClaimRefSchema>;

/** What was evaluated — a workspace's ingest-run quality report, or counts supplied locally. */
export const ConnectEvalSourceSchema = z.object({
  kind: z.enum(['ingest_job', 'counts_file', 'stdin']),
  workspace_id: z.string().optional(),
  project_id: z.string().optional(),
  /** Ingest job id when kind is 'ingest_job'. */
  job_id: z.string().optional(),
  /** Local file path when kind is 'counts_file'. */
  path: z.string().optional(),
  /** When the producing run assessed quality (quality_report.assessed_at), if known. */
  assessed_at: z.string().optional()
});
export type ConnectEvalSource = z.infer<typeof ConnectEvalSourceSchema>;

export const ConnectEvalVerdictSchema = z.object({
  schema_version: z.literal(CONNECT_EVAL_VERDICT_SCHEMA_VERSION),
  /** When this verdict was computed (ISO 8601). */
  evaluated_at: z.string(),
  source: ConnectEvalSourceSchema,
  g2: ConnectEvalG2Schema,
  targets: ConnectEvalTargetsSchema,
  /** kg-audit trust score (0–100) when the producing report carried one. */
  trust_score: z.number().min(0).max(100).optional(),
  /** Count of coverage gaps (omitted/unparseable verdicts defaulted to non-passing, PR #189 semantics) when the producing pipeline reports it. */
  coverage_gaps: z.number().int().nonnegative().optional(),
  /** Source-set fingerprint (goldenExtractionEvalFingerprint) when evaluating a golden fixture — Stage 2.2 keys baselines on it. */
  fingerprint: z.string().optional(),
  /**
   * Unsupported claims cited by the producing pipeline (claim text + source ref),
   * enabling claim-identity regression diffing (Stage 2.2). Additive — no version bump.
   */
  unsupported_claims: z.array(ConnectEvalClaimRefSchema).optional(),
  pass: z.boolean(),
  /** Human-readable reasons the verdict failed; empty when pass is true. */
  reasons: z.array(z.string())
});
export type ConnectEvalVerdict = z.infer<typeof ConnectEvalVerdictSchema>;

// ── Stage 2.2 — quality baseline + regression diff ──────────────────────────

/** Current connect-eval baseline schema version. Bumped only on breaking changes. */
export const CONNECT_EVAL_BASELINE_SCHEMA_VERSION = '1.0' as const;

/**
 * The committed-friendly baseline artifact written by `keys connect eval --save-baseline`.
 * It embeds the full Stage 2.1 verdict (no parallel shape) and is keyed by the source-set
 * fingerprint (goldenExtractionEvalFingerprint): a changed corpus is a new baseline, not
 * a regression.
 */
export const ConnectEvalBaselineSchema = z.object({
  schema_version: z.literal(CONNECT_EVAL_BASELINE_SCHEMA_VERSION),
  /** When the baseline was saved (ISO 8601). */
  saved_at: z.string(),
  /** Source-set fingerprint the baseline is keyed by (mirrors verdict.fingerprint when known). */
  fingerprint: z.string().optional(),
  /** The verdict at baseline time — the exact Stage 2.1 contract shape. */
  verdict: ConnectEvalVerdictSchema
});
export type ConnectEvalBaseline = z.infer<typeof ConnectEvalBaselineSchema>;

/** Current connect-eval diff schema version. Bumped only on breaking changes. */
export const CONNECT_EVAL_DIFF_SCHEMA_VERSION = '1.0' as const;

/** Signed metric deltas: current − baseline. Optional dimensions appear only when both sides carry them. */
export const ConnectEvalDeltasSchema = z.object({
  ok_pct: z.number(),
  unsupported_pct: z.number(),
  trust_score: z.number().optional(),
  coverage_gaps: z.number().int().optional()
});
export type ConnectEvalDeltas = z.infer<typeof ConnectEvalDeltasSchema>;

/**
 * The regression diff emitted by `keys connect eval --baseline`. `regression` is the
 * CI signal (exit code 3): true when, under a matching fingerprint, ok_pct or trust_score
 * dropped beyond tolerance, coverage gaps grew, or a NEW unsupported claim appeared
 * (by claim identity, not count). When `fingerprint_changed` is true the corpus changed:
 * regression checks are skipped and the baseline is superseded.
 */
export const ConnectEvalDiffSchema = z.object({
  schema_version: z.literal(CONNECT_EVAL_DIFF_SCHEMA_VERSION),
  /** When the comparison ran (ISO 8601). */
  compared_at: z.string(),
  baseline_saved_at: z.string(),
  baseline_fingerprint: z.string().optional(),
  current_fingerprint: z.string().optional(),
  /** True when both fingerprints are known and differ — new corpus, baseline superseded. */
  fingerprint_changed: z.boolean(),
  /** Allowed drop (percentage points / score points) for ok_pct and trust_score before flagging. */
  tolerance: z.number().nonnegative(),
  deltas: ConnectEvalDeltasSchema,
  /** False when either side carries no unsupported_claims list (claim-level diff unavailable). */
  claims_compared: z.boolean(),
  /** Claims unsupported now that were not unsupported at baseline time — the headline regression. */
  new_unsupported_claims: z.array(ConnectEvalClaimRefSchema),
  regression: z.boolean(),
  /** Human-readable regression findings; empty when regression is false. */
  regressions: z.array(z.string())
});
export type ConnectEvalDiff = z.infer<typeof ConnectEvalDiffSchema>;
