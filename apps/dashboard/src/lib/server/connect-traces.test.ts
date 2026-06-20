/**
 * listProvenanceTraces — the Traces list reader (Phase 3 Stage 5).
 *
 * Asserts the summary derivation off persisted ProvenanceTrace rows: verdict (console
 * vocabulary), cited-source dedupe, the abstention/verdict filter, and the real answer model.
 * getSql is mocked to return canned rows — the SQL tag ignores interpolation here.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ProvenanceTrace } from "@restormel/contracts/provenance-trace";

const rowsRef: { rows: unknown[] } = { rows: [] };

vi.mock("$lib/server/neon", () => {
  // A tagged-template stand-in: nested sql`` fragments and the final query both call this;
  // fragments return a marker, the outer query returns the canned rows.
  const sql = (() => rowsRef.rows) as unknown as ReturnType<typeof Object>;
  return { getSql: () => sql };
});

import { listProvenanceTraces } from "./connect-traces";

function trace(over: Partial<ProvenanceTrace>): ProvenanceTrace {
  return {
    schema_version: "1.0",
    trace_id: "t",
    query: "what is virtue?",
    workspace_id: "ws-1",
    domain_pack: "philosophy",
    graph_store_type: "postgres",
    queried_at: "2026-06-08T00:00:00.000Z",
    verification_policy: { included_states: ["supported"], min_trust_score: 0, excluded_flagged: false },
    seeds: [],
    expansion: [],
    result: { claims_retrieved: 0, claims_filtered: 0, tokens_used: 0, token_budget: 0, truncated: false },
    claims: [],
    timing: { seed_ms: 0, expansion_ms: 0, ranking_ms: 0, total_ms: 0 },
    ...over,
  };
}

function row(t: ProvenanceTrace, projectId: string | null = "proj-1") {
  return {
    trace_id: t.trace_id,
    project_id: projectId,
    query: t.query,
    domain_pack: t.domain_pack,
    graph_store_type: t.graph_store_type,
    trace: t,
    queried_at: t.queried_at,
  };
}

describe("listProvenanceTraces", () => {
  beforeEach(() => {
    rowsRef.rows = [];
  });

  it("derives a grounded verdict and dedupes cited sources", async () => {
    rowsRef.rows = [
      row(
        trace({
          trace_id: "grounded-1",
          answer_model: { provider: "anthropic", model: "claude-3-5-sonnet" },
          result: { claims_retrieved: 2, claims_filtered: 1, tokens_used: 0, token_budget: 0, truncated: false },
          claims: [
            {
              claim_id: "a", claim_text: "x", source_ref: "Ethics", verification_state: "validated",
              verification_category: "supported", trust_score: 90, confidence_score: 0.9, included: true,
              hop_depth: 0, edge_path: [],
            },
            {
              claim_id: "b", claim_text: "y", source_ref: "Ethics", verification_state: "validated",
              verification_category: "supported", trust_score: 88, confidence_score: 0.8, included: true,
              hop_depth: 1, edge_path: ["supports"],
            },
          ],
        }),
      ),
    ];

    const items = await listProvenanceTraces("ws-1");
    expect(items).toHaveLength(1);
    expect(items[0].verdict.verdict).toBe("grounded");
    expect(items[0].citedSources).toEqual(["Ethics"]); // deduped
    expect(items[0].answerModel).toEqual({ provider: "anthropic", model: "claude-3-5-sonnet" });
    expect(items[0].claimsRetrieved).toBe(2);
  });

  it("flags abstentions (no included claim) and respects the verdict filter", async () => {
    rowsRef.rows = [
      row(trace({ trace_id: "grounded", claims: [
        { claim_id: "a", claim_text: "x", source_ref: "S", verification_state: "validated",
          verification_category: "supported", trust_score: 90, confidence_score: 0.9, included: true,
          hop_depth: 0, edge_path: [] },
      ] })),
      row(trace({ trace_id: "abstained", claims: [
        { claim_id: "z", claim_text: "x", source_ref: "S", verification_state: null,
          verification_category: null, trust_score: null, confidence_score: 0.2, included: false,
          hop_depth: 0, edge_path: [] },
      ] })),
    ];

    const all = await listProvenanceTraces("ws-1");
    expect(all.map((t) => t.verdict.verdict).sort()).toEqual(["abstained", "grounded"]);
    expect(all.find((t) => t.traceId === "abstained")?.verdict.abstained).toBe(true);

    const onlyAbstained = await listProvenanceTraces("ws-1", { verdict: "abstained" });
    expect(onlyAbstained).toHaveLength(1);
    expect(onlyAbstained[0].traceId).toBe("abstained");
  });

  it("leaves answerModel null when the trace did not record it", async () => {
    rowsRef.rows = [row(trace({ trace_id: "no-model", answer_model: undefined }))];
    const items = await listProvenanceTraces("ws-1");
    expect(items[0].answerModel).toBeNull();
  });
});
