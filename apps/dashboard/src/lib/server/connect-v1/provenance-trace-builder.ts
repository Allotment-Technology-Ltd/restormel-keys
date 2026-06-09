/**
 * Builds a versioned {@link ProvenanceTrace} from an orchestrator retrieval result (Stage 4B).
 *
 * Pure and dependency-free (no DB, no env) so it is unit-testable in isolation. The orchestrator
 * preserves the full engine trace on `OrchestratorResult.retrieval_trace`; this maps that plus the
 * curated subgraph into the structured, exportable audit document.
 */
import {
  PROVENANCE_TRACE_SCHEMA_VERSION,
  truncateClaimText,
  type ClaimTrace,
  type ExpansionHop,
  type ProvenanceTrace,
  type SeedRecord,
} from "@restormel/contracts/provenance-trace";
import type { OrchestratorResult, RetrievalResult, VerificationPolicy } from "@restormel/graphrag-core";

/** Human-readable reasons for the engine's claim-level rejection codes. */
const EXCLUSION_REASON: Record<string, string> = {
  seed_pool_pruned: "seed pool pruned (lower-ranked seed)",
  duplicate_traversal: "duplicate (already traversed)",
  confidence_gate: "below confidence threshold",
  source_integrity_gate: "failed source integrity gate",
};

export interface BuildProvenanceTraceInput {
  traceId: string;
  query: string;
  workspaceId: string;
  domainPack: string;
  graphStoreType: string;
  queriedAt: string;
  /** The verification policy actually applied to the query (may be undefined → defaults shown). */
  verificationPolicy?: VerificationPolicy;
  /** Token budget the query ran under (0 when uncapped). */
  tokenBudget: number;
  result: OrchestratorResult;
  timing: { seedMs: number; expansionMs: number; rankingMs: number; totalMs: number };
}

export function buildProvenanceTrace(input: BuildProvenanceTraceInput): ProvenanceTrace {
  const { result } = input;
  const engineTrace = result.retrieval_trace;
  const orchTrace = result.trace;

  const claims = result.subgraph.claims;
  const relations = result.subgraph.relations;
  const seedIds = new Set(result.subgraph.seed_claim_ids);

  // Index → claim id, so edge_path can be reconstructed from the relations' from/to indices.
  const textById = new Map<string, string>();
  for (const c of claims) textById.set(c.id, c.text);

  // ── Seeds ──
  const seedTraces = engineTrace?.seed_claims ?? [];
  const seeds: SeedRecord[] = seedTraces.map((s) => ({
    claim_id: s.id,
    claim_text: truncateClaimText(textById.get(s.id) ?? ""),
    source_ref: s.source_title || null,
    claim_type: s.claim_type ?? null,
    domain: s.domain ?? null,
    confidence_score: typeof s.confidence === "number" ? s.confidence : null,
  }));

  // ── Expansion (single summarising band; engine does not expose per-hop deltas yet) ──
  const maxHops = engineTrace?.traversal_max_hops ?? orchTrace.hops ?? 0;
  const edgeTypes = Object.keys(engineTrace?.traversal_edge_priors ?? {});
  const traversedClaims = Math.max(0, (engineTrace?.traversed_claim_count ?? claims.length) - seedIds.size);
  const expansion: ExpansionHop[] =
    maxHops > 0
      ? [
          {
            depth: maxHops,
            claims_traversed: traversedClaims,
            relations_traversed: engineTrace?.relation_kept_count ?? relations.length,
            edge_types: edgeTypes,
          },
        ]
      : [];

  // ── Per-claim verdicts: included (in subgraph) + excluded (engine-rejected) ──
  const includedClaims: ClaimTrace[] = claims.map((c, index) => ({
    claim_id: c.id,
    claim_text: truncateClaimText(c.text),
    source_ref: c.source_title || null,
    verification_state: c.verification_state ?? null,
    trust_score: typeof c.trust_score === "number" ? c.trust_score : null,
    confidence_score: typeof c.confidence === "number" ? c.confidence : null,
    included: true,
    hop_depth: seedIds.has(c.id) ? 0 : 1,
    edge_path: seedIds.has(c.id) ? [] : edgePathForIndex(index, relations),
  }));

  const rejected = engineTrace?.rejected_claims ?? [];
  const excludedClaims: ClaimTrace[] = rejected.map((r) => ({
    claim_id: r.id,
    claim_text: truncateClaimText(r.text ?? ""),
    source_ref: r.source_title || null,
    verification_state: null,
    trust_score: null,
    confidence_score: typeof r.confidence === "number" ? r.confidence : null,
    included: false,
    exclusion_reason: EXCLUSION_REASON[r.reason_code] ?? r.reason_code,
    hop_depth: r.considered_in === "seed_pool" ? 0 : 1,
    edge_path: [],
  }));

  // ── Verification policy actually in force ──
  const appliedPolicy = orchTrace.verification?.policy;
  const includedStates = appliedPolicy?.include ?? input.verificationPolicy?.include ?? ["supported"];
  const verification_policy = {
    included_states: includedStates,
    min_trust_score: input.verificationPolicy?.minTrustScore ?? 0,
    excluded_flagged:
      appliedPolicy?.exclude_flagged ?? input.verificationPolicy?.excludeFlagged ?? false,
  };

  return {
    schema_version: PROVENANCE_TRACE_SCHEMA_VERSION,
    trace_id: input.traceId,
    query: input.query,
    workspace_id: input.workspaceId,
    domain_pack: input.domainPack,
    graph_store_type: input.graphStoreType,
    queried_at: input.queriedAt,
    verification_policy,
    seeds,
    expansion,
    result: {
      claims_retrieved: includedClaims.length,
      claims_filtered: excludedClaims.length,
      tokens_used: orchTrace.tokens_used,
      token_budget: input.tokenBudget,
      truncated: orchTrace.nodes_dropped > 0,
    },
    claims: [...includedClaims, ...excludedClaims],
    timing: {
      seed_ms: input.timing.seedMs,
      expansion_ms: input.timing.expansionMs,
      ranking_ms: input.timing.rankingMs,
      total_ms: input.timing.totalMs,
    },
  };
}

/**
 * Build a provenance trace from a raw engine {@link RetrievalResult} (the "Proof" comparison
 * panel calls graphrag-core directly rather than through the orchestrator). Synthesises the
 * orchestrator envelope so both paths emit one identical trace format.
 */
export function buildProvenanceTraceFromRetrieval(
  input: Omit<BuildProvenanceTraceInput, "result"> & { retrieval: RetrievalResult },
): ProvenanceTrace {
  const { retrieval, ...rest } = input;
  const synthetic: OrchestratorResult = {
    context_block: "",
    subgraph: {
      claims: retrieval.claims,
      relations: retrieval.relations,
      arguments: retrieval.arguments,
      seed_claim_ids: retrieval.seed_claim_ids,
    },
    retrieval_trace: retrieval.trace,
    trace: {
      operation: "retrieve_context",
      seed_count: retrieval.seed_claim_ids.length,
      hops: retrieval.trace?.traversal_max_hops ?? 0,
      claim_count: retrieval.claims.length,
      relation_count: retrieval.relations.length,
      tokens_used: 0,
      nodes_dropped: 0,
      verification: retrieval.trace?.verification_summary,
      degraded: retrieval.degraded,
      degraded_reason: retrieval.degraded_reason,
    },
  };
  return buildProvenanceTrace({ ...rest, result: synthetic });
}

/** Edge types of relations incident to a claim (best-effort path within the returned subgraph). */
function edgePathForIndex(
  index: number,
  relations: OrchestratorResult["subgraph"]["relations"],
): string[] {
  const types = new Set<string>();
  for (const r of relations) {
    if (r.from_index === index || r.to_index === index) types.add(r.relation_type);
  }
  return [...types];
}
