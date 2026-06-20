/**
 * Shared (client + server safe) types for the "Proof" graph-comparison panel.
 * No server-only imports here — components import these directly.
 */

export type ComparisonPanelMode = "raw" | "graph";

export type SuggestedQuestionType = "A" | "B" | "C" | "D" | "E" | "generic";

export type SuggestedQuestion = {
  id: string;
  question: string;
  type: SuggestedQuestionType;
  /** Claim ids used as starting seeds for graph expansion when this question is run. */
  seedNodeIds: string[];
};

export type ProvenanceVerification = "supported" | "weak";

export type ProvenanceClaim = {
  id: string;
  text: string;
  sourceTitle: string;
  verification: ProvenanceVerification;
  /** 0–100 when the graph supplies one. */
  trustScore: number | null;
};

export type RetrievalTrace = {
  traversalType: string;
  hops: number;
  seedCount: number;
  claimCount: number;
};

export type RetrievalSummary = {
  claims: ProvenanceClaim[];
  trace: RetrievalTrace;
};

/**
 * The two-layer trust verdict shown above an answer (Phase 3 Stage 1).
 * Every label is backed by the retrieved claims — no quality word is unearned.
 *  - `grounded`     — verified claims were retrieved; the answer is source-bound.
 *  - `uncertain`    — claims were retrieved but some are weak/contested.
 *  - `abstained`    — no verified claim matched; the graph honestly declined.
 */
export type AnswerVerdict = "grounded" | "uncertain" | "abstained";

export type AnswerVerdictSummary = {
  verdict: AnswerVerdict;
  label: string;
  /** Short, true description of why this verdict — shown under the badge. */
  detail: string;
  supportedCount: number;
  weakCount: number;
  totalClaims: number;
};

/**
 * Derive the verdict from a retrieval summary. Pure + shared (client renders it,
 * server can assert on it). Abstention (zero claims) is a designed state.
 */
export function deriveAnswerVerdict(
  retrieval: Pick<RetrievalSummary, "claims"> | null,
): AnswerVerdictSummary {
  const claims = retrieval?.claims ?? [];
  const supportedCount = claims.filter((c) => c.verification === "supported").length;
  const weakCount = claims.length - supportedCount;

  if (claims.length === 0) {
    return {
      verdict: "abstained",
      label: "Insufficient evidence — abstained",
      detail: "Your sources don't cover this, so Restormel won't answer rather than guess. That refusal is the feature.",
      supportedCount: 0,
      weakCount: 0,
      totalClaims: 0,
    };
  }
  if (weakCount > 0) {
    return {
      verdict: "uncertain",
      label: "Some uncertainty",
      detail: `${supportedCount} supported, ${weakCount} weaker ${weakCount === 1 ? "claim" : "claims"} — click through to the quotes and judge it yourself before you ship.`,
      supportedCount,
      weakCount,
      totalClaims: claims.length,
    };
  }
  return {
    verdict: "grounded",
    label: "Grounded",
    detail: `Every claim is backed by your sources — click any one to the exact quote it came from (${supportedCount} verified ${supportedCount === 1 ? "claim" : "claims"}).`,
    supportedCount,
    weakCount: 0,
    totalClaims: claims.length,
  };
}

export type QualityVerdict = "significant" | "moderate" | "minimal";

export type QualityDelta = {
  additional_specificity: string;
  contradictions: string | null;
  hedging_resolved: string | null;
  provenance_count: number;
  verdict: QualityVerdict;
};

/** SSE events emitted by `/connect/proof/api/stream`. */
export type ComparisonStreamEvent =
  | { type: "model"; provider: string; model: string }
  | { type: "retrieval"; summary: RetrievalSummary }
  | { type: "trace"; traceId: string; exportUrl: string }
  | { type: "delta"; text: string }
  | { type: "complete"; text: string }
  | { type: "error"; message: string };

export type ChatRouteOption = {
  id: string;
  name: string;
  model: string | null;
  provider: string | null;
};
