/**
 * Cascade-validation harness barrel (REC-ADR-023 build step 1B + step 2).
 * The mode-independent verifier cascade, the hash-keyed exact-match verdict cache, the
 * unit-economics instrumentation, and the dual-input harness. No DB/network/keys —
 * connect-core stays MIT; live adapters (credentialed frontier route, real MCP server) are
 * host-app wiring injected at the seams here.
 */
export {
  type Verdict,
  VERDICTS,
  isVerdict,
  verdictFromEntailment,
  isDecisiveVerdict,
  CascadeError,
  VerifierTimeoutError,
  VerifierParseError,
  BudgetExhaustedError,
  ModelIndependenceError,
  BlockedComponentError,
} from "./verdict.js";

export {
  type VerifierRequest,
  type VerifierResult,
  type VerifierTier,
  type CascadeTierRole,
  type CascadeTierSlot,
} from "./verifier-port.js";

export {
  type VerdictCacheKeyInputs,
  type CachedVerdict,
  type VerdictCacheStore,
  type CacheLookup,
  canonicalSerialize,
  verdictCacheKey,
  InMemoryVerdictCache,
} from "./verdict-cache.js";

export {
  type TierThresholds,
  type CalibrationArtifact,
  type Stage1InformativenessFinding,
  getTierThresholds,
  computeAuroc,
  assessStage1Informativeness,
  STAGE1_INFORMATIVE_MIN_AUROC,
  DEV_FIXTURE_CALIBRATION,
} from "./calibration.js";

export {
  type CascadeMode,
  type GenAiCallSpan,
  type ClaimDecisionRecord,
  type Estimate,
  type EconomicsReport,
  EconomicsRecorder,
  meanEstimate,
  proportionEstimate,
  clusteredProportionEstimate,
} from "./economics.js";

export {
  type CascadeClaimInput,
  type CascadeConfig,
  type CascadeRunOptions,
  VerifierCascade,
} from "./cascade.js";

export {
  type DefaultCascadeOptions,
  type DefaultCascadeBuild,
  buildDefaultCascade,
} from "./default-cascade.js";

export {
  type RunKind,
  type CorpusClaim,
  type CorpusFixture,
  type BarReport,
  type McpResponseClaim,
  type McpScenarioReport,
  BAR_SUPPORTED_MIN_PCT,
  BAR_UNSUPPORTED_MAX_PCT,
  runFirstPartyCorpus,
  runWrappedMcpScenario,
} from "./harness.js";

// Tier factories (fixture-backed doubles; live adapters are host-app wiring).
export {
  createHhemPrefilterDouble,
  lexicalOverlap,
  polarityMismatch,
  HHEM_PREFILTER_PROMPT_VERSION,
  type HhemPrefilterOptions,
} from "./tiers/hhem-prefilter.js";
export { createGraniteMidDouble, GRANITE_MID_PROMPT_VERSION } from "./tiers/granite-mid.js";
export {
  type FrontierGenerate,
  type FrontierTierOptions,
  createFrontierEscalationTier,
  frontierFixtureGenerate,
  parseFrontierResponse,
  buildFrontierJudgeSystemPrompt,
  buildFrontierJudgeUserPrompt,
  FRONTIER_JUDGE_PROMPT_VERSION,
} from "./tiers/frontier-escalation.js";
export { createExcludedCheapSlotStub } from "./tiers/excluded-cheap-slot-stub.js";

// Fixtures.
export {
  LEGAL_FIXTURE,
  PHARMA_FIXTURE,
  FINANCE_FIXTURE,
  ALL_CORPUS_FIXTURES,
} from "./fixtures/corpus-samples.js";
export { REDIS_IRIS_STUB_CLAIMS } from "./fixtures/mcp-scenario.js";
