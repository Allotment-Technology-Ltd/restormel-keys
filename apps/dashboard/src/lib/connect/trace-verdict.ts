/**
 * Phase 3 Stage 5 (Traces) — derive the SAME trust verdict the Answer Console shows,
 * but from a persisted {@link ProvenanceTrace} rather than the live retrieval summary.
 *
 * Cohesion is the whole point: a trace row must map back to the console's notion of a
 * verified answer, so the two surfaces share ONE verdict vocabulary. The console derives
 * `grounded | uncertain | abstained` from the retrieved claims (`deriveAnswerVerdict` in
 * graph-comparison-types.ts); this derives the identical verdict from the claims the trace
 * stored — only the input shape differs.
 *
 * Pure + shared (no server-only imports): the page renders it, tests assert on it.
 */
import type { AnswerVerdict } from "$lib/connect/graph-comparison-types";

/** The subset of a persisted ClaimTrace this derivation needs. */
export type TraceClaimLike = {
  /** Raw engine verification state, e.g. "validated" | "weak" | "flagged" | null. */
  verification_state: string | null;
  /**
   * Trust category the engine derived ("supported" | "weak" | "unsupported" | …). This is the
   * field the Answer Console keys its verdict off; prefer it. Older traces predate it and
   * carry only the raw state — see {@link isSupportedClaim} for the fallback.
   */
  verification_category?: string | null;
  /** True when the claim appears in the returned context (vs filtered out). */
  included: boolean;
};

/**
 * Raw verification states that the engine classifies as "supported" (high trust). Used only as
 * a fallback for legacy traces stored before `verification_category` was persisted. Mirrors the
 * Postgres-spine mapping (validation_status "validated" → category "supported").
 */
const SUPPORTED_RAW_STATES = new Set(["validated", "supported"]);

/**
 * A claim is strongly verified ("supported") iff its canonical category says so. For legacy
 * traces with no category, fall back to the raw state. This keeps the Traces verdict identical
 * to the console's, which uses `verification === "supported"`.
 */
function isSupportedClaim(c: TraceClaimLike): boolean {
  if (c.verification_category != null) return c.verification_category === "supported";
  return c.verification_state != null && SUPPORTED_RAW_STATES.has(c.verification_state);
}

export type TraceVerdictSummary = {
  verdict: AnswerVerdict;
  label: string;
  /** Count of supported, included claims (the source-bound ones). */
  supportedCount: number;
  /** Count of weaker/contested included claims. */
  weakCount: number;
  /** Total included claims (the answer's actual evidence). */
  totalIncluded: number;
  /** True when the graph honestly declined — a designed state, flagged distinctly. */
  abstained: boolean;
};

/**
 * Mirrors {@link deriveAnswerVerdict}: the answer is graph-grounded only when verified
 * (supported) claims were *included* in the returned context.
 *  - abstained — no included claim (the graph declined). A first-class state, not a failure.
 *  - uncertain — included claims exist but some are weaker than "supported".
 *  - grounded  — every included claim is "supported".
 *
 * "supported" is the console's strong-verification vocabulary; the comparison panel maps
 * the engine's verification_state to `supported`/`weak` the same way (provenance.ts), so a
 * non-"supported" included claim counts as weak here too.
 */
export function deriveTraceVerdict(claims: readonly TraceClaimLike[]): TraceVerdictSummary {
  const included = claims.filter((c) => c.included);
  const supportedCount = included.filter(isSupportedClaim).length;
  const weakCount = included.length - supportedCount;

  if (included.length === 0) {
    return {
      verdict: "abstained",
      label: "Insufficient evidence — abstained",
      supportedCount: 0,
      weakCount: 0,
      totalIncluded: 0,
      abstained: true,
    };
  }
  if (weakCount > 0) {
    return {
      verdict: "uncertain",
      label: "Some uncertainty",
      supportedCount,
      weakCount,
      totalIncluded: included.length,
      abstained: false,
    };
  }
  return {
    verdict: "grounded",
    label: "Grounded",
    supportedCount,
    weakCount: 0,
    totalIncluded: included.length,
    abstained: false,
  };
}

/** Distinct cited sources among the included claims (the source-card count for a trace row). */
export function citedSourceTitles(
  claims: readonly { source_ref: string | null; included: boolean }[],
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const c of claims) {
    if (!c.included) continue;
    const ref = c.source_ref?.trim();
    if (!ref || seen.has(ref)) continue;
    seen.add(ref);
    out.push(ref);
  }
  return out;
}
