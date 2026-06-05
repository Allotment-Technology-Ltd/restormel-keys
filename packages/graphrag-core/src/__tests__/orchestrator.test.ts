import { describe, expect, it } from "vitest";
import {
  RetrievalOrchestrator,
  philosophyRetrievalConfig,
  type GraphRagDeps,
  type GraphStore,
} from "../index.js";

/**
 * Phase 3 — RetrievalOrchestrator against a synthetic in-memory graph (no SurrealDB).
 * Graph:
 *   c1 (thesis)  <-supports-  c2 (premise)
 *   c1 (thesis)  <-contradicts- c3 (objection)
 *   c3 (objection) <-responds_to- c4 (reply)
 */

interface CanonicalClaim {
  id: string;
  text: string;
  claim_type: string;
}

const CLAIMS: CanonicalClaim[] = [
  { id: "claim:c1", text: "Thesis A", claim_type: "thesis" },
  { id: "claim:c2", text: "Premise supporting A", claim_type: "premise" },
  { id: "claim:c3", text: "Objection to A", claim_type: "objection" },
  { id: "claim:c4", text: "Reply to the objection", claim_type: "reply" },
];

const EDGES = [
  { table: "supports", in: "claim:c2", out: "claim:c1" },
  { table: "contradicts", in: "claim:c3", out: "claim:c1" },
  { table: "responds_to", in: "claim:c4", out: "claim:c3" },
];

const claimById = new Map(CLAIMS.map((c) => [c.id, c]));

const seedRow = (c: CanonicalClaim, embedding: number[]) => ({
  id: c.id,
  text: c.text,
  claim_type: c.claim_type,
  domain: "ethics",
  confidence: 0.9,
  embedding,
  position_in_source: 0,
  review_state: undefined,
  verification_state: "validated",
  trust_score: 90,
  section_context: null,
  source_id: `source:${c.id}`,
  source_url: null,
  source_source_type: null,
  source_title: `Source ${c.id}`,
  source_author: ["A. Author"],
});

const graphClaim = (id: string) => {
  const c = claimById.get(id)!;
  return {
    id: c.id,
    text: c.text,
    claim_type: c.claim_type,
    domain: "ethics",
    confidence: 0.9,
    position_in_source: 0,
    review_state: undefined,
    verification_state: "validated",
    trust_score: 90,
    source: { id: `source:${c.id}`, title: `Source ${c.id}`, author: ["A. Author"] },
  };
};

const tableOf = (sql: string): string | undefined => sql.match(/FROM\s+(\w+)/)?.[1];

function makeStore(): GraphStore {
  return {
    async query<T>(sql: string, vars?: Record<string, unknown>): Promise<T> {
      const out = (rows: unknown[]): T => rows as unknown as T;

      if (sql.includes("count() AS count")) return out([{ count: 0 }]);
      if (sql.includes("FROM passage")) return out([{ id: "passage:1" }]);

      // Dense vector seeds — the thesis is the strongest match.
      if (sql.includes("WHERE embedding <")) {
        return out([seedRow(claimById.get("claim:c1")!, [1, 0, 0])]);
      }

      // Forced-seed fetch (expandContext): rowProjection + id INSIDE $ids.
      if (sql.includes("source.author AS source_author") && sql.includes("id INSIDE $ids")) {
        const ids = (vars?.ids as string[]) ?? [];
        return out(
          ids
            .map((id) => claimById.get(id))
            .filter((c): c is CanonicalClaim => Boolean(c))
            .map((c) => seedRow(c, [1, 0, 0]))
        );
      }

      // findPaths neighbour lookup: SELECT in, out FROM <t> WHERE in = $node OR out = $node.
      if (sql.includes("SELECT in, out FROM") && sql.includes("WHERE in = $node")) {
        const t = tableOf(sql);
        const node = vars?.node;
        return out(
          EDGES.filter((e) => e.table === t && (e.in === node || e.out === node)).map((e) => ({
            in: e.in,
            out: e.out,
          }))
        );
      }

      // Beam traversal edges (project in_claim / out_claim).
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

      // Inter-claim relation resolution.
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

const makeOrchestrator = () => {
  const deps: GraphRagDeps = {
    store: makeStore(),
    embedder: { embedQuery: async () => [1, 0, 0] },
    resolveOriginBucket: () => "other",
  };
  return new RetrievalOrchestrator(philosophyRetrievalConfig, deps);
};

describe("RetrievalOrchestrator", () => {
  it("retrieveContext returns a curated subgraph + block + uniform trace", async () => {
    const result = await makeOrchestrator().retrieveContext({ query: "Thesis A", topK: 5 });

    expect(result.trace.operation).toBe("retrieve_context");
    expect(result.subgraph.seed_claim_ids).toContain("claim:c1");
    expect(result.subgraph.claims.some((c) => c.id === "claim:c2")).toBe(true); // supports edge traversed
    expect(result.subgraph.claims.some((c) => c.id === "claim:c3")).toBe(true); // contradicts edge traversed
    expect(result.context_block).toContain("PHILOSOPHICAL KNOWLEDGE GRAPH");
    expect(result.trace.tokens_used).toBeGreaterThan(0);
    expect(result.trace.claim_count).toBe(result.subgraph.claims.length);
    expect(result.trace.verification?.policy.include).toEqual(["supported"]);
  });

  it("expandContext starts from explicit seed nodes (no vector query)", async () => {
    const result = await makeOrchestrator().expandContext({
      seedNodeIds: ["claim:c1"],
      depth: 2,
    });
    expect(result.trace.operation).toBe("expand_context");
    expect(result.subgraph.seed_claim_ids).toEqual(["claim:c1"]);
    expect(result.subgraph.claims.some((c) => c.id === "claim:c3")).toBe(true);
  });

  it("findRelevantSubgraph records the reasoning mode and curates a subgraph", async () => {
    const result = await makeOrchestrator().findRelevantSubgraph({
      topic: "Thesis A",
      reasoningMode: "causal",
      maxNodes: 10,
    });
    expect(result.trace.operation).toBe("find_relevant_subgraph");
    expect(result.trace.reasoning_mode).toBe("causal");
    expect(result.subgraph.claims.length).toBeGreaterThan(0);
  });

  it("findPaths returns a ranked path between two nodes", async () => {
    const result = await makeOrchestrator().findPaths({
      sourceNodeId: "claim:c2",
      targetNodeId: "claim:c3",
      maxHops: 4,
    });
    expect(result.trace.operation).toBe("find_paths");
    expect(result.paths.length).toBeGreaterThan(0);
    expect(result.paths[0].node_ids).toEqual(["claim:c2", "claim:c1", "claim:c3"]);
    expect(result.paths[0].relations.map((r) => r.relation_type)).toEqual([
      "supports",
      "contradicts",
    ]);
  });

  it("findPaths returns empty with a clear reason when no path exists", async () => {
    const result = await makeOrchestrator().findPaths({
      sourceNodeId: "claim:c2",
      targetNodeId: "claim:does-not-exist",
      maxHops: 3,
    });
    expect(result.paths).toEqual([]);
    expect(result.trace.reason).toBe("no_path_within_3_hops");
  });
});
