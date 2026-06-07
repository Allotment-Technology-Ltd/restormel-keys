import { describe, expect, it } from "vitest";
import type { GraphStore } from "../../ports.js";
import { SurrealDBAdapter } from "./SurrealDBAdapter.js";
import type { GraphNode } from "../GraphStoreAdapter.js";

/** Recording mock GraphStore: captures every query + responds by SQL substring. */
function makeStore(responder: (sql: string, vars?: Record<string, unknown>) => unknown) {
  const calls: { sql: string; vars?: Record<string, unknown> }[] = [];
  const store: GraphStore = {
    async query<T>(sql: string, vars?: Record<string, unknown>): Promise<T> {
      calls.push({ sql, vars });
      return responder(sql, vars) as T;
    },
    isDatabaseUnavailable() {
      return false;
    },
  };
  return { store, calls };
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

describe("SurrealDBAdapter", () => {
  it("declares surrealdb identity + capabilities", () => {
    const { store } = makeStore(() => []);
    const a = new SurrealDBAdapter({ store });
    expect(a.adapterType).toBe("surrealdb");
    expect(a.capabilities.nativeVectorSearch).toBe(true);
    expect(a.capabilities.nativeGraphTraversal).toBe(true);
    expect(a.capabilities.hybridSearch).toBe(false);
  });

  it("healthCheck returns ok when the store responds", async () => {
    const { store, calls } = makeStore(() => true);
    const res = await new SurrealDBAdapter({ store }).healthCheck();
    expect(res.ok).toBe(true);
    expect(calls[0].sql).toContain("RETURN true");
  });

  it("healthCheck reports the error when the store throws", async () => {
    const store: GraphStore = {
      async query<T>(): Promise<T> {
        throw new Error("unreachable");
      },
      isDatabaseUnavailable: () => true,
    };
    const res = await new SurrealDBAdapter({ store }).healthCheck();
    expect(res.ok).toBe(false);
    expect(res.error).toBe("unreachable");
  });

  it("writeNodes issues CREATE per node with content", async () => {
    const { store, calls } = makeStore(() => []);
    await new SurrealDBAdapter({ store, nodeTable: "claim" }).writeNodes([node("a"), node("b")]);
    expect(calls).toHaveLength(2);
    expect(calls[0].sql).toContain("CREATE type::thing($table, $id) CONTENT $content");
    expect(calls[0].vars).toMatchObject({ table: "claim", id: "a" });
    expect((calls[0].vars?.content as Record<string, unknown>).text).toBe("claim a");
  });

  it("upsertNodes uses UPSERT", async () => {
    const { store, calls } = makeStore(() => []);
    await new SurrealDBAdapter({ store }).upsertNodes([node("a")]);
    expect(calls[0].sql).toContain("UPSERT type::thing($table, $id)");
  });

  it("writeEdges issues RELATE with relation type", async () => {
    const { store, calls } = makeStore(() => []);
    await new SurrealDBAdapter({ store }).writeEdges([
      { from_id: "a", to_id: "b", relation_type: "supports", properties: { weight: 1 } },
    ]);
    expect(calls[0].sql).toContain("RELATE $from->type::table($rel)->$to");
    expect(calls[0].vars).toMatchObject({ from: "a", to: "b", rel: "supports" });
  });

  it("updateVerificationState sets state + trust", async () => {
    const { store, calls } = makeStore(() => []);
    await new SurrealDBAdapter({ store }).updateVerificationState("a", "supported", 88);
    expect(calls[0].sql).toContain("SET verification_state = $state, trust_score = $trust");
    expect(calls[0].vars).toMatchObject({ id: "a", state: "supported", trust: 88 });
  });

  it("searchByVector returns scored nodes and applies verification filters", async () => {
    const { store, calls } = makeStore((sql) =>
      sql.includes("similarity::cosine")
        ? [{ id: "a", text: "claim a", score: 0.92, verification_state: "supported", trust_score: 90 }]
        : [],
    );
    const res = await new SurrealDBAdapter({ store }).searchByVector([0.1, 0.2], 5, {
      verificationStates: ["supported"],
      minTrustScore: 70,
    });
    expect(res).toHaveLength(1);
    expect(res[0].score).toBeCloseTo(0.92);
    expect(res[0].node.id).toBe("a");
    expect(calls[0].sql).toContain("verification_state IN [\"supported\"]");
    expect(calls[0].sql).toContain("trust_score >= 70");
    expect(calls[0].vars).toMatchObject({ k: 5 });
  });

  it("searchByText queries the fulltext operator", async () => {
    const { store, calls } = makeStore((sql) =>
      sql.includes("text @@ $q") ? [{ id: "a", text: "claim a", score: 1.2 }] : [],
    );
    const res = await new SurrealDBAdapter({ store }).searchByText("doubt", 3);
    expect(res[0].node.id).toBe("a");
    expect(calls[0].sql).toContain("search::score(0) AS score");
    expect(calls[0].vars).toMatchObject({ q: "doubt", k: 3 });
  });

  it("expandFromSeeds walks edge tables and collects the subgraph", async () => {
    // a --supports--> b ; query for nodes returns both.
    const { store } = makeStore((sql, vars) => {
      if (sql.includes("FROM supports")) {
        return (vars?.node as string) === "a" ? [{ in: "a", out: "b" }] : [];
      }
      if (sql.includes("WHERE id IN")) {
        const ids = (vars?.ids as string[]) ?? [];
        return ids.map((id) => ({ id, text: `claim ${id}` }));
      }
      return [];
    });
    const sub = await new SurrealDBAdapter({ store, defaultEdgeTables: ["supports"] }).expandFromSeeds(
      ["a"],
      { depth: 1 },
    );
    expect(sub.seedNodeIds).toEqual(["a"]);
    expect(sub.edges).toEqual([{ from_id: "a", to_id: "b", relation_type: "supports" }]);
    expect(sub.nodes.map((n) => n.id).sort()).toEqual(["a", "b"]);
  });

  it("traversePaths finds a shortest path to the target", async () => {
    const { store } = makeStore((sql, vars) => {
      if (sql.includes("FROM supports")) {
        const node = vars?.node as string;
        if (node === "a") return [{ in: "a", out: "b" }];
        if (node === "b") return [{ in: "b", out: "c" }];
      }
      return [];
    });
    const paths = await new SurrealDBAdapter({ store, defaultEdgeTables: ["supports"] }).traversePaths(
      "a",
      "c",
      4,
    );
    expect(paths.length).toBeGreaterThan(0);
    expect(paths[0].node_ids).toEqual(["a", "b", "c"]);
    expect(paths[0].relations).toHaveLength(2);
  });

  it("getVerificationBreakdown buckets state counts", async () => {
    const { store } = makeStore((sql) =>
      sql.includes("GROUP BY verification_state")
        ? [
            { verification_state: "supported", count: 10 },
            { verification_state: "weak", count: 3 },
            { verification_state: null, count: 2 },
          ]
        : [],
    );
    const b = await new SurrealDBAdapter({ store }).getVerificationBreakdown();
    expect(b).toMatchObject({ supported: 10, weak: 3, unverified: 2, total: 15 });
  });

  it("getNodesByIds short-circuits on empty input", async () => {
    const { store, calls } = makeStore(() => []);
    const res = await new SurrealDBAdapter({ store }).getNodesByIds([]);
    expect(res).toEqual([]);
    expect(calls).toHaveLength(0);
  });
});
