import { describe, it, expect } from "vitest";
import { ProvenanceTraceSchema } from "@restormel/contracts/provenance-trace";
import type { OrchestratorResult } from "@restormel/graphrag-core";
import { buildProvenanceTrace } from "./provenance-trace-builder.js";

function makeResult(): OrchestratorResult {
  const claims = [
    {
      id: "claim:seed",
      text: "Seed claim text",
      claim_type: "thesis",
      domain: "philosophy",
      source_title: "Source A",
      source_author: [],
      confidence: 0.9,
      position_in_source: 0,
      verification_state: "validated",
      trust_score: 88,
      verification_category: "supported" as const,
    },
    {
      id: "claim:hop",
      text: "x".repeat(250), // exceeds the 200-char truncation limit
      claim_type: "evidence",
      domain: "philosophy",
      source_title: "Source B",
      source_author: [],
      confidence: 0.7,
      position_in_source: 1,
      verification_state: null,
      trust_score: null,
      verification_category: "weak" as const,
    },
  ];
  return {
    context_block: "block",
    subgraph: {
      claims,
      relations: [{ from_index: 0, to_index: 1, relation_type: "supports" }],
      arguments: [],
      seed_claim_ids: ["claim:seed"],
    },
    retrieval_trace: {
      seed_pool_count: 3,
      selected_seed_count: 1,
      traversal_max_hops: 2,
      traversal_edge_priors: { supports: 1.2, contradicts: 0.8 },
      traversed_claim_count: 2,
      relation_candidate_count: 2,
      relation_kept_count: 1,
      argument_candidate_count: 0,
      argument_kept_count: 0,
      seed_claims: [
        { id: "claim:seed", claim_type: "thesis", domain: "philosophy", source_title: "Source A", confidence: 0.9 },
      ],
      rejected_claims: [
        {
          id: "claim:rejected",
          text: "Rejected claim",
          source_title: "Source C",
          confidence: 0.2,
          reason_code: "confidence_gate",
          considered_in: "traversal",
        },
      ],
    },
    trace: {
      operation: "retrieve_context",
      seed_count: 1,
      hops: 2,
      claim_count: 2,
      relation_count: 1,
      tokens_used: 120,
      nodes_dropped: 1,
      verification: {
        policy: { include: ["supported", "weak"], exclude_flagged: true },
        included: { supported: 1, weak: 1, unsupported: 0 },
        excluded: { supported: 0, weak: 0, unsupported: 2 },
      },
    },
  } as unknown as OrchestratorResult;
}

describe("buildProvenanceTrace", () => {
  const trace = buildProvenanceTrace({
    traceId: "trace-123",
    query: "what is virtue?",
    workspaceId: "ws-1",
    domainPack: "philosophy",
    graphStoreType: "surreal",
    queriedAt: "2026-06-08T00:00:00.000Z",
    verificationPolicy: { include: ["supported", "weak"], minTrustScore: 50, excludeFlagged: true },
    tokenBudget: 2000,
    result: makeResult(),
    timing: { seedMs: 0, expansionMs: 0, rankingMs: 0, totalMs: 42 },
  });

  it("is a valid ProvenanceTrace document", () => {
    expect(() => ProvenanceTraceSchema.parse(trace)).not.toThrow();
    expect(trace.schema_version).toBe("1.0");
    expect(trace.trace_id).toBe("trace-123");
  });

  it("maps seeds with text resolved from the subgraph", () => {
    expect(trace.seeds).toHaveLength(1);
    expect(trace.seeds[0]).toMatchObject({ claim_id: "claim:seed", source_ref: "Source A", confidence_score: 0.9 });
  });

  it("truncates claim text to 200 characters", () => {
    const hop = trace.claims.find((c) => c.claim_id === "claim:hop");
    expect(hop?.claim_text).toHaveLength(200);
  });

  it("records included claims with hop depth and edge path", () => {
    const seed = trace.claims.find((c) => c.claim_id === "claim:seed");
    const hop = trace.claims.find((c) => c.claim_id === "claim:hop");
    expect(seed).toMatchObject({ included: true, hop_depth: 0, edge_path: [] });
    expect(hop).toMatchObject({ included: true, hop_depth: 1, edge_path: ["supports"] });
  });

  it("records excluded claims with a human-readable reason", () => {
    const rejected = trace.claims.find((c) => c.claim_id === "claim:rejected");
    expect(rejected).toMatchObject({ included: false, exclusion_reason: "below confidence threshold" });
  });

  it("summarises the result and expansion band", () => {
    expect(trace.result).toMatchObject({
      claims_retrieved: 2,
      claims_filtered: 1,
      tokens_used: 120,
      token_budget: 2000,
      truncated: true,
    });
    expect(trace.expansion).toHaveLength(1);
    expect(trace.expansion[0]).toMatchObject({ depth: 2, relations_traversed: 1 });
    expect(trace.expansion[0].edge_types).toContain("supports");
  });

  it("reflects the applied verification policy", () => {
    expect(trace.verification_policy).toMatchObject({
      included_states: ["supported", "weak"],
      min_trust_score: 50,
      excluded_flagged: true,
    });
  });
});
