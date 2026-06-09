/**
 * GraphStoreAdapter — the single interface the ingestion pipeline and retrieval
 * orchestrator interact with. All database-specific code lives behind it, so any
 * future graph database (Neo4j, Weaviate, Neptune, ArangoDB) can be added by
 * implementing this interface without touching pipeline or orchestrator code.
 *
 * SurrealDB is the reference implementation (see ./surrealdb/SurrealDBAdapter.ts).
 *
 * Foundation introduced in Build 1C. The orchestrator/worker are wired to call
 * these methods (and the adapters are exhaustively tested) in Build 2A — see
 * docs/requirements/graph_store_adapter_architecture.md.
 */

export type GraphStoreAdapterType =
  | "surrealdb"
  | "neo4j"
  | "weaviate"
  | "neptune"
  | "arangodb";

/** Verification lifecycle state for a node (claim). */
export type VerificationState =
  | "supported"
  | "weak"
  | "unsupported"
  | "unverified";

export interface GraphStoreCapabilities {
  /** Vector KNN in the same engine. */
  nativeVectorSearch: boolean;
  /** Multi-hop traversal at the DB layer (vs application-layer expansion). */
  nativeGraphTraversal: boolean;
  /** Vector + keyword in one query. */
  hybridSearch: boolean;
  /** ACID transactions on ingestion writes. */
  transactionalWrites: boolean;
  /** Cursor/stream for large result sets. */
  streamingResults: boolean;
  /** null = unlimited. */
  maxTraversalDepth: number | null;
}

/**
 * Opaque, encrypted-at-rest credential bag. Adapters decrypt only at connect time.
 * Different adapters use different shapes (password, apiKey, IAM, token).
 */
export interface GraphStoreCredentials {
  username?: string;
  password?: string;
  apiKey?: string;
  token?: string;
  region?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  [key: string]: string | undefined;
}

/** Mapping of a foreign schema onto Restormel concepts (schemaMode = 'existing'). */
export interface SchemaMappings {
  /** native node label → Restormel node type (e.g. "Claim", "Entity"). */
  nodeTypes?: Record<string, string>;
  /** native edge label → Restormel relation type. */
  edgeTypes?: Record<string, string>;
  /** property on nodes holding the embedding vector. */
  embeddingProperty?: string;
  /** property on nodes holding the trust score. */
  trustScoreProperty?: string;
}

export interface GraphStoreConnectionConfig {
  type: GraphStoreAdapterType;
  /** SurrealDB / Neo4j bolt URI. */
  connectionString?: string;
  /** Weaviate / Neptune endpoint. */
  endpoint?: string;
  credentials: GraphStoreCredentials;
  database?: string;
  /** SurrealDB namespace. */
  namespace?: string;
  /** Weaviate collection/class prefix. */
  collectionPrefix?: string;
  schemaMode: "fresh" | "existing" | "readonly";
  /** Only when schemaMode = 'existing'. */
  mappings?: SchemaMappings;
}

export interface GraphStoreHealthResult {
  ok: boolean;
  latencyMs?: number;
  error?: string;
  detail?: string;
}

/** A graph node (claim). Embeddings are raw number[] — never DB-specific vector types. */
export interface GraphNode {
  id: string;
  text: string;
  claim_type: string;
  domain: string;
  source_title: string;
  confidence: number;
  embedding?: number[];
  verification_state?: VerificationState | null;
  trust_score?: number | null;
  /** Adapter-specific extra properties (kept opaque to application code). */
  properties?: Record<string, unknown>;
}

export interface GraphEdge {
  id?: string;
  from_id: string;
  to_id: string;
  relation_type: string;
  properties?: Record<string, unknown>;
}

export interface ScoredNode {
  node: GraphNode;
  score: number;
}

export interface GraphSubgraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  seedNodeIds: string[];
  /**
   * Adapter advisories surfaced into the retrieval trace — e.g. an adapter that clamped a
   * requested traversal depth to its `maxTraversalDepth`. Empty/undefined when there is nothing
   * to report.
   */
  warnings?: string[];
}

export interface GraphPathStep {
  relation_type: string;
  from_node_id: string;
  to_node_id: string;
}

export interface GraphPath {
  node_ids: string[];
  relations: GraphPathStep[];
  /** Product of edge priors along the path (higher = stronger). */
  score: number;
}

/** Verification filter translated by each adapter into its native query predicate. */
export interface NodeFilter {
  verificationStates?: VerificationState[];
  minTrustScore?: number;
  excludeFlagged?: boolean;
  domainPack?: string;
  sourceDocumentIds?: string[];
}

export interface ExpansionOptions {
  depth?: number;
  edgeTypes?: string[];
  filter?: NodeFilter;
  maxNodes?: number;
}

/**
 * Minimal structural description of a domain pack's graph schema. Kept loose so
 * graphrag-core stays decoupled from the dashboard's full domain-pack type.
 */
export interface DomainPackSchema {
  id?: string;
  slug?: string;
  nodeLabels?: string[];
  edgeTypes?: string[];
  embeddingDimensions?: number;
  [key: string]: unknown;
}

export interface DiscoveredNodeType {
  nativeLabel: string;
  propertyKeys: string[];
  estimatedCount: number;
  hasEmbeddings: boolean;
  embeddingProperty?: string;
}

export interface DiscoveredEdgeType {
  nativeLabel: string;
  propertyKeys: string[];
  estimatedCount: number;
}

export interface DiscoveredSchema {
  nodeTypes: DiscoveredNodeType[];
  edgeTypes: DiscoveredEdgeType[];
  /** Small sample for preview. */
  sampleData: GraphSubgraph;
  estimatedNodeCount: number;
  estimatedEdgeCount: number;
}

export interface WorkspaceGraphStats {
  nodeCount: number;
  edgeCount: number;
  nodeTypeCounts?: Record<string, number>;
  edgeTypeCounts?: Record<string, number>;
}

export interface VerificationBreakdown {
  supported: number;
  weak: number;
  unsupported: number;
  unverified: number;
  total: number;
}

export interface GraphStoreAdapter {
  // ── Identity ──────────────────────────────────────────────────
  readonly adapterType: GraphStoreAdapterType;
  readonly capabilities: GraphStoreCapabilities;

  // ── Lifecycle ─────────────────────────────────────────────────
  connect(config: GraphStoreConnectionConfig): Promise<void>;
  disconnect(): Promise<void>;
  healthCheck(): Promise<GraphStoreHealthResult>;

  // ── Schema management ─────────────────────────────────────────
  ensureSchema(domainPack: DomainPackSchema): Promise<void>;
  discoverSchema(): Promise<DiscoveredSchema>;
  dropSchema(): Promise<void>;

  // ── Write operations (ingestion pipeline) ─────────────────────
  writeNodes(nodes: GraphNode[]): Promise<void>;
  writeEdges(edges: GraphEdge[]): Promise<void>;
  updateVerificationState(
    nodeId: string,
    state: VerificationState,
    trustScore: number,
  ): Promise<void>;
  deleteNodes(ids: string[]): Promise<void>;
  deleteEdges(ids: string[]): Promise<void>;
  upsertNodes(nodes: GraphNode[]): Promise<void>;

  // ── Read operations (retrieval orchestrator) ──────────────────
  searchByVector(embedding: number[], topK: number, filters?: NodeFilter): Promise<ScoredNode[]>;
  searchByText(query: string, topK: number, filters?: NodeFilter): Promise<ScoredNode[]>;
  expandFromSeeds(seedNodeIds: string[], options: ExpansionOptions): Promise<GraphSubgraph>;
  traversePaths(
    sourceNodeId: string,
    targetNodeId: string,
    maxHops: number,
    edgeTypes?: string[],
  ): Promise<GraphPath[]>;
  getNodesByIds(ids: string[]): Promise<GraphNode[]>;
  getEdgesBetween(nodeIds: string[]): Promise<GraphEdge[]>;
  getNeighbours(nodeId: string, depth: number, edgeTypes?: string[]): Promise<GraphSubgraph>;

  // ── Aggregates ────────────────────────────────────────────────
  getWorkspaceStats(): Promise<WorkspaceGraphStats>;
  getVerificationBreakdown(): Promise<VerificationBreakdown>;
}
