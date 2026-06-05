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
