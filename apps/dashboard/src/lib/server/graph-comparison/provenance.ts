/**
 * Map a graphrag-core RetrievalResult into the client-facing provenance summary
 * (claim list with SUPPORTED/WEAK badges + a human-readable retrieval trace).
 */
import type { RetrievalResult } from "@restormel/graphrag-core";
import type {
  ProvenanceClaim,
  RetrievalSummary,
  RetrievalTrace,
} from "$lib/connect/graph-comparison-types";

export function toRetrievalSummary(result: RetrievalResult): RetrievalSummary {
  const claims: ProvenanceClaim[] = result.claims.map((claim) => ({
    id: claim.id,
    text: claim.text,
    sourceTitle: claim.source_title || "Untitled source",
    verification: claim.verification_category === "supported" ? "supported" : "weak",
    trustScore: typeof claim.trust_score === "number" ? claim.trust_score : null,
  }));

  const trace: RetrievalTrace = {
    traversalType: result.trace?.traversal_mode ?? "hybrid graph traversal",
    hops: result.trace?.traversal_max_hops ?? 0,
    seedCount: result.seed_claim_ids.length,
    claimCount: result.claims.length,
  };

  return { claims, trace };
}
