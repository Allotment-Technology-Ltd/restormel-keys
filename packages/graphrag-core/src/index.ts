export type {
  GraphStore,
  EmbeddingPort,
  GraphRagDeps,
  OriginBucketResolver,
  RetrievalOriginBalanceKey,
} from "./ports.js";

export {
  detectCorpusLevelQuery,
  extractLexicalTerms,
  fuseHybridCandidates,
  type HybridCandidate,
  type HybridFusionResult,
} from "./hybrid-candidate-generation.js";

export {
  constructSeedSet,
  DEFAULT_SEED_ROLES,
  type SeedCandidate,
  type SeedBalanceStats,
  type SeedRole,
  type SeedRoleConfig,
  type SeedSetConstructionResult,
} from "./seed-set-constructor.js";

export {
  philosophyRetrievalConfig,
  formatThinkerContextBlock,
  type RetrievalConfig,
  type ClaimTaxonomyConfig,
  type RelationsConfig,
  type RelationTraversalEdge,
  type ReasoningClass,
  type RelationFetchEdge,
  type ArgumentsConfig,
  type TraversalConfig,
  type ClosureConfig,
  type DomainConfig,
  type OriginBalanceConfig,
  type LexicalConfig,
  type VerificationConfig,
  type SchemaConfig,
  type EntityEnrichmentConfig,
  type PresentationConfig,
  type VerificationCategory,
  type ThinkerContext,
  type ThinkerSummary,
} from "./config.js";

export {
  IDEAL_RETRIEVAL_ORIGIN_FRACTIONS,
  RETRIEVAL_ORIGIN_BALANCE_STRENGTH,
  RETRIEVAL_DOMAIN_BALANCE_STRENGTH,
  isRetrievalKgBalanceEnabled,
  computeKgBalanceMultiplier,
} from "./kg-balance.js";

export {
  isRetrievalBm25Enabled,
  isRetrievalNativeGraphEnabled,
  isRetrievalPassageGroundedEnabled,
  isRetrievalTaxonomyRoutingEnabled,
  isKgEnforcePassageOnAcceptEnabled,
  fetchBm25ClaimCandidates,
  fetchNativeGraphNeighbors,
  fetchPassageGroundedClaimIds,
  fetchTaxonomySeedClaimIds,
  ensureClaimSearchIndex,
  ensurePassageEmbeddingIndex,
  ensureClaimAcceptPassageEvent,
  DEFAULT_PASSAGE_EMBEDDING_DIMENSIONS,
} from "./surreal-retrieval-enhancements.js";

export {
  retrieveContext,
  retrieveContextFromSeed,
  buildContextBlock,
  type RetrievedClaim,
  type RetrievedRelation,
  type RetrievedArgument,
  type RejectedClaimReasonCode,
  type RejectedRelationReasonCode,
  type RejectedClaimCandidate,
  type RejectedRelationCandidate,
  type ClosureUnitTrace,
  type RetrievalClosureStats,
  type RetrievalSeedTrace,
  type RetrievalQueryDecompositionTrace,
  type RetrievalPruningSummaryTrace,
  type RetrievalVerificationSummary,
  type VerificationPolicy,
  type RetrievalResult,
  type RetrievalOptions,
} from "./retrieve-context.js";

export { emptyGraphData, type GraphData } from "./empty-graph.js";

// ── Multi-database GraphStoreAdapter foundation (Build 1C) ──
export {
  type GraphStoreAdapter,
  type GraphStoreAdapterType,
  type GraphStoreCapabilities,
  type GraphStoreCredentials,
  type GraphStoreConnectionConfig,
  type GraphStoreHealthResult,
  type SchemaMappings,
  type GraphNode,
  type GraphEdge,
  type ScoredNode,
  type GraphSubgraph,
  type GraphPath,
  type GraphPathStep,
  type NodeFilter,
  type ExpansionOptions,
  type DomainPackSchema,
  type DiscoveredSchema,
  type DiscoveredNodeType,
  type DiscoveredEdgeType,
  type WorkspaceGraphStats,
  type VerificationBreakdown,
  type VerificationState,
} from "./adapters/GraphStoreAdapter.js";

export {
  SURREALDB_CAPABILITIES,
  NEO4J_CAPABILITIES,
  WEAVIATE_CAPABILITIES,
} from "./adapters/capabilities.js";

export {
  SurrealDBAdapter,
  type SurrealDBAdapterDeps,
} from "./adapters/surrealdb/SurrealDBAdapter.js";

export {
  Neo4jAdapter,
  reciprocalRankFusion,
  type Neo4jAdapterDeps,
  type Neo4jDriverLike,
  type Neo4jSessionLike,
  type Neo4jQueryResultLike,
  type Neo4jRecordLike,
} from "./adapters/neo4j/Neo4jAdapter.js";

export {
  buildNeo4jSchemaStatements,
  escapeCypherIdentifier,
  CLAIM_LABEL,
  NEO4J_INDEX_NAMES,
  DEFAULT_EMBEDDING_DIMENSIONS,
  type Neo4jSchemaOptions,
} from "./adapters/neo4j/neo4j-schema.js";

export {
  WeaviateAdapter,
  WEAVIATE_NODE_PROPERTY_KEYS,
  type WeaviateAdapterDeps,
  type WeaviateClientLike,
  type WeaviateObjectLike,
  type WeaviateScored,
  type WeaviateFilter,
  type WeaviateCollectionInfo,
} from "./adapters/weaviate/WeaviateAdapter.js";

export {
  createGraphStoreAdapter,
  resolveGraphStoreAdapterType,
  normalizeGraphStoreConfig,
  GraphStoreAdapterNotImplementedError,
  DEFAULT_GRAPH_STORE_CONFIG,
  type AdapterFactoryDeps,
} from "./adapters/AdapterFactory.js";

export {
  RetrievalOrchestrator,
  type ReasoningMode,
  type Tokenizer,
  type OrchestratorTrace,
  type CuratedSubgraph,
  type OrchestratorResult,
  type RetrievalPath,
  type RetrievalPathStep,
  type FindPathsResult,
  type RetrieveContextParams,
  type ExpandContextParams,
  type FindRelevantSubgraphParams,
  type FindPathsParams,
  packContext,
  defaultTokenizer,
  estimateClaimTokens,
  type PackContextInput,
  type PackContextResult,
  summariseSubgraph,
  type SummariseSubgraphInput,
  type SummariseSubgraphResult,
  type SynthesizedNode,
  type CondensedNode,
} from "./orchestrator/index.js";

export {
  RESTORMEL_CORE_RULE_SET,
  RESTORMEL_CORE_RULE_SET_ID,
  BUILT_IN_RULE_SETS,
  getBuiltInRuleSet,
  dimensionWeightSum,
  resolveVerificationRuleSet,
  classifyByPolicy,
  selectPolicy,
  type ClaimVerificationClass,
} from "./verification/rules/index.js";
