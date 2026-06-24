import type { DispatchRequest } from "@restormel/dispatch";
import type { ModelProvider } from "@restormel/contracts/providers";

export type IngestionStage =
  | "extraction"
  | "relations"
  | "grouping"
  | "validation"
  | "remediation"
  | "embedding"
  | "json_repair";

export type StageKey = IngestionStage;

export type ReasoningModelRoute = {
  model: unknown;
  modelId: string;
  provider: string;
  credentialSource?: string;
  supportsGrounding?: boolean;
  routingSource?: "restormel" | "requested" | "degraded_default";
  resolvedRouteId?: string | null;
  resolvedExplanation?: string | null;
  resolvedStepId?: string | null;
  resolvedOrderIndex?: number | null;
  resolvedSwitchReasonCode?: string | null;
  resolvedMatchedCriteria?: unknown;
  resolvedFallbackCandidates?: unknown[] | null;
};

export type GenerateTextParams = {
  model: unknown;
  system?: string;
  messages: Array<{ role: "user" | "assistant" | "system"; content: string }>;
  maxOutputTokens?: number;
  temperature?: number;
};

export type GenerateTextResult = {
  text: string;
  usage?: { inputTokens?: number; outputTokens?: number };
  finishReason?: string;
};

export interface IngestPlanningDeps {
  getStoredRouteIdForStage: (stage: IngestionStage) => Promise<string | undefined>;
  getDefaultSharedRouteId: () => Promise<string | undefined>;
  getEmbeddingPlan: () => { name: string; model: string };
  buildExtractionOpenAiCompatibleRoute: () => ReasoningModelRoute | null;
  resolveExtractionModelRoute: (options: Record<string, unknown>) => Promise<ReasoningModelRoute>;
  resolveReasoningModelRoute: (options: Record<string, unknown>) => Promise<ReasoningModelRoute>;
}

export interface IngestModelCallDeps {
  generateText: (params: GenerateTextParams) => Promise<GenerateTextResult>;
}

export interface StageBudget {
  maxInputTokens?: number;
  maxOutputTokens?: number;
  maxUsd?: number;
  maxRetries: number;
  timeoutMs: number;
}

export interface StageUsageTracker {
  stage: StageKey;
  startInputTokens: number;
  startOutputTokens: number;
  startUsd: number;
  retries: number;
}

export interface CostTracker {
  totalInputTokens: number;
  totalOutputTokens: number;
  vertexChars: number;
  totalUsd: number;
}

export interface IngestTimingPayload {
  planning_initial_ms: number;
  planning_post_extraction_ms: number;
  planning_post_relations_ms: number;
  stage_ms: Record<string, number>;
  model_calls: Record<string, number>;
  model_call_wall_ms: Record<string, number>;
  model_retries: number;
  retry_backoff_ms_total: number;
  batch_splits: number;
  json_repair_invocations: number;
  embed_wall_ms: number;
  store_wall_ms: number;
}

export type IngestProviderPreference = "auto" | "vertex" | "anthropic" | "mistral";

export interface IngestionPlanningContext {
  sourceTitle: string;
  sourceType?: string;
  estimatedTokens: number;
  sourceLengthChars?: number;
  claimCount?: number;
  relationCount?: number;
  argumentCount?: number;
  claimTextChars?: number;
  preferredProvider?: IngestProviderPreference;
}

export interface IngestionStagePlan {
  stage: IngestionStage;
  request: DispatchRequest;
  routeId?: string;
  provider: string;
  model: string;
  estimatedCostUsd: number;
  routingReason: string;
  routingSource: "restormel" | "requested" | "degraded_default";
  selectedStepId?: string | null;
  selectedOrderIndex?: number | null;
  switchReasonCode?: string | null;
  matchedCriteria?: unknown;
  fallbackCandidates?: unknown[] | null;
  route?: ReasoningModelRoute;
}

export type PipelinePhaseStage = "fetch" | IngestionStage;

export interface IngestionStageUsageEstimate {
  stage: PipelinePhaseStage;
  latency: import("@restormel/dispatch").DispatchLatency;
  complexity: "low" | "medium" | "high";
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}
