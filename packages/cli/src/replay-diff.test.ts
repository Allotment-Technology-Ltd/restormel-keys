import { describe, it, expect } from "vitest";
import type { ProvenanceTrace } from "@restormel/contracts/provenance-trace";
import type { ConnectGraphOpResponse } from "@restormel/contracts/connect";
import {
  buildReplayRequest,
  computeReplayDiff,
  currentClaimsFromResponse,
  originalClaimsFromTrace,
  policyFromTrace,
} from "./replay-diff.js";
import { renderJson, renderMarkdown, renderPretty } from "./replay-format.js";

function trace(overrides: Partial<ProvenanceTrace> = {}): ProvenanceTrace {
  return {
    schema_version: "1.0",
    trace_id: "t-1",
    query: "what are the arguments for utilitarianism?",
    workspace_id: "ws-1",
    domain_pack: "philosophy",
    graph_store_type: "surreal",
    queried_at: "2026-06-01T14:23:11.000Z",
    verification_policy: { included_states: ["supported", "weak"], min_trust_score: 40, excluded_flagged: true },
    seeds: [],
    expansion: [{ depth: 2, claims_traversed: 2, relations_traversed: 1, edge_types: ["supports"] }],
    result: { claims_retrieved: 3, claims_filtered: 0, tokens_used: 100, token_budget: 1500, truncated: false },
    claims: [
      { claim_id: "c-stable", claim_text: "Utilitarianism holds the right action maximises welfare", source_ref: "S1", verification_state: "validated", trust_score: 91, confidence_score: 0.9, included: true, hop_depth: 0, edge_path: [] },
      { claim_id: "c-changed", claim_text: "Mill distinguished higher and lower pleasures", source_ref: "S2", verification_state: "validated", trust_score: 84, confidence_score: 0.84, included: true, hop_depth: 1, edge_path: ["supports"] },
      { claim_id: "c-removed", claim_text: "Bentham's hedonic calculus", source_ref: "S3", verification_state: "validated", trust_score: 79, confidence_score: 0.79, included: true, hop_depth: 1, edge_path: ["supports"] },
    ],
    timing: { seed_ms: 0, expansion_ms: 0, ranking_ms: 0, total_ms: 30 },
    ...overrides,
  };
}

function response(): ConnectGraphOpResponse {
  return {
    contract_version: "2026-06-01",
    request_id: "r-1",
    operation: "retrieve_context",
    subgraph: {
      claims: [
        // stable: same verification state
        { id: "c-stable", text: "Utilitarianism holds the right action maximises welfare", claim_type: "thesis", domain: "philosophy", source_title: "S1", source_author: [], confidence: 0.9, position_in_source: 0, verification_state: "validated", trust_score: 92, verification_category: "supported" },
        // changed: verification state moved validated -> flagged
        { id: "c-changed", text: "Mill distinguished higher and lower pleasures", claim_type: "evidence", domain: "philosophy", source_title: "S2", source_author: [], confidence: 0.61, position_in_source: 1, verification_state: "flagged", trust_score: 61, verification_category: "weak" },
        // new
        { id: "c-new", text: "Preference utilitarianism extends the classical view", claim_type: "evidence", domain: "philosophy", source_title: "S4", source_author: [], confidence: 0.88, position_in_source: 2, verification_state: "validated", trust_score: 88, verification_category: "supported" },
      ],
      relations: [],
      arguments: [],
      seed_claim_ids: ["c-stable"],
    },
    trace: {
      operation: "retrieve_context",
      seed_count: 1,
      hops: 2,
      claim_count: 3,
      relation_count: 0,
      tokens_used: 90,
      nodes_dropped: 0,
    },
    metadata: {},
  };
}

describe("computeReplayDiff", () => {
  const diff = computeReplayDiff(originalClaimsFromTrace(trace()), currentClaimsFromResponse(response()));

  it("classifies stable / changed / removed / new", () => {
    expect(diff.stable.map((d) => d.claim_id)).toEqual(["c-stable"]);
    expect(diff.changed.map((d) => d.claim_id).sort()).toEqual(["c-changed", "c-removed"]);
    expect(diff.added.map((d) => d.claim_id)).toEqual(["c-new"]);
  });

  it("counts changed as verification-changed plus removed", () => {
    expect(diff.counts).toMatchObject({ stable: 1, changed: 2, removed: 1, new: 1, originalTotal: 3, currentTotal: 3 });
  });

  it("marks the removed claim with status removed", () => {
    const removed = diff.changed.find((d) => d.claim_id === "c-removed");
    expect(removed?.status).toBe("removed");
  });

  it("flags significant drift above 50%", () => {
    // 2 of 3 original claims changed → 66%
    expect(diff.significantDrift).toBe(true);
    expect(Math.round(diff.driftRatio * 100)).toBe(67);
  });

  it("reports no drift when everything is stable", () => {
    const same = computeReplayDiff(
      originalClaimsFromTrace(trace()),
      originalClaimsFromTrace(trace()),
    );
    expect(same.counts.changed).toBe(0);
    expect(same.significantDrift).toBe(false);
  });
});

describe("buildReplayRequest", () => {
  it("rebuilds a retrieve_context request preserving policy, depth, and budget", () => {
    const req = buildReplayRequest(trace(), { workspaceId: "ws-1", projectId: "p-1" });
    expect(req).toMatchObject({
      workspace_id: "ws-1",
      project_id: "p-1",
      operation: "retrieve_context",
      query: "what are the arguments for utilitarianism?",
      max_depth: 2,
      max_tokens: 1500,
      verification_policy: { include: ["supported", "weak"], min_trust_score: 40, exclude_flagged: true },
    });
  });

  it("rebuilds an expand_context request from seeds when there is no query", () => {
    const seeded = trace({
      query: "",
      seeds: [
        { claim_id: "seed-1", claim_text: "x", source_ref: null, claim_type: null, domain: null, confidence_score: null },
      ],
    });
    const req = buildReplayRequest(seeded, { workspaceId: "ws-1" });
    expect(req.operation).toBe("expand_context");
    expect(req).toMatchObject({ seed_node_ids: ["seed-1"], depth: 2 });
  });
});

describe("policyFromTrace", () => {
  it("filters included_states to valid categories and defaults to supported", () => {
    const p = policyFromTrace(trace({ verification_policy: { included_states: ["bogus"], min_trust_score: 0, excluded_flagged: false } }));
    expect(p).toEqual({ include: ["supported"] });
  });
});

describe("renderers", () => {
  const ctx = {
    trace: trace(),
    diff: computeReplayDiff(originalClaimsFromTrace(trace()), currentClaimsFromResponse(response())),
    replayedAt: "2026-06-06T09:11:42.000Z",
    original: originalClaimsFromTrace(trace()),
    current: currentClaimsFromResponse(response()),
  };

  it("json includes a summary and full diff arrays", () => {
    const json = JSON.parse(renderJson(ctx, { detailed: true, compare: false }));
    expect(json.summary).toMatchObject({ stable: 1, changed: 2, new: 1, significant_drift: true });
    expect(json.diff.changed).toHaveLength(2);
    expect(json.trace_id).toBe("t-1");
  });

  it("json compare adds the original and current claim sets", () => {
    const json = JSON.parse(renderJson(ctx, { detailed: false, compare: true }));
    expect(json.original_claims).toHaveLength(3);
    expect(json.current_claims).toHaveLength(3);
  });

  it("markdown shows the summary and the drift warning", () => {
    const md = renderMarkdown(ctx, { detailed: true, compare: false });
    expect(md).toContain("Restormel replay");
    expect(md).toContain("Significant drift");
    expect(md).toContain("Summary:** 1 stable · 2 changed · 1 new");
  });

  it("pretty includes the summary line and the inspect hint", () => {
    const pretty = renderPretty(ctx, { detailed: true, compare: false });
    expect(pretty).toContain("RESTORMEL REPLAY");
    expect(pretty).toContain("SUMMARY:");
    expect(pretty).toContain("keys inspect --watch");
  });
});
