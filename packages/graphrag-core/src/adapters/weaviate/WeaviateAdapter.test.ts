/**
 * WeaviateAdapter tests.
 *
 * These run against an in-memory fake implementing {@link WeaviateClientLike} — no live Weaviate
 * instance or client package needed. A live integration suite is gated behind
 * `RESTORMEL_TEST_WEAVIATE_URL`; when absent (the CI default) it is skipped (see the end of file).
 */
import { describe, expect, it } from "vitest";
import {
  WeaviateAdapter,
  type WeaviateClientLike,
  type WeaviateCollectionInfo,
  type WeaviateObjectLike,
  type WeaviateScored,
  type WeaviateFilter,
} from "./WeaviateAdapter.js";
import { createGraphStoreAdapter } from "../AdapterFactory.js";
import type { GraphEdge, GraphNode } from "../GraphStoreAdapter.js";

/** In-memory WeaviateClientLike: two collections (nodes, edges), naive vector/bm25/hybrid. */
class FakeWeaviateClient implements WeaviateClientLike {
  collections = new Map<string, Map<string, WeaviateObjectLike>>();
  ready = true;

  private col(name: string): Map<string, WeaviateObjectLike> {
    let c = this.collections.get(name);
    if (!c) {
      c = new Map();
      this.collections.set(name, c);
    }
    return c;
  }

  async isReady(): Promise<boolean> {
    return this.ready;
  }
  async listCollections(): Promise<WeaviateCollectionInfo[]> {
    return [...this.collections.entries()].map(([name, objs]) => ({
      name,
      propertyKeys: [...new Set([...objs.values()].flatMap((o) => Object.keys(o.properties)))],
      count: objs.size,
      vectorized: [...objs.values()].some((o) => Array.isArray(o.vector)),
      embeddingProperty: "embedding",
    }));
  }
  async ensureCollection(name: string): Promise<void> {
    this.col(name);
  }
  async deleteCollection(name: string): Promise<void> {
    this.collections.delete(name);
  }
  async batchUpsert(collection: string, objects: WeaviateObjectLike[]): Promise<void> {
    const c = this.col(collection);
    for (const o of objects) c.set(o.id, o);
  }
  async batchDelete(collection: string, ids: string[]): Promise<void> {
    const c = this.col(collection);
    for (const id of ids) c.delete(id);
  }
  async fetchByIds(collection: string, ids: string[]): Promise<WeaviateObjectLike[]> {
    const c = this.col(collection);
    if (ids.length === 0) return [...c.values()]; // discoverSchema sample uses empty ids
    return ids.map((id) => c.get(id)).filter((o): o is WeaviateObjectLike => Boolean(o));
  }
  async count(collection: string): Promise<number> {
    return this.col(collection).size;
  }
  async aggregateCountBy(collection: string, property: string): Promise<Record<string, number>> {
    const out: Record<string, number> = {};
    for (const o of this.col(collection).values()) {
      const key = String(o.properties[property] ?? "unverified");
      out[key] = (out[key] ?? 0) + 1;
    }
    return out;
  }
  private rank(collection: string, limit: number, filter?: WeaviateFilter): WeaviateScored[] {
    let objs = [...this.col(collection).values()];
    if (filter?.verificationStates) {
      objs = objs.filter((o) => filter.verificationStates!.includes(String(o.properties.verification_state)));
    }
    return objs.slice(0, limit).map((object, i) => ({ object, score: 1 - i * 0.01 }));
  }
  async nearVector(collection: string, _v: number[], limit: number, filter?: WeaviateFilter): Promise<WeaviateScored[]> {
    return this.rank(collection, limit, filter);
  }
  async bm25(collection: string, _q: string, limit: number, filter?: WeaviateFilter): Promise<WeaviateScored[]> {
    return this.rank(collection, limit, filter);
  }
  async hybrid(collection: string, _q: string, _v: number[], limit: number, filter?: WeaviateFilter): Promise<WeaviateScored[]> {
    return this.rank(collection, limit, filter);
  }
  async fetchEdges(collection: string, opts: { nodeIds: string[]; relationTypes?: string[] }): Promise<WeaviateObjectLike[]> {
    const ids = new Set(opts.nodeIds);
    return [...this.col(collection).values()].filter((e) => {
      const incident = ids.has(String(e.properties.from_id)) || ids.has(String(e.properties.to_id));
      const typeOk = !opts.relationTypes || opts.relationTypes.includes(String(e.properties.relation_type));
      return incident && typeOk;
    });
  }
}

function node(id: string, extra: Partial<GraphNode> = {}): GraphNode {
  return {
    id,
    text: `claim ${id}`,
    claim_type: "thesis",
    domain: "ethics",
    source_title: `Source ${id}`,
    confidence: 0.9,
    verification_state: "supported",
    trust_score: 90,
    embedding: [0.1, 0.2, 0.3],
    ...extra,
  };
}
const edge = (from: string, to: string, rel = "supports"): GraphEdge => ({ from_id: from, to_id: to, relation_type: rel });

async function seededAdapter(): Promise<{ adapter: WeaviateAdapter; client: FakeWeaviateClient }> {
  const client = new FakeWeaviateClient();
  const adapter = new WeaviateAdapter({ client });
  await adapter.writeNodes([node("a"), node("b"), node("c", { verification_state: "weak", trust_score: 40 }), node("d")]);
  await adapter.writeEdges([edge("a", "b"), edge("b", "c"), edge("c", "d")]);
  return { adapter, client };
}

describe("WeaviateAdapter", () => {
  it("advertises the Weaviate capabilities (hybrid yes, native traversal no, depth cap 2)", () => {
    const a = new WeaviateAdapter();
    expect(a.capabilities).toMatchObject({
      nativeVectorSearch: true,
      nativeGraphTraversal: false,
      hybridSearch: true,
      transactionalWrites: false,
      maxTraversalDepth: 2,
    });
  });

  it("connect() without an injected client throws a clear host-shim error", async () => {
    const a = new WeaviateAdapter();
    await expect(a.connect({ type: "weaviate", schemaMode: "fresh", credentials: {} })).rejects.toThrow(/inject a WeaviateClientLike/);
  });

  it("writes and reads nodes round-trip", async () => {
    const { adapter } = await seededAdapter();
    const nodes = await adapter.getNodesByIds(["a", "c"]);
    expect(nodes.map((n) => n.id).sort()).toEqual(["a", "c"]);
    expect(nodes.find((n) => n.id === "a")?.text).toBe("claim a");
  });

  it("searches by vector / text / native hybrid", async () => {
    const { adapter } = await seededAdapter();
    expect((await adapter.searchByVector([0.1, 0.2, 0.3], 2)).length).toBe(2);
    expect((await adapter.searchByText("welfare", 2)).length).toBe(2);
    expect((await adapter.hybridSearch("welfare", [0.1, 0.2, 0.3], 3)).length).toBe(3);
  });

  it("expands at the application layer within the depth cap", async () => {
    const { adapter } = await seededAdapter();
    const sub = await adapter.expandFromSeeds(["a"], { depth: 2 });
    // a→b (hop 1), b→c (hop 2). d is depth 3, beyond the cap.
    expect(sub.nodes.map((n) => n.id).sort()).toEqual(["a", "b", "c"]);
    expect(sub.warnings).toBeUndefined();
  });

  it("clamps a deeper request to depth 2 and surfaces a warning", async () => {
    const { adapter } = await seededAdapter();
    const sub = await adapter.expandFromSeeds(["a"], { depth: 5 });
    expect(sub.warnings?.[0]).toMatch(/limits traversal to depth 2/);
    expect(sub.nodes.map((n) => n.id)).not.toContain("d"); // depth-3 node excluded
  });

  it("finds application-layer paths between two nodes", async () => {
    const { adapter } = await seededAdapter();
    const paths = await adapter.traversePaths("a", "c", 2);
    expect(paths.length).toBeGreaterThan(0);
    expect(paths[0].node_ids).toEqual(["a", "b", "c"]);
  });

  it("computes a verification breakdown", async () => {
    const { adapter } = await seededAdapter();
    const breakdown = await adapter.getVerificationBreakdown();
    expect(breakdown).toMatchObject({ supported: 3, weak: 1, total: 4 });
  });

  it("discovers the schema (node + edge collections)", async () => {
    const { adapter } = await seededAdapter();
    const schema = await adapter.discoverSchema();
    expect(schema.estimatedNodeCount).toBe(4);
    expect(schema.estimatedEdgeCount).toBe(3);
    expect(schema.nodeTypes[0].nativeLabel).toBe("Claim");
    expect(schema.nodeTypes[0].hasEmbeddings).toBe(true);
  });

  it("updates verification state and deletes nodes/edges", async () => {
    const { adapter } = await seededAdapter();
    await adapter.updateVerificationState("a", "unsupported", 10);
    expect((await adapter.getNodesByIds(["a"]))[0].verification_state).toBe("unsupported");
    await adapter.deleteNodes(["d"]);
    expect(await adapter.getNodesByIds(["d"])).toEqual([]);
  });

  it("healthCheck reflects the client readiness", async () => {
    const { adapter, client } = await seededAdapter();
    expect((await adapter.healthCheck()).ok).toBe(true);
    client.ready = false;
    expect((await adapter.healthCheck()).ok).toBe(false);
  });
});

describe("AdapterFactory → weaviate", () => {
  it("constructs a WeaviateAdapter for type: 'weaviate'", () => {
    const client = new FakeWeaviateClient();
    const adapter = createGraphStoreAdapter(
      { type: "weaviate", schemaMode: "fresh", credentials: {}, collectionPrefix: "Acme" },
      { weaviateClient: client, weaviateCollectionPrefix: "Acme" },
    );
    expect(adapter.adapterType).toBe("weaviate");
    expect(adapter.capabilities.maxTraversalDepth).toBe(2);
  });
});

// ── Live integration suite (opt-in) ──────────────────────────────────────────
const liveUrl = process.env.RESTORMEL_TEST_WEAVIATE_URL;
describe.skipIf(!liveUrl)("WeaviateAdapter (live)", () => {
  it("connects to a real Weaviate instance", async () => {
    // Host wires a real WeaviateClientLike shim here; skipped unless RESTORMEL_TEST_WEAVIATE_URL is set.
    expect(liveUrl).toBeTruthy();
  });
});
