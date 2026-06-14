---
title: Restormel — Database-Agnostic Graph Store Architecture
class: technical
owner: founder
status: approved
classification: internal
control-tier: 1
created: 2026-06-07
last-reviewed: 2026-06-07
review-interval: P12M
---

# Restormel — Database-Agnostic Graph Store Architecture

**Status:** Planning  
**Scope:** Graph store adapter layer enabling Neo4j, Weaviate, Amazon Neptune,
and ArangoDB as alternatives to SurrealDB. SurrealDB remains fully supported
and the reference implementation.

---

## Problem statement

Restormel currently requires SurrealDB as its graph store. This creates two
adoption blockers:

1. Teams evaluating Restormel who have an existing knowledge graph in Neo4j,
   Weaviate, or Neptune cannot use Restormel without migrating their data.
2. Teams with no existing graph store must evaluate SurrealDB alongside
   Restormel, adding a procurement and learning decision to what should be
   a simple "try this product" experience.

The goal is not to support every graph database. It is to support the databases
where the market lives — primarily Neo4j for enterprise teams with existing
graphs, and Weaviate for developer teams already building RAG infrastructure.

---

## Database tier list

### Tier 1 — Build in the first implementation sprint

**SurrealDB (current):**
Already implemented. Reference implementation for all adapter work.
Retain and maintain. Cheapest managed cloud option. Recommended default
for new users with no existing graph.

**Neo4j / Neo4j Aura:**
Largest enterprise graph database. Cypher query language. Vector indexes
in Neo4j 5.x (HNSW, cosine similarity). Production-ready managed cloud
(Aura). The single most important addition for enterprise adoption.

**Weaviate:**
Largest developer RAG community. Native hybrid vector + BM25 search.
Cross-references approximate graph edges. Multi-hop traversal requires
application-level implementation (documented limitation). Critical for
teams already using Weaviate who want Restormel's verification layer.

### Tier 2 — Design in sprint 1, build in sprint 2

**Amazon Neptune + Neptune Analytics:**
AWS-native managed graph database. Neptune Analytics adds vector search.
Gremlin query language. Important for enterprise AWS users.

**ArangoDB:**
Multi-model (document + graph + vector) with AQL. Technically strong fit.
Lower market share but efficient to add after Neo4j.

### Not in scope

Pinecone, Qdrant, Chroma, MongoDB Atlas: no native graph structure.
Restormel's beam search and provenance model require graph topology.

---

## Core abstraction: GraphStoreAdapter

The adapter is the only interface the ingestion pipeline and retrieval
orchestrator interact with. All database-specific code lives behind it.

### The interface

```typescript
// packages/graphrag-core/src/adapters/GraphStoreAdapter.ts

export interface GraphStoreAdapter {
  // ── Identity ──────────────────────────────────────────────────
  readonly adapterType: GraphStoreAdapterType
  readonly capabilities: GraphStoreCapabilities

  // ── Lifecycle ─────────────────────────────────────────────────
  connect(config: GraphStoreConnectionConfig): Promise<void>
  disconnect(): Promise<void>
  healthCheck(): Promise<GraphStoreHealthResult>

  // ── Schema management ─────────────────────────────────────────
  ensureSchema(domainPack: DomainPackSchema): Promise<void>
  discoverSchema(): Promise<DiscoveredSchema>
  dropSchema(): Promise<void>

  // ── Write operations (ingestion pipeline) ─────────────────────
  writeNodes(nodes: GraphNode[]): Promise<void>
  writeEdges(edges: GraphEdge[]): Promise<void>
  updateVerificationState(
    nodeId: string,
    state: VerificationState,
    trustScore: number
  ): Promise<void>
  deleteNodes(ids: string[]): Promise<void>
  deleteEdges(ids: string[]): Promise<void>
  upsertNodes(nodes: GraphNode[]): Promise<void>

  // ── Read operations (retrieval orchestrator) ──────────────────
  searchByVector(
    embedding: number[],
    topK: number,
    filters?: NodeFilter
  ): Promise<ScoredNode[]>

  searchByText(
    query: string,
    topK: number,
    filters?: NodeFilter
  ): Promise<ScoredNode[]>

  expandFromSeeds(
    seedNodeIds: string[],
    options: ExpansionOptions
  ): Promise<GraphSubgraph>

  traversePaths(
    sourceNodeId: string,
    targetNodeId: string,
    maxHops: number,
    edgeTypes?: string[]
  ): Promise<GraphPath[]>

  getNodesByIds(ids: string[]): Promise<GraphNode[]>
  getEdgesBetween(nodeIds: string[]): Promise<GraphEdge[]>
  getNeighbours(
    nodeId: string,
    depth: number,
    edgeTypes?: string[]
  ): Promise<GraphSubgraph>

  // ── Aggregates ────────────────────────────────────────────────
  getWorkspaceStats(): Promise<WorkspaceGraphStats>
  getVerificationBreakdown(): Promise<VerificationBreakdown>
}

export type GraphStoreAdapterType =
  | 'surrealdb'
  | 'neo4j'
  | 'weaviate'
  | 'neptune'
  | 'arangodb'

export interface GraphStoreCapabilities {
  nativeVectorSearch: boolean      // vector KNN in the same engine
  nativeGraphTraversal: boolean    // multi-hop traversal at the DB layer
  hybridSearch: boolean            // vector + keyword in one query
  transactionalWrites: boolean     // ACID transactions on ingestion writes
  streamingResults: boolean        // cursor/stream for large result sets
  maxTraversalDepth: number | null // null = unlimited
}
```

### Capability declarations per adapter

```typescript
// Neo4j capabilities
const NEO4J_CAPABILITIES: GraphStoreCapabilities = {
  nativeVectorSearch: true,      // Neo4j 5.x vector indexes
  nativeGraphTraversal: true,    // Cypher MATCH path expressions
  hybridSearch: false,           // vector + keyword requires separate queries + merge
  transactionalWrites: true,
  streamingResults: true,
  maxTraversalDepth: null
}

// Weaviate capabilities
const WEAVIATE_CAPABILITIES: GraphStoreCapabilities = {
  nativeVectorSearch: true,      // best-in-class
  nativeGraphTraversal: false,   // cross-references only; traversal at app layer
  hybridSearch: true,            // native BM25 + vector hybrid
  transactionalWrites: false,    // eventual consistency model
  streamingResults: true,
  maxTraversalDepth: 2           // application-layer limit to avoid N+1 blowout
}

// SurrealDB capabilities (reference)
const SURREALDB_CAPABILITIES: GraphStoreCapabilities = {
  nativeVectorSearch: true,      // HNSW/MTREE vector indexes
  nativeGraphTraversal: true,    // RELATE, graph traversal operators
  hybridSearch: false,           // vector + BM25 requires separate queries
  transactionalWrites: true,
  streamingResults: false,       // polling-based for large results
  maxTraversalDepth: null
}
```

The retrieval orchestrator reads `capabilities` before planning a query
strategy. If `nativeGraphTraversal: false`, it falls back to application-layer
expansion. If `hybridSearch: false`, it runs vector and text searches separately
and merges results. This keeps the orchestrator adapter-aware without leaking
database specifics upward.

---

## Schema mapping for existing graphs

The hardest problem in database-agnostic support is not connecting a new empty
database. It is letting a user point Restormel at an existing Neo4j graph with
its own node labels and relationship types and have Restormel work with it.

### Three modes

**Mode 1 — Fresh start (default for new users)**
Restormel creates the schema from the domain pack. No mapping needed.
The adapter's `ensureSchema()` call creates the required node types, edge
types, and indexes. This is the current behaviour and remains unchanged.

**Mode 2 — Schema discovery (existing graphs)**
User connects their existing database. Restormel's `discoverSchema()` reads
the actual node labels/types and relationship types present. Returns a
`DiscoveredSchema` object with the raw structure.
The Connect dashboard shows the discovered schema and prompts the user to
map it to a Restormel domain pack — either an existing pack or a new one
generated from the discovered schema.

```typescript
interface DiscoveredSchema {
  nodeTypes: DiscoveredNodeType[]
  edgeTypes: DiscoveredEdgeType[]
  sampleData: GraphSubgraph  // small sample for preview
  estimatedNodeCount: number
  estimatedEdgeCount: number
}

interface DiscoveredNodeType {
  nativeLabel: string          // "Article", "Person", ":Paper" etc.
  propertyKeys: string[]       // what fields exist on these nodes
  estimatedCount: number
  hasEmbeddings: boolean       // does this type have a vector property?
  embeddingProperty?: string   // which property holds the embedding?
}
```

**Mode 3 — Read-only integration (power users)**
User connects their existing database in read-only mode. Restormel can
query and retrieve but cannot write. The ingestion pipeline is disabled.
The graph review and agent query features work against the existing data.
Useful for teams who manage their graph through other tooling and want
Restormel purely for retrieval and verification.

---

## Ingestion pipeline integration points

The ingestion pipeline has three stages that touch the graph store:

**Stage 5 — VALIDATE:**
Currently reads nodes from SurrealDB to check verification state.
After abstraction: calls `adapter.getNodesByIds()` and `adapter.getEdgesBetween()`.
No query language exposed. Works identically across all adapters.

**Stage 6 — STORE:**
Currently writes to SurrealDB using SurrealQL RELATE statements.
After abstraction: calls `adapter.writeNodes()`, `adapter.writeEdges()`,
`adapter.updateVerificationState()` in a logical transaction.
Adapters that support ACID transactions (SurrealDB, Neo4j) wrap in a
transaction. Adapters that do not (Weaviate) get batch writes with retry.

**REMEDIATE (between stages 5 and 6):**
Reads weak nodes, patches them, writes back.
After abstraction: `adapter.getNodesByIds()` → process → `adapter.upsertNodes()`.

No other pipeline stage touches the graph store directly. All graph I/O
is contained in these three points, making the adapter interface sufficient.

---

## Retrieval orchestrator integration points

The orchestrator currently calls SurrealDB directly for five operations.
After abstraction, each becomes an adapter call:

| Current SurrealDB operation | Adapter method |
|-----------------------------|----------------|
| Vector KNN (HNSW query) | `searchByVector()` |
| BM25 text search | `searchByText()` |
| Seed expansion (graph traversal) | `expandFromSeeds()` |
| Path finding between nodes | `traversePaths()` |
| Neighbour lookup | `getNeighbours()` |

The beam search algorithm itself moves entirely into the orchestrator.
For adapters with `nativeGraphTraversal: true` (SurrealDB, Neo4j), the adapter
executes the traversal at the database layer in one round trip. For adapters
with `nativeGraphTraversal: false` (Weaviate), the adapter executes
`expandFromSeeds` iteratively: seed → get neighbours → filter → next hop.
This is less efficient but still correct.

The verification filter (`claimVerificationSqlFilter` equivalent) becomes
a `NodeFilter` parameter passed to every read operation:

```typescript
interface NodeFilter {
  verificationStates?: VerificationState[]  // ['supported', 'weak']
  minTrustScore?: number
  excludeFlagged?: boolean
  domainPack?: string
  sourceDocumentIds?: string[]
}
```

Each adapter translates `NodeFilter` into its native query predicate.
Neo4j: `WHERE n.verification_state IN $states AND n.trust_score >= $min`
Weaviate: `where: { operator: In, path: ["verificationState"], valueText: [...] }`
SurrealDB: existing `claimVerificationSqlFilter` logic

---

## Connection configuration in Connect dashboard

### New connection flow (extends existing pipeline wizard)

Step 1 of the pipeline wizard (currently "Choose where your graph lives") becomes
a database selector before the connection string input:

```
GRAPH STORE

Which database do you want to use?

[ ⬡ SurrealDB  ]  [ ◉ Neo4j    ]  [ ⊕ Weaviate  ]
  Recommended      Enterprise       RAG teams

[ ◎ Neptune    ]  [ ▲ ArangoDB  ]
  AWS users        Multi-model

Connect to an existing database or we'll help you set up a new one.
```

After selecting the database type, the connection form adapts:
- SurrealDB: WebSocket URL + namespace + database (current)
- Neo4j: Bolt/Neo4j URI + username + password + database name
- Weaviate: REST endpoint + API key + collection prefix
- Neptune: Endpoint URL + IAM credentials + region

Test connection button fires `adapter.healthCheck()` before allowing Continue.

### Schema mode selector (shown when connection test passes)

For existing databases with data:

```
We found [N] node types and [M] relationship types in your database.

○ Start fresh — Restormel creates its schema alongside your data
● Use existing schema — Map your data to a Restormel domain pack
○ Read only — Query your graph without writing to it
```

For empty databases, only "Start fresh" is shown.

### Schema mapping UI (when "Use existing schema" is selected)

Show the `DiscoveredSchema` result as a mapping table:

```
Your database                  Restormel domain pack
────────────────────────────────────────────────────
:Article (12,847 nodes)    →   [ Claim type ▼     ]
:Person  (4,210 nodes)     →   [ Entity type ▼    ]
:CITES   (89,432 edges)    →   [ Relation type ▼  ]
:WRITTEN_BY (4,210 edges)  →   [ Skip ▼           ]

embedding_vector           →   Use as embeddings [ ✓ ]
trust_score               →   Map to trust score [ ✓ ]
```

The domain pack dropdowns are populated from existing packs in the workspace,
or the user can generate a new pack from the discovered schema using the
"Design with AI" flow from the Domain step.

---

## Package structure

```
packages/
  graphrag-core/
    src/
      adapters/
        GraphStoreAdapter.ts      — interface + types (above)
        AdapterFactory.ts         — instantiate correct adapter from config
        capabilities.ts           — capability constant declarations
        surrealdb/
          SurrealDBAdapter.ts     — existing code extracted here
          SurrealDBAdapter.test.ts
        neo4j/
          Neo4jAdapter.ts
          Neo4jAdapter.test.ts
          neo4j-schema.ts         — Cypher DDL for Restormel schema
        weaviate/
          WeaviateAdapter.ts
          WeaviateAdapter.test.ts
          weaviate-schema.ts      — Weaviate class definitions
        neptune/                  — placeholder, sprint 2
        arangodb/                 — placeholder, sprint 2
```

`AdapterFactory` resolves the correct adapter from workspace config:

```typescript
export function createGraphStoreAdapter(
  config: GraphStoreConnectionConfig
): GraphStoreAdapter {
  switch (config.type) {
    case 'surrealdb': return new SurrealDBAdapter(config)
    case 'neo4j':     return new Neo4jAdapter(config)
    case 'weaviate':  return new WeaviateAdapter(config)
    default: throw new Error(`Unsupported graph store: ${config.type}`)
  }
}
```

The workspace record in Postgres gains a `graph_store_config` JSON column:

```typescript
interface GraphStoreConnectionConfig {
  type: GraphStoreAdapterType
  connectionString?: string      // SurrealDB, Neo4j bolt URI
  endpoint?: string              // Weaviate, Neptune
  credentials: GraphStoreCredentials  // encrypted at rest
  database?: string
  namespace?: string             // SurrealDB
  collectionPrefix?: string      // Weaviate namespace prefix
  schemaMode: 'fresh' | 'existing' | 'readonly'
  mappings?: SchemaMappings      // only when schemaMode = 'existing'
}
```

---

## Build sequence

**Sprint 1 — Adapter pattern + Neo4j**

1. Extract SurrealDB adapter from current inline code into `SurrealDBAdapter.ts`.
   This is a refactor with no behaviour change — just wrapping existing code
   in the interface. All tests must pass identically after.

2. Update ingestion pipeline to call adapter methods instead of direct SurrealDB.

3. Update retrieval orchestrator to call adapter methods.

4. Build `Neo4jAdapter.ts` implementing the full interface using `neo4j-driver`.
   Key technical challenges:
   - Cypher DDL for Restormel schema creation (`ensureSchema`)
   - Vector index creation (Neo4j 5.x syntax: `CREATE VECTOR INDEX`)
   - Beam search expansion in Cypher (MATCH path with variable hops)
   - Hybrid search: separate vector query + text query → merge at application layer

5. Integration tests: run the full ingest pipeline against a test Neo4j Aura
   instance. Run retrieval orchestrator against the same instance.

6. Connect dashboard: add database type selector to pipeline wizard Step 1.
   Add Neo4j connection form.

**Sprint 2 — Weaviate + schema mapping**

1. Build `WeaviateAdapter.ts`.
   Key challenge: application-layer graph traversal for adapters where
   `nativeGraphTraversal: false`. Implement in the adapter using `getNeighbours()`
   iteratively with depth limiting.

2. Build the schema discovery and mapping UI in the Connect dashboard.
   `discoverSchema()` on the SurrealDB and Neo4j adapters first.

3. Integration tests for Weaviate.

**Sprint 3 — Neptune + ArangoDB + schema mapping for Weaviate**

1. Neptune adapter.
2. ArangoDB adapter.
3. Schema discovery for Weaviate.

---

## Key risks and mitigations

**Risk 1 — Beam search efficiency on non-native traversal adapters**
Weaviate requires application-layer traversal. For large graphs, this
means many round trips (one per hop depth). Mitigation: enforce
`maxTraversalDepth: 2` for Weaviate, document this clearly, and add a
query cost warning in the Connect UI when Weaviate is selected with
depth > 2.

**Risk 2 — Embedding storage across adapters**
Each adapter stores embeddings differently. SurrealDB uses a vector
field type. Neo4j uses a property with a vector index. Weaviate has
built-in vector storage. The adapter interface hides this, but the
ingestion pipeline must pass raw embedding arrays (not database-specific
vector types) to `writeNodes()`. Confirm this is the case in the
SurrealDB adapter extraction before building others.

**Risk 3 — Schema migration for existing SurrealDB users**
The SurrealDB adapter extraction must not change existing workspace
behaviour. Existing `graph_store_config` records that predate this work
should be auto-migrated to `{ type: 'surrealdb', schemaMode: 'fresh', ... }`
with no user action required.

**Risk 4 — Credential security**
Each adapter type has different credential shapes (connection string,
username+password, API key, IAM credentials). All credentials must be
encrypted at rest using the existing credential encryption pattern in the
codebase. The `GraphStoreCredentials` type must be opaque to application
code — adapters decrypt credentials only at the moment of connection.

---

## What this unlocks

Once the adapter layer exists:

- Any future graph database can be added by implementing the
  `GraphStoreAdapter` interface without touching the ingestion pipeline
  or retrieval orchestrator.

- The comparison panel (the graph vs no-graph test feature) becomes
  database-agnostic automatically — it calls the same retrieval orchestrator
  regardless of which adapter is in use.

- Enterprise users with existing Neo4j graphs can connect Restormel on top
  of their current data in read-only mode, get verification and retrieval
  immediately, and migrate incrementally.

- The AAIF integration (when it is promoted to the API layer) works across
  all adapter types because it communicates through the retrieval orchestrator,
  not directly with any database.
