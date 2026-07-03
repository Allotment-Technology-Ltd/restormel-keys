/**
 * renderer-json — machine-readable, pipe-friendly output. Emits the raw claim
 * arrays plus a trace_summary object. No colour codes.
 */
import type { ClaimView, InspectResult } from "./types.js";

function claimToJson(claim: ClaimView): Record<string, unknown> {
  return {
    claim_id: claim.claimId,
    claim_text: claim.claimText,
    source_ref: claim.sourceRef,
    category: claim.category,
    verification_state: claim.verificationState,
    confidence_score: claim.confidenceScore,
    trust_score: claim.trustScore,
    hop_depth: claim.hopDepth,
    via: claim.via,
    ...(claim.note ? { note: claim.note } : {}),
    ...(claim.filterReason ? { filter_reason: claim.filterReason } : {}),
    ...(claim.filterReasonCode ? { filter_reason_code: claim.filterReasonCode } : {}),
  };
}

export function renderJson(result: InspectResult): string {
  const t = result.traceSummary;
  return JSON.stringify(
    {
      query: result.query,
      workspace: result.workspace ?? null,
      domain: result.domain ?? null,
      policy: result.policyLabel,
      would_retrieve: result.wouldRetrieve.map(claimToJson),
      filtered_out: result.filteredOut.map(claimToJson),
      trace_summary: {
        seed_count: t.seedCount,
        hops: t.hops,
        candidates_evaluated: t.candidatesEvaluated,
        retrieved: t.retrieved,
        filtered: t.filtered,
        tokens_used: t.tokensUsed,
        token_budget: t.tokenBudget,
        nodes_dropped: t.nodesDropped,
        truncated: t.truncated,
      },
    },
    null,
    2,
  );
}
