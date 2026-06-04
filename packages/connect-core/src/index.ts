export type {
  IngestPlanningDeps,
  IngestModelCallDeps,
  IngestionStage,
  StageKey,
  ReasoningModelRoute,
  GenerateTextParams,
  GenerateTextResult,
  StageBudget,
  StageUsageTracker,
  CostTracker,
  IngestTimingPayload,
  IngestProviderPreference,
  IngestionPlanningContext,
  IngestionStagePlan,
  PipelinePhaseStage,
  IngestionStageUsageEstimate,
} from "./ports.js";

export {
  INGEST_PIPELINE_STAGES_ORDER,
  completedStageOrderRank,
  laterCompletedStage,
  validationOnlyEmbeddingCheckpointMet,
  ingestionLogStatusReflectingCheckpoint,
} from "./ingest/resume-stage.js";

export {
  INGEST_EMBED_USD_PER_MILLION_CHARS,
  INGEST_LLM_USD_RATE_TABLE_ID,
  estimateIngestLlmUsageUsd,
  getIngestLlmUsdPerMillion,
  ingestLlmCombinedUsdPer1MReference,
  normalizeIngestBillingModelId,
} from "./ingest/llm-token-usd-rates.js";

export { shouldOmitGenerateTextTemperature } from "./ingest/generate-text-temperature.js";

export {
  estimateStageUsage,
  buildIngestionStageUsageEstimates,
  planIngestionStage,
  planIngestionStageWithExplicitModel,
} from "./ingest/plan.js";

export {
  sleep,
  withTimeout,
  estimateTokens,
  parseJsonResponse,
  estimateUsageCostUsd,
  trackReasoningCost,
  trackEmbeddingCost,
  formatModelCallErrorDetails,
  isModelUnavailableError,
  startStageUsage,
  assertStageBudget,
  logStageCost,
  callStageModel,
  fixJsonWithModel,
} from "./stages/model-call.js";

export {
  CONNECT_INGEST_PIPELINE_STAGES,
  buildInitialConnectIngestJob,
} from "./ingest/job-record.js";

export {
  validateConnectIngestSources,
  advanceConnectIngestStagesBookkeeping,
  normalizeConnectIngestStages,
  type ConnectIngestStageProgress,
  type ConnectIngestStageProgressMetrics,
  type ConnectIngestSourceInput,
} from "./ingest/worker-stub.js";

export {
  applyConnectPipelineFocus,
  buildConnectPipelineStageRows,
  connectIngestProgressFromLogLine,
  connectStageAliasToKey,
  connectStageFromBracketTag,
  CONNECT_PIPELINE_STAGE_LABELS,
  type ConnectPipelineStageRow,
} from "./ingest/pipeline-focus.js";

export {
  relationConfidenceFromStrength,
  attachRelationMetadata,
  buildRelationsBatches,
  relationDedupeKey,
  mergeRelationsDedup,
  assertRelationIntegrity,
  type IngestRelationsClaim,
  type IngestRelationsRelation,
  type IngestRelationReviewState,
} from "./stages/relations-helpers.js";

export type {
  SourceConnector,
  SourceDocRef,
  FetchedDocument,
  DocumentParser,
  ParsedDocument,
  ParsedElement,
  DocChunk,
  EmbeddingPort,
} from "./ingest/ingest-ports.js";

export { chunkDocument } from "./ingest/chunking.js";

export {
  BuiltinDocumentParser,
  BuiltinParseUnsupportedError,
  builtinDocumentParser,
} from "./ingest/builtin-parser.js";

export {
  buildExtractionSystemPrompt,
  buildExtractionUserPrompt,
  EXTRACTION_OUTPUT_CONTRACT,
} from "./ingest/extraction-prompt.js";

export {
  extractGraph,
  parseExtractionResponse,
  analyzeExtraction,
  type ExtractedUnit,
  type ExtractedRelation,
  type ExtractionWarning,
  type ExtractionResult,
  type ExtractionGenerate,
} from "./ingest/extract.js";

export { extractLinks, parseSitemapUrls, sitemapUrlFor } from "./ingest/crawl.js";

export {
  buildGroupingSystemPrompt,
  buildGroupingUserPrompt,
  parseGroupingResponse,
  groupUnits,
  type GroupingUnitInput,
  type GroupedMember,
  type ExtractedGroup,
} from "./ingest/grouping.js";

export {
  buildValidationSystemPrompt,
  buildValidationUserPrompt,
  parseValidationResponse,
  validateUnits,
  type ValidationInput,
  type UnitValidation,
  type UnitValidationStatus,
} from "./ingest/validation.js";

export {
  buildRemediationSystemPrompt,
  buildRemediationUserPrompt,
  parseRemediationResponse,
  remediateUnits,
  type RemediationInput,
  type RemediationResult,
  type RemediationAction,
} from "./ingest/remediation.js";

export { CONNECT_STAGE_ORDER, shouldRunStage } from "./ingest/stage-gate.js";
