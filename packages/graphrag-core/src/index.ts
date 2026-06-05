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
  type SeedCandidate,
  type SeedBalanceStats,
  type SeedRole,
  type SeedSetConstructionResult,
} from "./seed-set-constructor.js";

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
  formatThinkerContextBlock,
  type RetrievedClaim,
  type RetrievedRelation,
  type RetrievedArgument,
  type ThinkerSummary,
  type ThinkerContext,
  type RejectedClaimReasonCode,
  type RejectedRelationReasonCode,
  type RejectedClaimCandidate,
  type RejectedRelationCandidate,
  type ClosureUnitTrace,
  type RetrievalClosureStats,
  type RetrievalSeedTrace,
  type RetrievalQueryDecompositionTrace,
  type RetrievalPruningSummaryTrace,
  type RetrievalResult,
  type RetrievalOptions,
} from "./retrieve-context.js";

export { emptyGraphData, type GraphData } from "./empty-graph.js";
