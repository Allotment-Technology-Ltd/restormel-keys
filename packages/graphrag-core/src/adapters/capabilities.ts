/**
 * Capability declarations per adapter. The retrieval orchestrator reads these
 * before planning a query strategy (e.g. application-layer expansion when
 * nativeGraphTraversal is false; separate vector+text queries when hybridSearch
 * is false). See docs/requirements/graph_store_adapter_architecture.md.
 */
import type { GraphStoreCapabilities } from "./GraphStoreAdapter.js";

export const SURREALDB_CAPABILITIES: GraphStoreCapabilities = {
  nativeVectorSearch: true, // HNSW/MTREE vector indexes
  nativeGraphTraversal: true, // RELATE, graph traversal operators
  hybridSearch: false, // vector + BM25 requires separate queries
  transactionalWrites: true,
  streamingResults: false, // polling-based for large results
  maxTraversalDepth: null,
};

export const NEO4J_CAPABILITIES: GraphStoreCapabilities = {
  nativeVectorSearch: true, // Neo4j 5.x vector indexes
  nativeGraphTraversal: true, // Cypher MATCH path expressions
  hybridSearch: false, // vector + keyword requires separate queries + merge
  transactionalWrites: true,
  streamingResults: true,
  maxTraversalDepth: null,
};

export const WEAVIATE_CAPABILITIES: GraphStoreCapabilities = {
  nativeVectorSearch: true, // best-in-class
  nativeGraphTraversal: false, // cross-references only; traversal at app layer
  hybridSearch: true, // native BM25 + vector hybrid
  transactionalWrites: false, // eventual consistency model
  streamingResults: true,
  maxTraversalDepth: 2, // application-layer limit to avoid N+1 blowout
};
