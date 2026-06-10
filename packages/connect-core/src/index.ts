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

export { createLlamaParseParser, LlamaParseDocumentParser } from "./ingest/llamaparse-parser.js";
export { createUnstructuredParser, UnstructuredDocumentParser } from "./ingest/unstructured-parser.js";

export {
  buildExtractionSystemPrompt,
  buildExtractionUserPrompt,
  EXTRACTION_OUTPUT_CONTRACT,
} from "./ingest/extraction-prompt.js";

export {
  composeStageSystemPrompt,
  buildRelationsSystemPrompt,
  substitutePromptPlaceholders,
  resolvePackArchetype,
  resolvePromptTemplateVersion,
  type GraphIngestContext,
  type IngestPromptContext,
  type PackArchetype,
  type IngestPromptStage,
} from "./ingest/prompt-compose.js";

export {
  inferArchetypeFromSlug,
  getArchetypeStageIntro,
  PROMPT_TEMPLATE_VERSION,
} from "./ingest/prompt-templates/index.js";

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

export {
  evaluateExtractionGate,
  EXTRACTION_GATE_THRESHOLDS,
  type ExtractionGateDecision,
  type ExtractionGateThresholds,
} from "./ingest/extraction-gates.js";

export {
  askBatchWithCoverageRetry,
  omittedBatchRefs,
  type BatchCoverageOutcome,
  type BatchCoverageShortfall,
  type CoverageShortfallHandler,
  type ParsedBatchResponse,
} from "./ingest/batch-coverage.js";

export {
  contentHash,
  bindEvidenceSpan,
  verifyEvidenceSpan,
  bindUnitsEvidence,
  type EvidenceSpan,
  type EvidenceBinding,
  type EvidenceMatchKind,
  type SpanVerification,
  type UnitEvidenceBinding,
} from "./ingest/evidence-binding.js";

export {
  deriveLayer1State,
  deriveLayer2State,
  entailmentToLegacyStatus,
  type ClaimVerificationState,
  type Layer1StateInput,
  type Layer2StateInput,
} from "./ingest/verification-state.js";

export {
  ENTAILMENT_PROMPT_VERSION,
  ENTAILMENT_LOW_CONFIDENCE,
  ENTAILMENT_BATCH_SIZE,
  buildEntailmentSystemPrompt,
  buildEntailmentUserPrompt,
  buildEntailmentBatchInputs,
  remapEntailmentBatchResults,
  finalizeEntailmentCoverage,
  parseEntailmentResponse,
  parseEntailmentResponseDetailed,
  resolveSelfConsistency,
  judgeEntailment,
  type EntailmentVerdict,
  type EntailmentInput,
  type UnitEntailment,
  type EntailmentJudgeMeta,
} from "./ingest/entailment.js";

export { extractLinks, parseSitemapUrls, sitemapUrlFor } from "./ingest/crawl.js";

export {
  extractSourceMetadataFromHtml,
  formatSourceProvenancePreview,
  type SourceMetadata,
} from "./ingest/source-metadata.js";

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
  buildValidationBatchInputs,
  validateUnitsBatch,
  validateUnitsBatchDetailed,
  remapValidationBatchResults,
  finalizeValidationCoverage,
  parseValidationResponse,
  parseValidationResponseDetailed,
  validateUnits,
  type ValidationInput,
  type UnitValidation,
  type UnitValidationStatus,
} from "./ingest/validation.js";

export {
  buildRemediationSystemPrompt,
  buildRemediationUserPrompt,
  buildRemediationBatchInputs,
  remediateUnitsBatch,
  remediateUnitsBatchDetailed,
  remapRemediationBatchResults,
  finalizeRemediationCoverage,
  parseRemediationResponse,
  parseRemediationResponseDetailed,
  remediateUnits,
  type RemediationInput,
  type RemediationResult,
  type RemediationAction,
} from "./ingest/remediation.js";

export { CONNECT_STAGE_ORDER, shouldRunStage } from "./ingest/stage-gate.js";

export {
  CONNECT_QUALITY_PRESET_DEFAULT,
  resolveQualityPreset,
  readMaxChunksForPreset,
  readEntailmentKForPreset,
  effectiveStopAfterStage,
  starterPresetWarning,
  type ConnectQualityPreset,
  type ConnectQualityPresetConfig,
} from "./ingest/quality-preset.js";

export {
  runSourcePreScan,
  type PreScanInput,
  type PreScanResult,
  type PreScanBlocker,
} from "./ingest/pre-scan.js";

export {
  computeTrustScore,
  buildAuditSummary,
  TRUST_SCORE_FORMULA,
  type KgAuditMetrics,
  type KgAuditIssueDraft,
  type KgAuditSummary,
} from "./kg-audit/trust-score.js";

export {
  assertG2Targets,
  computeG2Metrics,
  G2_OK_PCT_TARGET,
  G2_UNSUPPORTED_PCT_MAX,
  type G2QualityMetrics,
} from "./ingest/golden-eval.js";
