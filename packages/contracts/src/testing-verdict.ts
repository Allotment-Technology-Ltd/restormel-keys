/**
 * Testing run verdict contract — W3.8 Testing hub.
 *
 * Ingest endpoint: POST /connect/v1/testing/verdicts
 * List endpoint:   GET  /connect/v1/testing/verdicts
 *
 * Deliberately separate from ConnectEvalVerdictIngest (connect-eval.ts): the testing
 * runner produces suite-level pass/fail with goal counts, optional artifact refs, and
 * reasons — different fields from the G2-quality eval verdict. Shapes that genuinely
 * overlap (pagination response) use the same style but a separate schema so the two
 * contracts can evolve independently.
 *
 * Versioning: schema_version bumped only on BREAKING changes. Additive fields do not
 * bump it. Consumers MUST tolerate unknown fields.
 */
import { z } from 'zod';

/** Current testing verdict schema version. */
export const TESTING_VERDICT_SCHEMA_VERSION = '1.0' as const;

/**
 * A single testing run verdict posted by the Restormel Testing CI action or CLI.
 *
 * `suite_id` matches the id used by the testing-runs-server (PostRunsBody.suite_id).
 * `artifact_ref` is an opaque reference to a release pack artefact — URL or CI
 * artifact path — that the dashboard renders as a download link when present.
 */
export const TestingVerdictIngestSchema = z.object({
  /** Schema version — always TESTING_VERDICT_SCHEMA_VERSION. */
  schema_version: z.literal(TESTING_VERDICT_SCHEMA_VERSION),
  /** Suite id (matches restormel_testing_run_jobs.suite_id). */
  suite_id: z.string().min(1),
  /** When this verdict was evaluated (ISO 8601). */
  evaluated_at: z.string(),
  /** Overall pass/fail. */
  pass: z.boolean(),
  /** Count of goals that passed. */
  goals_passed: z.number().int().nonnegative().optional(),
  /** Total goal count evaluated. */
  goals_total: z.number().int().nonnegative().optional(),
  /**
   * Human-readable failure reasons; empty array when pass is true.
   * Rendered expandable in the timeline.
   */
  reasons: z.array(z.string()),
  /**
   * Opaque release-pack artifact reference (URL or CI artifact path).
   * When present, the dashboard renders a download link.
   */
  artifact_ref: z.string().optional(),
  /**
   * How the verdict was produced.
   *   - 'ci_action' — the testing CI action
   *   - 'cli'       — `restormel-testing` CLI
   *   - 'manual'    — hand-posted (dev/ops)
   */
  source: z.enum(['ci_action', 'cli', 'manual']),
  /** Git commit SHA when running in CI (for cross-linking to the producing commit). */
  commit_sha: z.string().optional(),
  /** Repository name (e.g. "org/repo") when running in CI. */
  repository: z.string().optional(),
  /** PR number when running in CI. */
  pr_number: z.string().optional(),
});
export type TestingVerdictIngest = z.infer<typeof TestingVerdictIngestSchema>;

/** POST /connect/v1/testing/verdicts response. */
export const TestingVerdictIngestResponseSchema = z.object({
  id: z.string().min(1),
  recorded_at: z.string(),
});
export type TestingVerdictIngestResponse = z.infer<typeof TestingVerdictIngestResponseSchema>;

/** A single persisted testing verdict entry for the timeline. */
export const TestingVerdictEntrySchema = z.object({
  id: z.string().min(1),
  workspace_id: z.string().min(1),
  recorded_at: z.string(),
  verdict: TestingVerdictIngestSchema,
});
export type TestingVerdictEntry = z.infer<typeof TestingVerdictEntrySchema>;

/** GET /connect/v1/testing/verdicts response. */
export const TestingVerdictHistoryResponseSchema = z.object({
  entries: z.array(TestingVerdictEntrySchema),
  /** Cursor for the next page; absent when this is the last page. */
  next_cursor: z.string().optional(),
});
export type TestingVerdictHistoryResponse = z.infer<typeof TestingVerdictHistoryResponseSchema>;
