import { describe, expect, it } from "vitest";
import {
  RetrievalOrchestrator,
  philosophyRetrievalConfig,
  type GraphRagDeps,
  type GraphStore,
} from "../index.js";

/**
 * Phase 4 — causal/temporal reasoning modes re-weight edge priors. The seed c1 has a
 * semantic neighbour (cS via `supports`) and a causal neighbour (cC via `depends_on`).
 * In semantic mode `supports` (prior 1.04) outranks `depends_on` (0.92); in causal mode
 * the depends_on prior is boosted and cC is surfaced ahead of cS.
 */

const claimsById: Record<string, { id: string; text: string; claim_type: string }> = {
  "claim:c1": { id: "claim:c1", text: "Central thesis", claim_type: "thesis" },
  "claim:cS": { id: "claim:cS", text: "Semantic support", claim_type: "premise" },
  "claim:cC": { id: "claim:cC", text: "Causal dependency", claim_type: "premise" },
};

const EDGES = [
  { table: "supports", in: "claim:cS", out: "claim:c1" },
  { table: "depends_on", in: "claim:c1", out: "claim:cC" },
];

const graphClaim = (id: string) => ({
  ...claimsById[id],
  domain: "ethics",
  confidence: 0.8,
  position_in_source: 0,
  review_state: undefined,
  verification_state: "validated",
  trust_score: 85,
  source: { id: `source:${id}`, title: `Source ${id}`, author: ["A"] },
});

const seedRow = () => ({
  id: "claim:c1",
  text: "Central thesis",
  claim_type: "thesis",
  domain: "ethics",
  confidence: 0.9,
  embedding: [1, 0, 0],
  position_in_source: 0,
  review_state: undefined,
  verification_state: "validated",
  trust_score: 90,
  section_context: null,
  source_id: "source:claim:c1",
  source_url: null,
  source_source_type: null,
  source_title: "Source c1",
  source_author: ["A"],
});

const tableOf = (sql: string) => sql.match(/FROM\s+(\w+)/)?.[1];

function makeStore(): GraphStore {
  return {
    async query<T>(sql: string): Promise<T> {
      const out = (rows: unknown[]): T => rows as unknown as T;
      if (sql.includes("count() AS count")) return out([{ count: 0 }]);
      if (sql.includes("FROM passage")) return out([{ id: "passage:1" }]);
      if (sql.includes("WHERE embedding <")) return out([seedRow()]);
      if (sql.includes("AS in_claim")) {
        const t = tableOf(sql);
        return out(
          EDGES.filter((e) => e.table === t).map((e) => ({
            in: e.in,
            out: e.out,
            in_claim: graphClaim(e.in),
            out_claim: graphClaim(e.out),
          }))
        );
      }
      if (sql.includes("AS relation_type")) {
        const t = tableOf(sql);
        return out(EDGES.filter((e) => e.table === t).map((e) => ({ in: e.in, out: e.out })));
      }
      if (sql.includes("AS arg_id")) return out([]);
      return out([]);
    },
    isDatabaseUnavailable() {
      return false;
    },
  };
}

const orchestrator = () =>
  new RetrievalOrchestrator(philosophyRetrievalConfig, {
    store: makeStore(),
    embedder: { embedQuery: async () => [1, 0, 0] },
    resolveOriginBucket: () => "other",
  } satisfies GraphRagDeps);

const indexOf = (ids: string[], id: string) => ids.indexOf(id);

describe("reasoning modes", () => {
  it("semantic mode ranks the supports neighbour ahead of the depends_on neighbour", async () => {
    const result = await orchestrator().findRelevantSubgraph({
      topic: "thesis",
      reasoningMode: "semantic",
      maxNodes: 10,
    });
    const ids = result.subgraph.claims.map((c) => c.id);
    expect(ids).toContain("claim:cS");
    expect(ids).toContain("claim:cC");
    expect(indexOf(ids, "claim:cS")).toBeLessThan(indexOf(ids, "claim:cC"));
  });

  it("causal mode surfaces the causal-classed edge ahead of the semantic one", async () => {
    const result = await orchestrator().findRelevantSubgraph({
      topic: "thesis",
      reasoningMode: "causal",
      maxNodes: 10,
    });
    const ids = result.subgraph.claims.map((c) => c.id);
    expect(result.trace.reasoning_mode).toBe("causal");
    expect(indexOf(ids, "claim:cC")).toBeLessThan(indexOf(ids, "claim:cS"));
  });
});
