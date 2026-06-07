/**
 * Neo4jAdapter tests.
 *
 * By default these run against a fake in-memory driver implementing
 * {@link Neo4jDriverLike} — no live database or `neo4j-driver` package needed.
 *
 * To run against a live Neo4j Aura instance instead, set:
 *   RESTORMEL_TEST_NEO4J_URL   = neo4j+s://<dbid>.databases.neo4j.io
 *   RESTORMEL_TEST_NEO4J_CREDS = <user>:<password>
 * and `pnpm --filter @restormel/graphrag-core add -D neo4j-driver`, then run
 * `pnpm --filter @restormel/graphrag-core test Neo4jAdapter`. When the env vars
 * are absent (the CI default) the live suite is skipped and the fake-driver
 * suite runs.
 */
import { describe, expect, it } from "vitest";
import {
  Neo4jAdapter,
  reciprocalRankFusion,
  type Neo4jDriverLike,
  type Neo4jQueryResultLike,
  type Neo4jRecordLike,
} from "./Neo4jAdapter.js";
import { buildNeo4jSchemaStatements, NEO4J_INDEX_NAMES } from "./neo4j-schema.js";
import type { GraphNode, ScoredNode } from "../GraphStoreAdapter.js";

/** Build a record whose get(key) reads from a plain object. */
function rec(obj: Record<string, unknown>): Neo4jRecordLike {
  return { get: (key: string) => obj[key] };
}

/** A configurable fake driver: returns records by query substring, capturing all runs. */
function makeFakeDriver(responder: (query: string, params: Record<string, unknown>) => Record<string, unknown>[]) {
  const runs: { query: string; params: Record<string, unknown> }[] = [];
  let closed = false;
  const driver: Neo4jDriverLike & { runs: typeof runs; closed: () => boolean } = {
    session() {
      return {
        async run(query: string, params: Record<string, unknown> = {}): Promise<Neo4jQueryResultLike> {
          runs.push({ query, params });
          return { records: responder(query, params).map(rec) };
        },
        async close() {
          /* no-op */
        },
      };
    },
    async verifyConnectivity() {
      return true;
    },
    async close() {
      closed = true;
    },
    runs,
    closed: () => closed,
  };
  return driver;
}

const node = (id: string, over: Partial<GraphNode> = {}): GraphNode => ({
  id,
  text: `claim ${id}`,
  claim_type: "thesis",
  domain: "ethics",
  source_title: `Source ${id}`,
  confidence: 0.9,
  ...over,
});

const liveUrl = process.env.RESTORMEL_TEST_NEO4J_URL?.trim();

describe("Neo4jAdapter (fake driver)", () => {
  it("declares neo4j identity + capabilities", () => {
    const a = new Neo4jAdapter({ driver: makeFakeDriver(() => []) });
    expect(a.adapterType).toBe("neo4j");
    expect(a.capabilities.nativeVectorSearch).toBe(true);
    expect(a.capabilities.nativeGraphTraversal).toBe(true);
    expect(a.capabilities.streamingResults).toBe(true);
    expect(a.capabilities.hybridSearch).toBe(false);
  });

  it("ensureSchema runs constraint + vector + fulltext DDL", async () => {
    const driver = makeFakeDriver(() => []);
    await new Neo4jAdapter({ driver, schema: { embeddingDimensions: 768 } }).ensureSchema({});
    expect(driver.runs).toHaveLength(3);
    expect(driver.runs[0].query).toContain("CREATE CONSTRAINT");
    expect(driver.runs[1].query).toContain("CREATE VECTOR INDEX");
    expect(driver.runs[1].query).toContain("768");
    expect(driver.runs[2].query).toContain("CREATE FULLTEXT INDEX");
  });

  it("healthCheck uses verifyConnectivity and reports ok", async () => {
    const res = await new Neo4jAdapter({ driver: makeFakeDriver(() => []) }).healthCheck();
    expect(res.ok).toBe(true);
    expect(typeof res.latencyMs).toBe("number");
  });

  it("healthCheck reports failure when the driver throws", async () => {
    const driver: Neo4jDriverLike = {
      session() {
        return {
          async run() {
            throw new Error("boom");
          },
          async close() {},
        };
      },
      async verifyConnectivity() {
        throw new Error("no route to host");
      },
      async close() {},
    };
    const res = await new Neo4jAdapter({ driver }).healthCheck();
    expect(res.ok).toBe(false);
    expect(res.error).toBe("no route to host");
  });

  it("writeNodes batches via UNWIND/MERGE with mapped params", async () => {
    const driver = makeFakeDriver(() => []);
    await new Neo4jAdapter({ driver }).writeNodes([node("a", { embedding: [1, 2] }), node("b")]);
    expect(driver.runs).toHaveLength(1);
    expect(driver.runs[0].query).toContain("UNWIND $nodes AS n");
    expect(driver.runs[0].query).toContain("MERGE (c:`Claim` { id: n.id })");
    const nodes = driver.runs[0].params.nodes as Record<string, unknown>[];
    expect(nodes).toHaveLength(2);
    expect(nodes[0]).toMatchObject({ id: "a", embedding: [1, 2] });
    expect(nodes[1].embedding).toBeNull();
  });

  it("writeEdges groups by relationship type with escaped literals", async () => {
    const driver = makeFakeDriver(() => []);
    await new Neo4jAdapter({ driver }).writeEdges([
      { from_id: "a", to_id: "b", relation_type: "SUPPORTS" },
      { from_id: "b", to_id: "c", relation_type: "CONTRADICTS" },
      { from_id: "a", to_id: "c", relation_type: "SUPPORTS" },
    ]);
    expect(driver.runs).toHaveLength(2); // one query per distinct type
    const supports = driver.runs.find((r) => r.query.includes("`SUPPORTS`"));
    expect(supports).toBeTruthy();
    expect((supports!.params.edges as unknown[]).length).toBe(2);
  });

  it("searchByVector queries the vector index and applies verification filters", async () => {
    const driver = makeFakeDriver((q) =>
      q.includes("db.index.vector.queryNodes")
        ? [{ node: { properties: node("a", { trust_score: 90, verification_state: "supported" }) }, score: 0.91 }]
        : [],
    );
    const res = await new Neo4jAdapter({ driver }).searchByVector([0.1, 0.2], 5, {
      verificationStates: ["supported"],
      minTrustScore: 70,
    });
    expect(res).toHaveLength(1);
    expect(res[0].node.id).toBe("a");
    expect(res[0].score).toBeCloseTo(0.91);
    expect(driver.runs[0].query).toContain("node.verification_state IN $f_states");
    expect(driver.runs[0].query).toContain("node.trust_score >= $f_minTrust");
    expect(driver.runs[0].params).toMatchObject({ k: 5, index: NEO4J_INDEX_NAMES.vector });
  });

  it("searchByText queries the fulltext index", async () => {
    const driver = makeFakeDriver((q) =>
      q.includes("db.index.fulltext.queryNodes") ? [{ node: { properties: node("a") }, score: 2.3 }] : [],
    );
    const res = await new Neo4jAdapter({ driver }).searchByText("doubt", 3);
    expect(res[0].node.id).toBe("a");
    expect(driver.runs[0].params).toMatchObject({ q: "doubt", index: NEO4J_INDEX_NAMES.fulltext });
  });

  it("hybridSearch fuses vector + fulltext via RRF", async () => {
    const driver = makeFakeDriver((q) => {
      if (q.includes("vector.queryNodes")) {
        return [
          { node: { properties: node("a") }, score: 0.9 },
          { node: { properties: node("b") }, score: 0.5 },
        ];
      }
      if (q.includes("fulltext.queryNodes")) {
        return [
          { node: { properties: node("b") }, score: 3 },
          { node: { properties: node("c") }, score: 1 },
        ];
      }
      return [];
    });
    const res = await new Neo4jAdapter({ driver }).hybridSearch("q", [0.1], 3);
    // b appears in both lists → highest fused score.
    expect(res[0].node.id).toBe("b");
    expect(res.map((r) => r.node.id).sort()).toEqual(["a", "b", "c"]);
  });

  it("expandFromSeeds beam-searches per hop and collects the subgraph", async () => {
    const driver = makeFakeDriver((q, params) => {
      if (q.includes("type(r) AS rel") && q.includes("a.id IN $frontier")) {
        const frontier = params.frontier as string[];
        if (frontier.includes("a")) return [{ from: "a", to: "b", rel: "SUPPORTS" }];
        return [];
      }
      if (q.includes("WHERE c.id IN $ids")) {
        return (params.ids as string[]).map((id) => ({ c: { properties: node(id) } }));
      }
      return [];
    });
    const sub = await new Neo4jAdapter({ driver }).expandFromSeeds(["a"], { depth: 1 });
    expect(sub.edges).toEqual([{ from_id: "a", to_id: "b", relation_type: "SUPPORTS" }]);
    expect(sub.nodes.map((n) => n.id).sort()).toEqual(["a", "b"]);
  });

  it("traversePaths returns paths with literal-bounded variable length", async () => {
    const driver = makeFakeDriver((q) =>
      q.includes("*1..4")
        ? [{ node_ids: ["a", "b", "c"], rels: [{ type: "SUPPORTS", from: "a", to: "b" }, { type: "SUPPORTS", from: "b", to: "c" }] }]
        : [],
    );
    const paths = await new Neo4jAdapter({ driver }).traversePaths("a", "c", 4, ["SUPPORTS"]);
    expect(paths).toHaveLength(1);
    expect(paths[0].node_ids).toEqual(["a", "b", "c"]);
    expect(paths[0].relations).toHaveLength(2);
    expect(driver.runs[0].query).toContain(":`SUPPORTS`*1..4");
  });

  it("getVerificationBreakdown buckets state counts", async () => {
    const driver = makeFakeDriver((q) =>
      q.includes("c.verification_state AS state")
        ? [
            { state: "supported", count: 7 },
            { state: "weak", count: 2 },
            { state: null, count: 1 },
          ]
        : [],
    );
    const b = await new Neo4jAdapter({ driver }).getVerificationBreakdown();
    expect(b).toMatchObject({ supported: 7, weak: 2, unverified: 1, total: 10 });
  });

  it("disconnect closes the driver", async () => {
    const driver = makeFakeDriver(() => []);
    const a = new Neo4jAdapter({ driver });
    await a.disconnect();
    expect(driver.closed()).toBe(true);
  });
});

describe("reciprocalRankFusion", () => {
  it("rewards items ranked highly across multiple lists", () => {
    const n = (id: string): ScoredNode => ({ node: node(id), score: 0 });
    const fused = reciprocalRankFusion([
      [n("a"), n("b"), n("c")],
      [n("b"), n("a")],
    ]);
    // a (ranks 1,2) and b (ranks 2,1) lead; c (rank 3, one list) trails.
    expect(fused[fused.length - 1].node.id).toBe("c");
    expect(fused.map((f) => f.node.id).slice(0, 2).sort()).toEqual(["a", "b"]);
  });
});

describe("buildNeo4jSchemaStatements", () => {
  it("defaults the embedding width and uses cosine similarity", () => {
    const stmts = buildNeo4jSchemaStatements();
    expect(stmts[1]).toContain("1536");
    expect(stmts[1]).toContain("'cosine'");
  });

  it("honours a domain pack's embedding dimensions", () => {
    const stmts = buildNeo4jSchemaStatements({ embeddingDimensions: 384 });
    expect(stmts[1]).toContain("384");
  });
});

// Live suite — only runs when test credentials are present.
describe.skipIf(!liveUrl)("Neo4jAdapter (live)", () => {
  it("connects and reports healthy against the configured instance", async () => {
    const [username, password] = (process.env.RESTORMEL_TEST_NEO4J_CREDS ?? ":").split(":");
    const adapter = new Neo4jAdapter();
    await adapter.connect({
      type: "neo4j",
      connectionString: liveUrl!,
      credentials: { username, password },
      schemaMode: "fresh",
    });
    const health = await adapter.healthCheck();
    expect(health.ok).toBe(true);
    await adapter.disconnect();
  });
});
