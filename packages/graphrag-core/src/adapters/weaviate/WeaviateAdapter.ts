/**
 * WeaviateAdapter — GraphStoreAdapter implementation for Weaviate (Multi-DB Sprint 2).
 *
 * Weaviate is best-in-class for vector + native BM25 hybrid search, but has **no native graph
 * traversal** (only cross-references). So this adapter does multi-hop expansion at the application
 * layer — iterating `getNeighbours()` per hop — and enforces a hard `maxTraversalDepth: 2`
 * (capabilities.ts → WEAVIATE_CAPABILITIES) to avoid N+1 blow-out. When a caller asks for deeper
 * traversal the requested depth is clamped and a clear advisory is surfaced in the subgraph.
 *
 * graphrag-core ships no database driver. Unlike `neo4j-driver` (whose `session().run()` surface we
 * mirror directly), the real Weaviate client API differs enough that the host wires a thin shim
 * implementing {@link WeaviateClientLike}. Tests inject an in-memory fake.
 *
 * Data model: nodes live in one collection (`<prefix>Claim`); edges live in a sibling collection
 * (`<prefix>Edge`) as objects with `from_id` / `to_id` / `relation_type` — Weaviate cross-references
 * are directional and awkward to query both ways, so an edge collection keeps traversal symmetric.
 */
import {
  type DiscoveredSchema,
  type DomainPackSchema,
  type ExpansionOptions,
  type GraphEdge,
  type GraphNode,
  type GraphPath,
  type GraphStoreAdapter,
  type GraphStoreAdapterType,
  type GraphStoreCapabilities,
  type GraphStoreConnectionConfig,
  type GraphStoreHealthResult,
  type GraphSubgraph,
  type NodeFilter,
  type ScoredNode,
  type VerificationBreakdown,
  type VerificationState,
  type WorkspaceGraphStats,
} from "../GraphStoreAdapter.js";
import { WEAVIATE_CAPABILITIES } from "../capabilities.js";

// ── Minimal Weaviate client surface (host wires this over the real client) ──

export interface WeaviateObjectLike {
  id: string;
  properties: Record<string, unknown>;
  vector?: number[];
}

export interface WeaviateScored {
  object: WeaviateObjectLike;
  score: number;
}

/** Structured verification filter; the host shim translates it to a Weaviate `where`. */
export interface WeaviateFilter {
  verificationStates?: string[];
  minTrustScore?: number;
  excludeFlagged?: boolean;
  domainPack?: string;
  sourceDocumentIds?: string[];
}

export interface WeaviateCollectionInfo {
  name: string;
  propertyKeys: string[];
  count: number;
  vectorized: boolean;
  embeddingProperty?: string;
}

export interface WeaviateClientLike {
  isReady(): Promise<boolean>;
  listCollections(): Promise<WeaviateCollectionInfo[]>;
  ensureCollection(name: string, options?: { vectorDimensions?: number }): Promise<void>;
  deleteCollection(name: string): Promise<void>;
  /** Idempotent batch upsert (Weaviate has no ACID writes — the host batches with retry). */
  batchUpsert(collection: string, objects: WeaviateObjectLike[]): Promise<void>;
  batchDelete(collection: string, ids: string[]): Promise<void>;
  fetchByIds(collection: string, ids: string[]): Promise<WeaviateObjectLike[]>;
  count(collection: string): Promise<number>;
  /** Aggregate object counts grouped by a property value (for verification breakdown). */
  aggregateCountBy(collection: string, property: string): Promise<Record<string, number>>;
  nearVector(collection: string, vector: number[], limit: number, filter?: WeaviateFilter): Promise<WeaviateScored[]>;
  bm25(collection: string, query: string, limit: number, filter?: WeaviateFilter): Promise<WeaviateScored[]>;
  hybrid(collection: string, query: string, vector: number[], limit: number, filter?: WeaviateFilter): Promise<WeaviateScored[]>;
  /** Edge objects incident to any of `nodeIds` (from_id ∈ ids OR to_id ∈ ids). */
  fetchEdges(collection: string, opts: { nodeIds: string[]; relationTypes?: string[] }): Promise<WeaviateObjectLike[]>;
}

export interface WeaviateAdapterDeps {
  /** Host-provided client shim. Required — graphrag-core ships no Weaviate driver. */
  client?: WeaviateClientLike;
  /** Collection name prefix (default ""). Node collection = `<prefix>Claim`, edges = `<prefix>Edge`. */
  collectionPrefix?: string;
  /** Embedding dimensions used when provisioning a fresh collection. */
  embeddingDimensions?: number;
}

const NODE_PROPERTY_KEYS = [
  "id",
  "text",
  "claim_type",
  "domain",
  "source_title",
  "confidence",
  "verification_state",
  "trust_score",
];

function toNumber(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

function objectToNode(obj: WeaviateObjectLike): GraphNode {
  const p = obj.properties ?? {};
  return {
    id: String(p.id ?? obj.id),
    text: typeof p.text === "string" ? p.text : "",
    claim_type: typeof p.claim_type === "string" ? p.claim_type : "",
    domain: String(p.domain ?? ""),
    source_title: typeof p.source_title === "string" ? p.source_title : "",
    confidence: toNumber(p.confidence),
    embedding: obj.vector ?? (Array.isArray(p.embedding) ? (p.embedding as number[]) : undefined),
    verification_state: (p.verification_state ?? null) as VerificationState | null,
    trust_score: p.trust_score == null ? null : toNumber(p.trust_score),
  };
}

function nodeToObject(node: GraphNode): WeaviateObjectLike {
  return {
    id: node.id,
    properties: {
      id: node.id,
      text: node.text,
      claim_type: node.claim_type,
      domain: node.domain,
      source_title: node.source_title,
      confidence: node.confidence,
      verification_state: node.verification_state ?? null,
      trust_score: node.trust_score ?? null,
    },
    ...(node.embedding ? { vector: node.embedding } : {}),
  };
}

/** Deterministic edge id so re-writing the same edge is an upsert, not a duplicate. */
function edgeId(edge: GraphEdge): string {
  return edge.id ?? `${edge.from_id}|${edge.relation_type}|${edge.to_id}`;
}

function edgeToObject(edge: GraphEdge): WeaviateObjectLike {
  return {
    id: edgeId(edge),
    properties: {
      from_id: edge.from_id,
      to_id: edge.to_id,
      relation_type: edge.relation_type,
      ...(edge.properties ?? {}),
    },
  };
}

function filterToWeaviate(filter?: NodeFilter): WeaviateFilter | undefined {
  if (!filter) return undefined;
  return {
    ...(filter.verificationStates ? { verificationStates: filter.verificationStates } : {}),
    ...(typeof filter.minTrustScore === "number" ? { minTrustScore: filter.minTrustScore } : {}),
    ...(filter.excludeFlagged ? { excludeFlagged: true } : {}),
    ...(filter.domainPack ? { domainPack: filter.domainPack } : {}),
    ...(filter.sourceDocumentIds ? { sourceDocumentIds: filter.sourceDocumentIds } : {}),
  };
}

/** Application-layer node filter (used after expansion, where the DB did not pre-filter). */
function nodeMatchesFilter(node: GraphNode, filter?: NodeFilter): boolean {
  if (!filter) return true;
  if (filter.verificationStates && filter.verificationStates.length > 0) {
    if (!filter.verificationStates.includes((node.verification_state ?? "unverified") as VerificationState)) return false;
  }
  if (typeof filter.minTrustScore === "number" && (node.trust_score ?? 0) < filter.minTrustScore) return false;
  return true;
}

export class WeaviateAdapter implements GraphStoreAdapter {
  readonly adapterType: GraphStoreAdapterType = "weaviate";
  readonly capabilities: GraphStoreCapabilities = WEAVIATE_CAPABILITIES;

  private client: WeaviateClientLike | null;
  private readonly nodeClass: string;
  private readonly edgeClass: string;
  private readonly embeddingDimensions?: number;

  constructor(deps: WeaviateAdapterDeps = {}) {
    this.client = deps.client ?? null;
    const prefix = deps.collectionPrefix ?? "";
    this.nodeClass = `${prefix}Claim`;
    this.edgeClass = `${prefix}Edge`;
    this.embeddingDimensions = deps.embeddingDimensions;
  }

  // ── Lifecycle ─────────────────────────────────────────────────
  async connect(config: GraphStoreConnectionConfig): Promise<void> {
    if (this.client) return; // host-injected client
    throw new Error(
      "WeaviateAdapter.connect: graphrag-core ships no Weaviate driver. The host must inject a " +
        "WeaviateClientLike via deps.client (a thin shim over the real Weaviate client at " +
        `${config.endpoint ?? "the configured endpoint"}).`,
    );
  }

  async disconnect(): Promise<void> {
    this.client = null;
  }

  async healthCheck(): Promise<GraphStoreHealthResult> {
    const started = Date.now();
    try {
      const ready = await this.requireClient().isReady();
      return ready
        ? { ok: true, latencyMs: Date.now() - started }
        : { ok: false, latencyMs: Date.now() - started, error: "Weaviate reports not ready" };
    } catch (error) {
      return { ok: false, latencyMs: Date.now() - started, error: error instanceof Error ? error.message : "unknown" };
    }
  }

  // ── Schema management ─────────────────────────────────────────
  async ensureSchema(domainPack: DomainPackSchema): Promise<void> {
    const dims = domainPack.embeddingDimensions ?? this.embeddingDimensions;
    await this.requireClient().ensureCollection(this.nodeClass, dims ? { vectorDimensions: dims } : undefined);
    await this.requireClient().ensureCollection(this.edgeClass);
  }

  async discoverSchema(): Promise<DiscoveredSchema> {
    const client = this.requireClient();
    const collections = await client.listCollections();
    const nodeTypes = collections
      .filter((c) => c.name !== this.edgeClass)
      .map((c) => ({
        nativeLabel: c.name,
        propertyKeys: c.propertyKeys,
        estimatedCount: c.count,
        hasEmbeddings: c.vectorized,
        ...(c.embeddingProperty ? { embeddingProperty: c.embeddingProperty } : {}),
      }));
    const edgeCollections = collections.filter((c) => c.name === this.edgeClass);
    const edgeTypes = edgeCollections.map((c) => ({
      nativeLabel: c.name,
      propertyKeys: c.propertyKeys,
      estimatedCount: c.count,
    }));

    const sampleNodes = await client.fetchByIds(this.nodeClass, []).catch(() => []);
    return {
      nodeTypes,
      edgeTypes,
      sampleData: { nodes: sampleNodes.slice(0, 5).map(objectToNode), edges: [], seedNodeIds: [] },
      estimatedNodeCount: nodeTypes.reduce((s, n) => s + n.estimatedCount, 0),
      estimatedEdgeCount: edgeTypes.reduce((s, e) => s + e.estimatedCount, 0),
    };
  }

  async dropSchema(): Promise<void> {
    const client = this.requireClient();
    await client.deleteCollection(this.nodeClass).catch(() => undefined);
    await client.deleteCollection(this.edgeClass).catch(() => undefined);
  }

  // ── Write operations (no ACID — batch with retry) ─────────────
  async writeNodes(nodes: GraphNode[]): Promise<void> {
    if (nodes.length === 0) return;
    await this.batchWithRetry(this.nodeClass, nodes.map(nodeToObject));
  }

  async upsertNodes(nodes: GraphNode[]): Promise<void> {
    await this.writeNodes(nodes); // batchUpsert is already idempotent on object id
  }

  async writeEdges(edges: GraphEdge[]): Promise<void> {
    if (edges.length === 0) return;
    await this.batchWithRetry(this.edgeClass, edges.map(edgeToObject));
  }

  async updateVerificationState(nodeId: string, state: VerificationState, trustScore: number): Promise<void> {
    const [existing] = await this.requireClient().fetchByIds(this.nodeClass, [nodeId]);
    const base = existing ?? { id: nodeId, properties: { id: nodeId } };
    await this.requireClient().batchUpsert(this.nodeClass, [
      { ...base, properties: { ...base.properties, verification_state: state, trust_score: trustScore } },
    ]);
  }

  async deleteNodes(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    await this.requireClient().batchDelete(this.nodeClass, ids);
  }

  async deleteEdges(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    await this.requireClient().batchDelete(this.edgeClass, ids);
  }

  // ── Read operations ───────────────────────────────────────────
  async searchByVector(embedding: number[], topK: number, filters?: NodeFilter): Promise<ScoredNode[]> {
    const res = await this.requireClient().nearVector(this.nodeClass, embedding, topK, filterToWeaviate(filters));
    return res.map((r) => ({ node: objectToNode(r.object), score: r.score }));
  }

  async searchByText(query: string, topK: number, filters?: NodeFilter): Promise<ScoredNode[]> {
    const res = await this.requireClient().bm25(this.nodeClass, query, topK, filterToWeaviate(filters));
    return res.map((r) => ({ node: objectToNode(r.object), score: r.score }));
  }

  /** Native hybrid (capabilities.hybridSearch === true) — Weaviate fuses BM25 + vector in one query. */
  async hybridSearch(query: string, embedding: number[], topK: number, filters?: NodeFilter): Promise<ScoredNode[]> {
    const res = await this.requireClient().hybrid(this.nodeClass, query, embedding, topK, filterToWeaviate(filters));
    return res.map((r) => ({ node: objectToNode(r.object), score: r.score }));
  }

  async expandFromSeeds(seedNodeIds: string[], options: ExpansionOptions): Promise<GraphSubgraph> {
    const requested = Math.max(1, options.depth ?? 1);
    const cap = this.capabilities.maxTraversalDepth ?? requested;
    const depth = Math.min(requested, cap);
    const warnings: string[] = [];
    if (requested > cap) {
      warnings.push(
        `Weaviate adapter limits traversal to depth ${cap}. Use SurrealDB or Neo4j for deeper graph reasoning.`,
      );
    }

    const maxNodes = options.maxNodes ?? Infinity;
    const visited = new Set<string>(seedNodeIds);
    const seenEdges = new Set<string>();
    const edges: GraphEdge[] = [];
    let frontier = [...seedNodeIds];

    // Application-layer expansion: one edge query per hop over the current frontier.
    for (let hop = 0; hop < depth && frontier.length > 0 && visited.size < maxNodes; hop++) {
      const rawEdges = await this.requireClient().fetchEdges(this.edgeClass, {
        nodeIds: frontier,
        ...(options.edgeTypes ? { relationTypes: options.edgeTypes } : {}),
      });
      const next: string[] = [];
      for (const e of rawEdges) {
        const from = String(e.properties.from_id ?? "");
        const to = String(e.properties.to_id ?? "");
        const rel = String(e.properties.relation_type ?? "");
        if (!from || !to) continue;
        const key = `${from}|${rel}|${to}`;
        if (!seenEdges.has(key)) {
          seenEdges.add(key);
          edges.push({ from_id: from, to_id: to, relation_type: rel });
        }
        for (const nb of [from, to]) {
          if (!visited.has(nb) && visited.size < maxNodes) {
            visited.add(nb);
            next.push(nb);
          }
        }
      }
      frontier = next;
    }

    let nodes = await this.getNodesByIds([...visited]);
    if (options.filter) nodes = nodes.filter((n) => nodeMatchesFilter(n, options.filter));
    return { nodes, edges, seedNodeIds, ...(warnings.length > 0 ? { warnings } : {}) };
  }

  async traversePaths(
    sourceNodeId: string,
    targetNodeId: string,
    maxHops: number,
    edgeTypes?: string[],
  ): Promise<GraphPath[]> {
    const cap = this.capabilities.maxTraversalDepth ?? maxHops;
    const hops = Math.min(Math.max(1, Math.floor(maxHops)), cap);

    // Breadth-first path search at the application layer, bounded by the depth cap.
    type Partial = { nodes: string[]; rels: Array<{ relation_type: string; from_node_id: string; to_node_id: string }> };
    const found: GraphPath[] = [];
    let frontier: Partial[] = [{ nodes: [sourceNodeId], rels: [] }];

    for (let hop = 0; hop < hops && frontier.length > 0; hop++) {
      const tips = [...new Set(frontier.map((p) => p.nodes[p.nodes.length - 1]))];
      const rawEdges = await this.requireClient().fetchEdges(this.edgeClass, {
        nodeIds: tips,
        ...(edgeTypes ? { relationTypes: edgeTypes } : {}),
      });
      const next: Partial[] = [];
      for (const path of frontier) {
        const tip = path.nodes[path.nodes.length - 1];
        for (const e of rawEdges) {
          const from = String(e.properties.from_id ?? "");
          const to = String(e.properties.to_id ?? "");
          const rel = String(e.properties.relation_type ?? "");
          // Undirected adjacency: take whichever endpoint extends from the current tip.
          const neighbour = from === tip ? to : to === tip ? from : null;
          if (!neighbour || path.nodes.includes(neighbour)) continue;
          const extended: Partial = {
            nodes: [...path.nodes, neighbour],
            rels: [...path.rels, { relation_type: rel, from_node_id: tip, to_node_id: neighbour }],
          };
          if (neighbour === targetNodeId) {
            found.push({ node_ids: extended.nodes, relations: extended.rels, score: 1 / extended.nodes.length });
          } else {
            next.push(extended);
          }
        }
      }
      frontier = next;
    }

    return found.sort((a, b) => a.node_ids.length - b.node_ids.length || b.score - a.score).slice(0, 25);
  }

  async getNodesByIds(ids: string[]): Promise<GraphNode[]> {
    if (ids.length === 0) return [];
    const objects = await this.requireClient().fetchByIds(this.nodeClass, ids);
    return objects.map(objectToNode);
  }

  async getEdgesBetween(nodeIds: string[]): Promise<GraphEdge[]> {
    if (nodeIds.length === 0) return [];
    const idSet = new Set(nodeIds);
    const raw = await this.requireClient().fetchEdges(this.edgeClass, { nodeIds });
    return raw
      .map((e) => ({
        from_id: String(e.properties.from_id ?? ""),
        to_id: String(e.properties.to_id ?? ""),
        relation_type: String(e.properties.relation_type ?? ""),
      }))
      .filter((e) => idSet.has(e.from_id) && idSet.has(e.to_id));
  }

  async getNeighbours(nodeId: string, depth: number, edgeTypes?: string[]): Promise<GraphSubgraph> {
    return this.expandFromSeeds([nodeId], { depth, ...(edgeTypes ? { edgeTypes } : {}) });
  }

  // ── Aggregates ────────────────────────────────────────────────
  async getWorkspaceStats(): Promise<WorkspaceGraphStats> {
    const client = this.requireClient();
    const [nodeCount, edgeCount] = await Promise.all([client.count(this.nodeClass), client.count(this.edgeClass)]);
    return { nodeCount, edgeCount };
  }

  async getVerificationBreakdown(): Promise<VerificationBreakdown> {
    const counts = await this.requireClient().aggregateCountBy(this.nodeClass, "verification_state");
    const breakdown: VerificationBreakdown = { supported: 0, weak: 0, unsupported: 0, unverified: 0, total: 0 };
    for (const [state, n] of Object.entries(counts)) {
      breakdown.total += n;
      switch (state) {
        case "supported": breakdown.supported += n; break;
        case "weak": breakdown.weak += n; break;
        case "unsupported": breakdown.unsupported += n; break;
        default: breakdown.unverified += n; break;
      }
    }
    return breakdown;
  }

  // ── internals ─────────────────────────────────────────────────
  private requireClient(): WeaviateClientLike {
    if (!this.client) throw new Error("WeaviateAdapter: not connected — call connect() with an injected client first");
    return this.client;
  }

  /** Batch upsert with one retry — Weaviate has no transactional writes (eventual consistency). */
  private async batchWithRetry(collection: string, objects: WeaviateObjectLike[]): Promise<void> {
    const client = this.requireClient();
    try {
      await client.batchUpsert(collection, objects);
    } catch {
      await client.batchUpsert(collection, objects);
    }
  }
}

export const WEAVIATE_NODE_PROPERTY_KEYS = NODE_PROPERTY_KEYS;
