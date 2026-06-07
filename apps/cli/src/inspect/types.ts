/**
 * types — the renderer-facing shapes produced by inspect. Decoupled from
 * graphrag-core internals so the renderers (pretty/json/markdown) and the
 * watch differ only depend on this module.
 */
import type { VerificationCategory } from "@restormel/graphrag-core";

export type FilterReasonCode = "unsupported" | "below-threshold" | "excluded-category";

/** A single claim as the CLI presents it (retrieved or filtered). */
export interface ClaimView {
  claimId: string;
  claimText: string;
  sourceRef: string;
  category: VerificationCategory;
  verificationState: string;
  confidenceScore: number;
  trustScore: number;
  hopDepth: number;
  via: string;
  /** Set on admitted weak claims to explain why they were included. */
  note?: string;
  /** Set on filtered claims: the human-readable filter reason. */
  filterReason?: string;
  filterReasonCode?: FilterReasonCode;
}

export interface TraceSummary {
  seedCount: number;
  hops: number;
  candidatesEvaluated: number;
  retrieved: number;
  filtered: number;
  tokensUsed: number;
  tokenBudget: number;
  nodesDropped: number;
  truncated: boolean;
}

export interface InspectResult {
  query: string;
  workspace?: string;
  domain?: string;
  policyLabel: string;
  wouldRetrieve: ClaimView[];
  filteredOut: ClaimView[];
  traceSummary: TraceSummary;
}

/** Normalised options shared by all inspect entry points. */
export interface InspectOptions {
  includeWeak: boolean;
  includeUnsupported: boolean;
  depth: number;
  maxTokens: number;
  showFiltered: boolean;
  seed?: string;
  minTrustScore?: number;
}
