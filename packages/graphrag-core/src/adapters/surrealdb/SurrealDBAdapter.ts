/**
 * SurrealDBAdapter — the reference GraphStoreAdapter implementation.
 *
 * graphrag-core deliberately ships no database driver: the host builds a
 * {@link GraphStore} (e.g. the dashboard's SurrealHttpGraphStore over the BYO
 * Surreal HTTP /sql API) and injects it here. This adapter centralises all
 * SurrealQL behind the GraphStoreAdapter interface so the orchestrator and
 * ingestion worker can be rewired to a single seam in Build 2A.
 *
 * Status (Build 1C): structural foundation. Nothing in the live retrieval/ingest
 * path calls this class yet — the orchestrator and worker still use their
 * existing code, so SOPHIA's behaviour is unchanged. Build 2A wires callers to
 * the adapter and adds the exhaustive SurrealDBAdapter.test.ts + Neo4jAdapter.
 *
 * The read traversal SurrealQL is extracted verbatim from the proven pattern in
 * orchestrator.ts (neighborsOf). The write/schema/aggregate SurrealQL follows the
 * codebase's existing conventions and is validated against the live schema in 2A.
 */
import type { GraphStore } from "../../ports.js";
import {
  type DomainPackSchema,
  type DiscoveredSchema,
  type ExpansionOptions,
  type GraphEdge,
  type GraphNode,
  type GraphPath,
  type GraphStoreAdapter,
  type GraphStoreCapabilities,
  type GraphStoreConnectionConfig,
  type GraphStoreHealthResult,
  type GraphStoreAdapterType,
  type GraphSubgraph,
  type NodeFilter,
  type ScoredNode,
  type VerificationBreakdown,
  type VerificationState,
  type WorkspaceGraphStats,
} from "../GraphStoreAdapter.js";
import { SURREALDB_CAPABILITIES } from "../capabilities.js";

/** The host supplies a ready GraphStore (SurrealDB has no in-package driver). */
export interface SurrealDBAdapterDeps {
  store: GraphStore;
  /** Edge tables to traverse when an operation does not specify edgeTypes. */
  defaultEdgeTables?: string[];
  /** Node table name (defaults to "claim"). */
  nodeTable?: string;
}

const DEFAULT_NODE_TABLE = "claim";

interface SurrealNodeRow {
  id?: unknown;
  text?: string;
  claim_type?: string;
  domain?: string;
  source_title?: string;
  confidence?: number;
  embedding?: number[];
  verification_state?: string | null;
  trust_score?: number | null;
}

function rowToNode(row: SurrealNodeRow): GraphNode {
  return {
    id: String(row.id ?? ""),
    text: row.text ?? "",
    claim_type: row.claim_type ?? "",
    domain: String(row.domain ?? ""),
    source_title: row.source_title ?? "",
    confidence: row.confidence ?? 0,
    embedding: row.embedding,
    verification_state: (row.verification_state ?? null) as VerificationState | null,
    trust_score: row.trust_score ?? null,
  };
}

/** Translate a NodeFilter into a SurrealQL WHERE fragment (without the WHERE keyword). */
function filterToWhere(filter: NodeFilter | undefined): string {
  if (!filter) return "";
  const clauses: string[] = [];
  if (filter.verificationStates && filter.verificationStates.length > 0) {
    const list = filter.verificationStates.map((s) => JSON.stringify(s)).join(", ");
    clauses.push(`verification_state IN [${list}]`);
  }
  if (typeof filter.minTrustScore === "number") {
    clauses.push(`trust_score >= ${filter.minTrustScore}`);
  }
  if (filter.excludeFlagged) {
    clauses.push(`(flagged != true)`);
  }
  if (filter.domainPack) {
    clauses.push(`domain_pack = ${JSON.stringify(filter.domainPack)}`);
  }
  if (filter.sourceDocumentIds && filter.sourceDocumentIds.length > 0) {
    const list = filter.sourceDocumentIds.map((s) => JSON.stringify(s)).join(", ");
    clauses.push(`source_document_id IN [${list}]`);
  }
  return clauses.length > 0 ? clauses.join(" AND ") : "";
}

export class SurrealDBAdapter implements GraphStoreAdapter {
  readonly adapterType: GraphStoreAdapterType = "surrealdb";
  readonly capabilities: GraphStoreCapabilities = SURREALDB_CAPABILITIES;

  private readonly store: GraphStore;
  private readonly nodeTable: string;
  private readonly defaultEdgeTables: string[];
  private config: GraphStoreConnectionConfig | null = null;

  constructor(deps: SurrealDBAdapterDeps) {
    this.store = deps.store;
    this.nodeTable = deps.nodeTable ?? DEFAULT_NODE_TABLE;
    this.defaultEdgeTables = deps.defaultEdgeTables ?? [];
  }

  // ── Lifecycle ─────────────────────────────────────────────────
  async connect(config: GraphStoreConnectionConfig): Promise<void> {
    // The GraphStore is already connected by the host; record config for reference.
    this.config = config;
  }

  async disconnect(): Promise<void> {
    // No-op: the host owns the GraphStore lifecycle.
    this.config = null;
  }

  async healthCheck(): Promise<GraphStoreHealthResult> {
    const started = Date.now();
    try {
      await this.store.query("RETURN true;");
      return { ok: true, latencyMs: Date.now() - started };
    } catch (error) {
      return {
        ok: false,
        latencyMs: Date.now() - started,
        error: error instanceof Error ? error.message : "unknown",
      };
    }
  }

  // ── Schema management ─────────────────────────────────────────
  async ensureSchema(_domainPack: DomainPackSchema): Promise<void> {
    // SurrealDB is schemaless for our usage; tables/indexes are created lazily by
    // the ingestion enhancements (ensureClaimSearchIndex / ensurePassageEmbeddingIndex).
    // Retained as a no-op so the interface is satisfied; index creation stays in
    // surreal-retrieval-enhancements until 2A consolidates it here.
  }

  async discoverSchema(): Promise<DiscoveredSchema> {
    const nodeCount = await this.count(this.nodeTable);
    return {
      nodeTypes: [
        {
          nativeLabel: this.nodeTable,
          propertyKeys: ["text", "claim_type", "domain", "source_title", "confidence", "embedding", "verification_state", "trust_score"],
          estimatedCount: nodeCount,
          hasEmbeddings: true,
          embeddingProperty: "embedding",
        },
      ],
      edgeTypes: [],
      sampleData: { nodes: [], edges: [], seedNodeIds: [] },
      estimatedNodeCount: nodeCount,
      estimatedEdgeCount: 0,
    };
  }

  async dropSchema(): Promise<void> {
    await this.store.query(`REMOVE TABLE ${this.nodeTable};`);
  }

  // ── Write operations ──────────────────────────────────────────
  async writeNodes(nodes: GraphNode[]): Promise<void> {
    for (const node of nodes) {
      await this.store.query(`CREATE type::thing($table, $id) CONTENT $content;`, {
        table: this.nodeTable,
        id: node.id,
        content: this.nodeContent(node),
      });
    }
  }

  async writeEdges(edges: GraphEdge[]): Promise<void> {
    for (const edge of edges) {
      await this.store.query(`RELATE $from->type::table($rel)->$to CONTENT $content;`, {
        from: edge.from_id,
        to: edge.to_id,
        rel: edge.relation_type,
        content: edge.properties ?? {},
      });
    }
  }

  async updateVerificationState(nodeId: string, state: VerificationState, trustScore: number): Promise<void> {
    await this.store.query(
      `UPDATE type::thing($table, $id) SET verification_state = $state, trust_score = $trust;`,
      { table: this.nodeTable, id: nodeId, state, trust: trustScore },
    );
  }

  async deleteNodes(ids: string[]): Promise<void> {
    for (const id of ids) {
      await this.store.query(`DELETE type::thing($table, $id);`, { table: this.nodeTable, id });
    }
  }

  async deleteEdges(ids: string[]): Promise<void> {
    for (const id of ids) {
      await this.store.query(`DELETE $id;`, { id });
    }
  }

  async upsertNodes(nodes: GraphNode[]): Promise<void> {
    for (const node of nodes) {
      await this.store.query(`UPSERT type::thing($table, $id) CONTENT $content;`, {
        table: this.nodeTable,
        id: node.id,
        content: this.nodeContent(node),
      });
    }
  }

  // ── Read operations ───────────────────────────────────────────
  async searchByVector(embedding: number[], topK: number, filters?: NodeFilter): Promise<ScoredNode[]> {
    const where = filterToWhere(filters);
    const whereClause = where ? `WHERE ${where}` : "";
    const rows = await this.store
      .query<SurrealNodeRow[]>(
        `SELECT *, vector::similarity::cosine(embedding, $vec) AS score FROM ${this.nodeTable} ${whereClause} ORDER BY score DESC LIMIT $k;`,
        { vec: embedding, k: topK },
      )
      .catch(() => [] as SurrealNodeRow[]);
    return (rows ?? []).map((row) => ({
      node: rowToNode(row),
      score: (row as SurrealNodeRow & { score?: number }).score ?? 0,
    }));
  }

  async searchByText(query: string, topK: number, filters?: NodeFilter): Promise<ScoredNode[]> {
    const where = filterToWhere(filters);
    const clauses = ["text @@ $q"];
    if (where) clauses.push(where);
    const rows = await this.store
      .query<SurrealNodeRow[]>(
        `SELECT *, search::score(0) AS score FROM ${this.nodeTable} WHERE ${clauses.join(" AND ")} ORDER BY score DESC LIMIT $k;`,
        { q: query, k: topK },
      )
      .catch(() => [] as SurrealNodeRow[]);
    return (rows ?? []).map((row) => ({
      node: rowToNode(row),
      score: (row as SurrealNodeRow & { score?: number }).score ?? 0,
    }));
  }

  async expandFromSeeds(seedNodeIds: string[], options: ExpansionOptions): Promise<GraphSubgraph> {
    const depth = Math.max(1, options.depth ?? 1);
    const edgeTables = options.edgeTypes && options.edgeTypes.length > 0 ? options.edgeTypes : this.defaultEdgeTables;
    const visited = new Set<string>(seedNodeIds);
    const edges: GraphEdge[] = [];
    let frontier = [...seedNodeIds];

    for (let hop = 0; hop < depth && frontier.length > 0; hop++) {
      const next: string[] = [];
      for (const nodeId of frontier) {
        for (const neighbour of await this.neighbours(nodeId, edgeTables)) {
          edges.push({
            from_id: nodeId,
            to_id: neighbour.neighborId,
            relation_type: neighbour.relationType,
          });
          if (!visited.has(neighbour.neighborId)) {
            visited.add(neighbour.neighborId);
            next.push(neighbour.neighborId);
          }
        }
      }
      frontier = next;
    }

    const nodes = await this.getNodesByIds([...visited]);
    return { nodes, edges, seedNodeIds };
  }

  async traversePaths(
    sourceNodeId: string,
    targetNodeId: string,
    maxHops: number,
    edgeTypes?: string[],
  ): Promise<GraphPath[]> {
    // BFS over edges, mirroring orchestrator.findPaths (acyclic, shortest-first).
    const edgeTables = edgeTypes && edgeTypes.length > 0 ? edgeTypes : this.defaultEdgeTables;
    const hops = Math.max(1, maxHops);
    const found: GraphPath[] = [];
    let frontier: GraphPath[] = [{ node_ids: [sourceNodeId], relations: [], score: 1 }];

    for (let hop = 0; hop < hops && frontier.length > 0; hop++) {
      const next: GraphPath[] = [];
      for (const path of frontier) {
        const last = path.node_ids[path.node_ids.length - 1];
        for (const neighbour of await this.neighbours(last, edgeTables)) {
          if (path.node_ids.includes(neighbour.neighborId)) continue;
          const extended: GraphPath = {
            node_ids: [...path.node_ids, neighbour.neighborId],
            relations: [
              ...path.relations,
              { relation_type: neighbour.relationType, from_node_id: last, to_node_id: neighbour.neighborId },
            ],
            score: path.score,
          };
          if (neighbour.neighborId === targetNodeId) found.push(extended);
          else next.push(extended);
        }
      }
      frontier = next;
    }

    found.sort((a, b) => a.node_ids.length - b.node_ids.length || b.score - a.score);
    return found;
  }

  async getNodesByIds(ids: string[]): Promise<GraphNode[]> {
    if (ids.length === 0) return [];
    const rows = await this.store
      .query<SurrealNodeRow[]>(`SELECT * FROM ${this.nodeTable} WHERE id IN $ids;`, { ids })
      .catch(() => [] as SurrealNodeRow[]);
    return (rows ?? []).map(rowToNode);
  }

  async getEdgesBetween(nodeIds: string[]): Promise<GraphEdge[]> {
    if (nodeIds.length === 0 || this.defaultEdgeTables.length === 0) return [];
    const edges: GraphEdge[] = [];
    for (const table of this.defaultEdgeTables) {
      const rows = await this.store
        .query<Array<{ in: unknown; out: unknown }>>(
          `SELECT in, out FROM ${table} WHERE in IN $ids AND out IN $ids;`,
          { ids: nodeIds },
        )
        .catch(() => [] as Array<{ in: unknown; out: unknown }>);
      for (const row of rows ?? []) {
        edges.push({ from_id: String(row.in), to_id: String(row.out), relation_type: table });
      }
    }
    return edges;
  }

  async getNeighbours(nodeId: string, depth: number, edgeTypes?: string[]): Promise<GraphSubgraph> {
    return this.expandFromSeeds([nodeId], { depth, edgeTypes });
  }

  // ── Aggregates ────────────────────────────────────────────────
  async getWorkspaceStats(): Promise<WorkspaceGraphStats> {
    return { nodeCount: await this.count(this.nodeTable), edgeCount: 0 };
  }

  async getVerificationBreakdown(): Promise<VerificationBreakdown> {
    const rows = await this.store
      .query<Array<{ verification_state?: string | null; count?: number }>>(
        `SELECT verification_state, count() AS count FROM ${this.nodeTable} GROUP BY verification_state;`,
      )
      .catch(() => [] as Array<{ verification_state?: string | null; count?: number }>);
    const breakdown: VerificationBreakdown = { supported: 0, weak: 0, unsupported: 0, unverified: 0, total: 0 };
    for (const row of rows ?? []) {
      const n = row.count ?? 0;
      breakdown.total += n;
      switch (row.verification_state) {
        case "supported": breakdown.supported += n; break;
        case "weak": breakdown.weak += n; break;
        case "unsupported": breakdown.unsupported += n; break;
        default: breakdown.unverified += n; break;
      }
    }
    return breakdown;
  }

  // ── internals ─────────────────────────────────────────────────
  private nodeContent(node: GraphNode): Record<string, unknown> {
    return {
      text: node.text,
      claim_type: node.claim_type,
      domain: node.domain,
      source_title: node.source_title,
      confidence: node.confidence,
      ...(node.embedding ? { embedding: node.embedding } : {}),
      ...(node.verification_state ? { verification_state: node.verification_state } : {}),
      ...(node.trust_score != null ? { trust_score: node.trust_score } : {}),
      ...(node.properties ?? {}),
    };
  }

  /**
   * Edge-table neighbour lookup — extracted from orchestrator.ts:neighborsOf.
   * `SELECT in, out FROM <edge> WHERE in = $node OR out = $node` per edge table.
   */
  private async neighbours(
    nodeId: string,
    edgeTables: string[],
  ): Promise<Array<{ neighborId: string; relationType: string }>> {
    const out: Array<{ neighborId: string; relationType: string }> = [];
    for (const table of edgeTables) {
      const rows = await this.store
        .query<Array<{ in: unknown; out: unknown }>>(
          `SELECT in, out FROM ${table} WHERE in = $node OR out = $node`,
          { node: nodeId },
        )
        .catch(() => [] as Array<{ in: unknown; out: unknown }>);
      for (const row of rows ?? []) {
        const inId = String(row.in);
        const outId = String(row.out);
        if (inId === nodeId && outId !== nodeId) out.push({ neighborId: outId, relationType: table });
        else if (outId === nodeId && inId !== nodeId) out.push({ neighborId: inId, relationType: table });
      }
    }
    return out;
  }

  private async count(table: string): Promise<number> {
    const rows = await this.store
      .query<Array<{ count?: number }>>(`SELECT count() AS count FROM ${table} GROUP ALL;`)
      .catch(() => [] as Array<{ count?: number }>);
    return rows?.[0]?.count ?? 0;
  }
}
