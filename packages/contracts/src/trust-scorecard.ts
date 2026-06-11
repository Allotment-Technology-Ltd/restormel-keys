/**
 * Per-graph trust scorecard (Connect v1, Stage 1.2 of the verified-context roadmap).
 *
 * Productizes the run quality report into a persistent, public-shaped scorecard: a
 * graph's quality is inspectable at any time — not only in the run console after an
 * ingest. Every number is a projection of data the pipeline already persists:
 *
 *   - trust score / factors → kg-audit trust score v1 (@restormel/connect-core)
 *   - g2 / targets          → the published CONNECT-INGEST-QUALITY-BAR (ok ≥ 90%,
 *                             unsupported ≤ 2%), reusing the connect-eval shapes
 *   - verification_states   → EBV `verification_state` written by the graph writers
 *                             (Layers 1+2), reusing the verified-claim state summary
 *   - evidence              → EBV Layer-1 `evidence_status` (bound|unbound|no_evidence)
 *   - coverage              → "coverage_gap" validation notes + remediation soft-excludes
 *                             (fail-safe defaulted drops included — PR #189 semantics)
 *
 * Versioning: `schema_version` is bumped only on breaking shape changes; the carrying
 * response's `contract_version` governs the endpoint envelope. Consumers MUST tolerate
 * unknown fields.
 */
import { z } from 'zod';
import { ConnectApiContractVersionSchema } from './connect.js';
import { ConnectEvalG2Schema, ConnectEvalTargetsSchema } from './connect-eval.js';
import { VerifiedClaimSummarySchema } from './verified-claim.js';

/** Current trust scorecard schema version. Bumped only on breaking changes. */
export const CONNECT_TRUST_SCORECARD_SCHEMA_VERSION = '1.0' as const;

/**
 * One weighted component of the kg-audit trust score — mirrors
 * `TrustScoreFactor` in @restormel/connect-core (single source of truth for the
 * formula). `points < max_points` is exactly "what lowered this score".
 */
export const TrustScorecardFactorSchema = z.object({
  id: z.enum([
    'embedding_coverage',
    'verification_coverage',
    'orphan_rate',
    'vector_index',
    'relation_health',
    'issue_penalty'
  ]),
  label: z.string(),
  /** Maximum points the factor can contribute to the 0–100 score. */
  max_points: z.number().nonnegative(),
  /** Points attained (0 ≤ points ≤ max_points). */
  points: z.number().nonnegative()
});
export type TrustScorecardFactor = z.infer<typeof TrustScorecardFactorSchema>;

/**
 * EBV Layer-1 evidence-binding breakdown over the graph's units. Units the store
 * carries no `evidence_status` for are counted as `unbound` (fail-safe — same
 * demote-only rule the verified-claim envelope applies on retrieval).
 */
export const TrustScorecardEvidenceSchema = z.object({
  bound: z.number().int().nonnegative(),
  unbound: z.number().int().nonnegative(),
  no_evidence: z.number().int().nonnegative(),
  /** % of units with a deterministically re-checkable bound span (integer 0–100). */
  bound_pct: z.number().min(0).max(100)
});
export type TrustScorecardEvidence = z.infer<typeof TrustScorecardEvidenceSchema>;

/**
 * Coverage-gap counts (PR #189 fail-safe semantics). Null means the graph store could
 * not answer the count query — unknown is reported as unknown, never as zero.
 */
export const TrustScorecardCoverageSchema = z.object({
  /** Units whose validation note records a validator/judge omission ("coverage_gap: …"). */
  validator_gaps: z.number().int().nonnegative().nullable(),
  /** Units soft-excluded by remediation, incl. omitted verdicts defaulted to drop. */
  remediation_drops: z.number().int().nonnegative().nullable()
});
export type TrustScorecardCoverage = z.infer<typeof TrustScorecardCoverageSchema>;

/**
 * Temporal-validity coverage (Stage 3.3): how much of the graph carries claim-version
 * data (valid_from/valid_to windows — verified-memory ADR §2), i.e. how much of it can
 * answer as-of queries. `versioned` is null when the store could not answer (unknown is
 * reported as unknown, never as zero — same rule as TrustScorecardCoverageSchema).
 */
export const TrustScorecardTemporalSchema = z.object({
  /** Units whose current claim version carries a validity window; null = store couldn't answer. */
  versioned: z.number().int().nonnegative().nullable(),
  units: z.number().int().nonnegative(),
  /** % of units with temporal coverage (integer 0–100); null when versioned is unknown. */
  pct: z.number().min(0).max(100).nullable()
});
export type TrustScorecardTemporal = z.infer<typeof TrustScorecardTemporalSchema>;

export const ConnectTrustScorecardSchema = z.object({
  schema_version: z.literal(CONNECT_TRUST_SCORECARD_SCHEMA_VERSION),
  /** When this scorecard was computed (ISO 8601). */
  generated_at: z.string(),
  /** Which graph store the scorecard was read from. */
  store: z.enum(['postgres', 'surreal']),
  units: z.number().int().nonnegative(),
  relations: z.number().int().nonnegative(),
  /** kg-audit trust score v1 (0–100). */
  trust_score: z.number().min(0).max(100),
  /** Human-readable formula statement (TRUST_SCORE_FORMULA) for auditability. */
  trust_formula: z.string(),
  /** Weighted factor attainment — the "what lowered this score" breakdown. */
  score_factors: z.array(TrustScorecardFactorSchema),
  /** G2 validation breakdown (ok/weak/unsupported + percentages). */
  g2: ConnectEvalG2Schema,
  /** The published quality bar the graph is judged against (ok ≥ 90%, unsupported ≤ 2%). */
  targets: ConnectEvalTargetsSchema,
  embedding: z.object({
    embedded: z.number().int().nonnegative(),
    units: z.number().int().nonnegative(),
    /** Embedding coverage as integer percent of units (0–100). */
    pct: z.number().min(0).max(100)
  }),
  /** EBV Layer-1 evidence binding breakdown (% evidence-bound). */
  evidence: TrustScorecardEvidenceSchema,
  /** Per-EBV-state unit counts (supported|inferred|unverified|contradicted|excluded). */
  verification_states: VerifiedClaimSummarySchema,
  coverage: TrustScorecardCoverageSchema,
  /**
   * Temporal-validity coverage (Stage 3.3, additive): % of the graph with claim-version
   * rows — the share of the graph that can answer as-of retrieval. Optional so payloads
   * produced before Stage 3.3 still validate (schema_version unchanged).
   */
  temporal: TrustScorecardTemporalSchema.optional(),
  /**
   * When the graph was last verified: the latest EBV entailment judgment timestamp,
   * falling back to the latest completed run's quality assessment. Null when neither
   * exists (e.g. imported graph never validated).
   */
  last_verified_at: z.string().nullable()
});
export type ConnectTrustScorecard = z.infer<typeof ConnectTrustScorecardSchema>;

/** GET /connect/v1/graph/scorecard response envelope. */
export const ConnectTrustScorecardResponseSchema = z.object({
  contract_version: ConnectApiContractVersionSchema,
  /** Null when the workspace's active graph has no units yet (nothing to score). */
  scorecard: ConnectTrustScorecardSchema.nullable()
});
export type ConnectTrustScorecardResponse = z.infer<typeof ConnectTrustScorecardResponseSchema>;
