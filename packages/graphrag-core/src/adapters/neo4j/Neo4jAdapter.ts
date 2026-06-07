/**
 * Neo4jAdapter — GraphStoreAdapter implementation for Neo4j 5.x (Aura or self-hosted).
 *
 * graphrag-core ships no database driver (see SurrealDBAdapter). To stay
 * dependency-free and type-checkable without `neo4j-driver` installed, this
 * module defines the minimal driver surface it uses ({@link Neo4jDriverLike})
 * and dynamically `import()`s the real `neo4j-driver` at connect() time. Hosts
 * that use Neo4j must have `neo4j-driver` installed; tests inject a fake driver.
 *
 * Capabilities (see capabilities.ts → NEO4J_CAPABILITIES): native vector KNN
 * (5.x vector index), native traversal (variable-length MATCH), no single-query
 * hybrid (vector + fulltext run separately and merge via RRF — see hybridSearch).
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
import { NEO4J_CAPABILITIES } from "../capabilities.js";
import {
  CLAIM_LABEL,
  NEO4J_INDEX_NAMES,
  buildNeo4jSchemaStatements,
  escapeCypherIdentifier,
  type Neo4jSchemaOptions,
} from "./neo4j-schema.js";

// ── Minimal neo4j-driver surface (avoids a hard dependency on the package) ──

export interface Neo4jRecordLike {
  get(key: string): unknown;
}
export interface Neo4jQueryResultLike {
  records: Neo4jRecordLike[];
}
export interface Neo4jSessionLike {
  run(query: string, params?: Record<string, unknown>): Promise<Neo4jQueryResultLike>;
  close(): Promise<void>;
}
export interface Neo4jDriverLike {
  session(config?: { database?: string }): Neo4jSessionLike;
  verifyConnectivity?(): Promise<unknown>;
  close(): Promise<void>;
}

export interface Neo4jAdapterDeps {
  /** Inject a driver (tests / hosts that own the driver lifecycle). When omitted, connect() builds one. */
  driver?: Neo4jDriverLike;
  /** Node label (defaults to "Claim"). */
  nodeLabel?: string;
  /** Schema options forwarded to ensureSchema's DDL. */
  schema?: Neo4jSchemaOptions;
}

/** A node-like value from a Cypher record may be the raw props or `{ properties }`. */
interface MaybeNeo4jNode {
  properties?: Record<string, unknown>;
  [key: string]: unknown;
}

/** Coerce Neo4j integer/number shapes to a JS number. */
function toNumber(value: unknown): number {
  if (typeof value === "number") return value;
  if (value && typeof value === "object") {
    const v = value as { toNumber?: () => number; low?: number };
    if (typeof v.toNumber === "function") return v.toNumber();
    if (typeof v.low === "number") return v.low;
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function nodeFromNeo4j(raw: unknown): GraphNode {
  const obj = (raw ?? {}) as MaybeNeo4jNode;
  const props = (obj.properties ?? obj) as Record<string, unknown>;
  return {
    id: String(props.id ?? ""),
    text: typeof props.text === "string" ? props.text : "",
    claim_type: typeof props.claim_type === "string" ? props.claim_type : "",
    domain: String(props.domain ?? ""),
    source_title: typeof props.source_title === "string" ? props.source_title : "",
    confidence: toNumber(props.confidence),
    embedding: Array.isArray(props.embedding) ? (props.embedding as number[]) : undefined,
    verification_state: (props.verification_state ?? null) as VerificationState | null,
    trust_score: props.trust_score == null ? null : toNumber(props.trust_score),
  };
}

/** Build a Cypher predicate fragment for a NodeFilter, bound on alias `n`. */
function filterToCypher(filter: NodeFilter | undefined, alias = "n"): { clause: string; params: Record<string, unknown> } {
  if (!filter) return { clause: "", params: {} };
  const clauses: string[] = [];
  const params: Record<string, unknown> = {};
  if (filter.verificationStates && filter.verificationStates.length > 0) {
    clauses.push(`${alias}.verification_state IN $f_states`);
    params.f_states = filter.verificationStates;
  }
  if (typeof filter.minTrustScore === "number") {
    clauses.push(`${alias}.trust_score >= $f_minTrust`);
    params.f_minTrust = filter.minTrustScore;
  }
  if (filter.excludeFlagged) {
    clauses.push(`coalesce(${alias}.flagged, false) = false`);
  }
  if (filter.domainPack) {
    clauses.push(`${alias}.domain_pack = $f_domainPack`);
    params.f_domainPack = filter.domainPack;
  }
  if (filter.sourceDocumentIds && filter.sourceDocumentIds.length > 0) {
    clauses.push(`${alias}.source_document_id IN $f_sourceDocs`);
    params.f_sourceDocs = filter.sourceDocumentIds;
  }
  return { clause: clauses.join(" AND "), params };
}

/** Reciprocal Rank Fusion: merge ranked lists by 1/(k + rank). Higher score = better. */
export function reciprocalRankFusion(lists: ScoredNode[][], k = 60): ScoredNode[] {
  const byId = new Map<string, { node: GraphNode; score: number }>();
  for (const list of lists) {
    list.forEach((scored, index) => {
      const id = scored.node.id;
      const contribution = 1 / (k + index + 1);
      const existing = byId.get(id);
      if (existing) existing.score += contribution;
      else byId.set(id, { node: scored.node, score: contribution });
    });
  }
  return [...byId.values()].sort((a, b) => b.score - a.score);
}

export class Neo4jAdapter implements GraphStoreAdapter {
  readonly adapterType: GraphStoreAdapterType = "neo4j";
  readonly capabilities: GraphStoreCapabilities = NEO4J_CAPABILITIES;

  private driver: Neo4jDriverLike | null;
  private readonly label: string;
  private readonly escapedLabel: string;
  private readonly schemaOptions: Neo4jSchemaOptions;
  private database: string | undefined;

  constructor(deps: Neo4jAdapterDeps = {}) {
    this.driver = deps.driver ?? null;
    this.label = deps.nodeLabel ?? deps.schema?.nodeLabel ?? CLAIM_LABEL;
    this.escapedLabel = escapeCypherIdentifier(this.label);
    this.schemaOptions = { ...deps.schema, nodeLabel: this.label };
  }

  // ── Lifecycle ─────────────────────────────────────────────────
  async connect(config: GraphStoreConnectionConfig): Promise<void> {
    this.database = config.database ?? this.database ?? "neo4j";
    if (this.driver) return; // host-injected driver
    const uri = config.connectionString ?? config.endpoint;
    if (!uri) throw new Error("Neo4jAdapter.connect: connectionString (bolt:// or neo4j+s://) is required");
    const neo4j = await this.loadDriverModule();
    this.driver = neo4j.driver(
      uri,
      neo4j.auth.basic(config.credentials.username ?? "neo4j", config.credentials.password ?? ""),
    ) as Neo4jDriverLike;
  }

  async disconnect(): Promise<void> {
    if (this.driver) await this.driver.close();
    this.driver = null;
  }

  async healthCheck(): Promise<GraphStoreHealthResult> {
    const started = Date.now();
    try {
      if (this.driver?.verifyConnectivity) await this.driver.verifyConnectivity();
      else await this.run("RETURN 1 AS ok");
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
  async ensureSchema(domainPack: DomainPackSchema): Promise<void> {
    for (const stmt of buildNeo4jSchemaStatements(domainPack, this.schemaOptions)) {
      await this.run(stmt);
    }
  }

  async discoverSchema(): Promise<DiscoveredSchema> {
    const countRes = await this.run(`MATCH (c:${this.escapedLabel}) RETURN count(c) AS n`);
    const nodeCount = toNumber(countRes.records[0]?.get("n"));
    const relRes = await this.run(`MATCH ()-[r]->() RETURN count(r) AS n`);
    const edgeCount = toNumber(relRes.records[0]?.get("n"));
    return {
      nodeTypes: [
        {
          nativeLabel: this.label,
          propertyKeys: ["id", "text", "claim_type", "domain", "source_title", "confidence", "embedding", "verification_state", "trust_score"],
          estimatedCount: nodeCount,
          hasEmbeddings: true,
          embeddingProperty: "embedding",
        },
      ],
      edgeTypes: [],
      sampleData: { nodes: [], edges: [], seedNodeIds: [] },
      estimatedNodeCount: nodeCount,
      estimatedEdgeCount: edgeCount,
    };
  }

  async dropSchema(): Promise<void> {
    await this.run(`MATCH (c:${this.escapedLabel}) DETACH DELETE c`);
    // Drop the indexes/constraint we created so a re-provision starts clean.
    for (const name of [NEO4J_INDEX_NAMES.vector, NEO4J_INDEX_NAMES.fulltext]) {
      await this.run(`DROP INDEX ${name} IF EXISTS`).catch(() => undefined);
    }
    await this.run(`DROP CONSTRAINT ${NEO4J_INDEX_NAMES.claimId} IF EXISTS`).catch(() => undefined);
  }

  // ── Write operations ──────────────────────────────────────────
  async writeNodes(nodes: GraphNode[]): Promise<void> {
    if (nodes.length === 0) return;
    await this.run(
      `UNWIND $nodes AS n
       MERGE (c:${this.escapedLabel} { id: n.id })
       SET c.text = n.text, c.claim_type = n.claim_type, c.domain = n.domain,
           c.source_title = n.source_title, c.confidence = n.confidence,
           c.verification_state = n.verification_state, c.trust_score = n.trust_score
       FOREACH (_ IN CASE WHEN n.embedding IS NULL THEN [] ELSE [1] END |
         SET c.embedding = n.embedding)`,
      { nodes: nodes.map((node) => this.nodeParams(node)) },
    );
  }

  async upsertNodes(nodes: GraphNode[]): Promise<void> {
    // MERGE-based writeNodes is already idempotent (upsert semantics).
    await this.writeNodes(nodes);
  }

  async writeEdges(edges: GraphEdge[]): Promise<void> {
    if (edges.length === 0) return;
    // Relationship types cannot be parameterised — group by type and inline a
    // sanitised, backtick-escaped literal per group.
    const byType = new Map<string, GraphEdge[]>();
    for (const edge of edges) {
      const list = byType.get(edge.relation_type) ?? [];
      list.push(edge);
      byType.set(edge.relation_type, list);
    }
    for (const [relType, group] of byType) {
      await this.run(
        `UNWIND $edges AS e
         MATCH (a:${this.escapedLabel} { id: e.from_id }), (b:${this.escapedLabel} { id: e.to_id })
         MERGE (a)-[r:${escapeCypherIdentifier(relType)}]->(b)
         SET r += e.properties`,
        { edges: group.map((e) => ({ from_id: e.from_id, to_id: e.to_id, properties: e.properties ?? {} })) },
      );
    }
  }

  async updateVerificationState(nodeId: string, state: VerificationState, trustScore: number): Promise<void> {
    await this.run(
      `MATCH (c:${this.escapedLabel} { id: $id }) SET c.verification_state = $state, c.trust_score = $trust`,
      { id: nodeId, state, trust: trustScore },
    );
  }

  async deleteNodes(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    await this.run(`MATCH (c:${this.escapedLabel}) WHERE c.id IN $ids DETACH DELETE c`, { ids });
  }

  async deleteEdges(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    await this.run(`MATCH ()-[r]->() WHERE elementId(r) IN $ids DELETE r`, { ids });
  }

  // ── Read operations ───────────────────────────────────────────
  async searchByVector(embedding: number[], topK: number, filters?: NodeFilter): Promise<ScoredNode[]> {
    const { clause, params } = filterToCypher(filters, "node");
    const where = clause ? `WHERE ${clause}` : "";
    const res = await this.run(
      `CALL db.index.vector.queryNodes($index, $k, $vec) YIELD node, score
       ${where}
       RETURN node, score ORDER BY score DESC`,
      { index: NEO4J_INDEX_NAMES.vector, k: topK, vec: embedding, ...params },
    );
    return res.records.map((r) => ({ node: nodeFromNeo4j(r.get("node")), score: toNumber(r.get("score")) }));
  }

  async searchByText(query: string, topK: number, filters?: NodeFilter): Promise<ScoredNode[]> {
    const { clause, params } = filterToCypher(filters, "node");
    const where = clause ? `WHERE ${clause}` : "";
    const res = await this.run(
      `CALL db.index.fulltext.queryNodes($index, $q) YIELD node, score
       ${where}
       RETURN node, score ORDER BY score DESC LIMIT $k`,
      { index: NEO4J_INDEX_NAMES.fulltext, q: query, k: topK, ...params },
    );
    return res.records.map((r) => ({ node: nodeFromNeo4j(r.get("node")), score: toNumber(r.get("score")) }));
  }

  /**
   * Adapter-specific hybrid search (capabilities.hybridSearch is false → caller
   * opts in explicitly). Runs vector + fulltext separately and fuses with RRF.
   */
  async hybridSearch(
    query: string,
    embedding: number[],
    topK: number,
    filters?: NodeFilter,
  ): Promise<ScoredNode[]> {
    const [vector, text] = await Promise.all([
      this.searchByVector(embedding, topK, filters),
      this.searchByText(query, topK, filters),
    ]);
    return reciprocalRankFusion([vector, text]).slice(0, topK);
  }

  async expandFromSeeds(seedNodeIds: string[], options: ExpansionOptions): Promise<GraphSubgraph> {
    const depth = Math.max(1, options.depth ?? 1);
    const maxNodes = options.maxNodes ?? Infinity;
    const relPattern = this.relTypePattern(options.edgeTypes);
    const visited = new Set<string>(seedNodeIds);
    const edges: GraphEdge[] = [];
    let frontier = [...seedNodeIds];

    // Beam search: one targeted Cypher query per hop over the current frontier.
    for (let hop = 0; hop < depth && frontier.length > 0 && visited.size < maxNodes; hop++) {
      const res = await this.run(
        `MATCH (a:${this.escapedLabel})-[r${relPattern}]-(b:${this.escapedLabel})
         WHERE a.id IN $frontier
         RETURN a.id AS from, b.id AS to, type(r) AS rel`,
        { frontier },
      );
      const next: string[] = [];
      for (const record of res.records) {
        const from = String(record.get("from"));
        const to = String(record.get("to"));
        const rel = String(record.get("rel"));
        edges.push({ from_id: from, to_id: to, relation_type: rel });
        if (!visited.has(to) && visited.size < maxNodes) {
          visited.add(to);
          next.push(to);
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
    // Variable-length bounds must be literal; sanitise maxHops to a small int.
    const hops = Math.min(Math.max(1, Math.floor(maxHops)), 8);
    const relPattern = this.relTypePattern(edgeTypes);
    const res = await this.run(
      `MATCH path = (a:${this.escapedLabel} { id: $source })-[r${relPattern}*1..${hops}]->(b:${this.escapedLabel} { id: $target })
       RETURN [n IN nodes(path) | n.id] AS node_ids,
              [rel IN relationships(path) | { type: type(rel), from: startNode(rel).id, to: endNode(rel).id }] AS rels
       ORDER BY length(path) ASC
       LIMIT 25`,
      { source: sourceNodeId, target: targetNodeId },
    );
    return res.records.map((record) => {
      const nodeIds = (record.get("node_ids") as unknown[]).map(String);
      const rels = (record.get("rels") as Array<{ type: string; from: string; to: string }>) ?? [];
      return {
        node_ids: nodeIds,
        relations: rels.map((rel) => ({
          relation_type: String(rel.type),
          from_node_id: String(rel.from),
          to_node_id: String(rel.to),
        })),
        // No stored edge priors yet — prefer shorter paths.
        score: 1 / Math.max(1, nodeIds.length),
      };
    });
  }

  async getNodesByIds(ids: string[]): Promise<GraphNode[]> {
    if (ids.length === 0) return [];
    const res = await this.run(`MATCH (c:${this.escapedLabel}) WHERE c.id IN $ids RETURN c`, { ids });
    return res.records.map((r) => nodeFromNeo4j(r.get("c")));
  }

  async getEdgesBetween(nodeIds: string[]): Promise<GraphEdge[]> {
    if (nodeIds.length === 0) return [];
    const res = await this.run(
      `MATCH (a:${this.escapedLabel})-[r]->(b:${this.escapedLabel})
       WHERE a.id IN $ids AND b.id IN $ids
       RETURN a.id AS from, b.id AS to, type(r) AS rel`,
      { ids: nodeIds },
    );
    return res.records.map((record) => ({
      from_id: String(record.get("from")),
      to_id: String(record.get("to")),
      relation_type: String(record.get("rel")),
    }));
  }

  async getNeighbours(nodeId: string, depth: number, edgeTypes?: string[]): Promise<GraphSubgraph> {
    return this.expandFromSeeds([nodeId], { depth, edgeTypes });
  }

  // ── Aggregates ────────────────────────────────────────────────
  async getWorkspaceStats(): Promise<WorkspaceGraphStats> {
    const nodeRes = await this.run(`MATCH (c:${this.escapedLabel}) RETURN count(c) AS n`);
    const edgeRes = await this.run(`MATCH (:${this.escapedLabel})-[r]->(:${this.escapedLabel}) RETURN count(r) AS n`);
    return {
      nodeCount: toNumber(nodeRes.records[0]?.get("n")),
      edgeCount: toNumber(edgeRes.records[0]?.get("n")),
    };
  }

  async getVerificationBreakdown(): Promise<VerificationBreakdown> {
    const res = await this.run(
      `MATCH (c:${this.escapedLabel})
       RETURN c.verification_state AS state, count(*) AS count`,
    );
    const breakdown: VerificationBreakdown = { supported: 0, weak: 0, unsupported: 0, unverified: 0, total: 0 };
    for (const record of res.records) {
      const state = record.get("state");
      const n = toNumber(record.get("count"));
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
  private nodeParams(node: GraphNode): Record<string, unknown> {
    return {
      id: node.id,
      text: node.text,
      claim_type: node.claim_type,
      domain: node.domain,
      source_title: node.source_title,
      confidence: node.confidence,
      verification_state: node.verification_state ?? null,
      trust_score: node.trust_score ?? null,
      embedding: node.embedding ?? null,
    };
  }

  /** Build a `:`-prefixed relationship type alternation (`:`A`|`B``) or "" for any type. */
  private relTypePattern(edgeTypes?: string[]): string {
    if (!edgeTypes || edgeTypes.length === 0) return "";
    return `:${edgeTypes.map(escapeCypherIdentifier).join("|")}`;
  }

  private async run(query: string, params: Record<string, unknown> = {}): Promise<Neo4jQueryResultLike> {
    const driver = this.driver;
    if (!driver) throw new Error("Neo4jAdapter: not connected — call connect() first");
    const session = driver.session(this.database ? { database: this.database } : undefined);
    try {
      return await session.run(query, params);
    } finally {
      await session.close();
    }
  }

  private async loadDriverModule(): Promise<{
    driver: (uri: string, auth: unknown) => unknown;
    auth: { basic: (user: string, pass: string) => unknown };
  }> {
    try {
      // Dynamic import via a non-literal specifier keeps neo4j-driver an optional,
      // host-provided dependency (no static module resolution at build time).
      const specifier = "neo4j-driver";
      const mod = (await import(/* @vite-ignore */ specifier)) as unknown as {
        default?: unknown;
        driver?: unknown;
        auth?: unknown;
      };
      const resolved = (mod.driver ? mod : mod.default) as {
        driver: (uri: string, auth: unknown) => unknown;
        auth: { basic: (user: string, pass: string) => unknown };
      };
      if (!resolved?.driver || !resolved?.auth) throw new Error("neo4j-driver module shape unexpected");
      return resolved;
    } catch (error) {
      throw new Error(
        "Neo4jAdapter requires the 'neo4j-driver' package to be installed by the host " +
          `(or inject a driver via deps.driver). ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
