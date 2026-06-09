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
  pass: z.boolean(),
  /** Human-readable reasons the verdict failed; empty when pass is true. */
  reasons: z.array(z.string())
});
export type ConnectEvalVerdict = z.infer<typeof ConnectEvalVerdictSchema>;
