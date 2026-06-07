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
  | { type: "delta"; text: string }
  | { type: "complete"; text: string }
  | { type: "error"; message: string };

export type ChatRouteOption = {
  id: string;
  name: string;
  model: string | null;
  provider: string | null;
};
