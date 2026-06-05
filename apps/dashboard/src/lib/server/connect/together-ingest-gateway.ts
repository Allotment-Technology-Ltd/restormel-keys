/**
 * Together AI as a multi-vendor gateway for Connect ingestion.
 * One Together key can reach Anthropic, OpenAI, Google, Meta, Qwen, DeepSeek, xAI, etc.
 * via Together's OpenAI-compatible API (`provider/model` upstream strings).
 *
 * Canonical catalog ids stay stable; `provider_model_variants` + this map supply upstream ids.
 */
import type { IngestModelRecommendation } from "$lib/server/connect/model-guidance";

export const TOGETHER_GATEWAY_PROVIDER = "together" as const;

/**
 * Canonical catalog model id → Together `/v1/chat/completions` model string.
 * Curated from Together serverless + external model catalog (2026-06).
 */
export const TOGETHER_GATEWAY_CHAT_MODELS: Record<string, string> = {
  "claude-sonnet-4-6": "anthropic/claude-sonnet-4-6",
  "claude-sonnet-4-5": "anthropic/claude-sonnet-4-5",
  "claude-haiku-4-5": "anthropic/claude-haiku-4-5",
  "claude-opus-4-6": "anthropic/claude-opus-4-6",
  "gpt-5.2": "openai/gpt-5.4",
  "gpt-5.1": "openai/gpt-5.4",
  "gpt-4o": "openai/gpt-4o",
  "gpt-4o-mini": "openai/gpt-4o-mini",
  "gemini-3.1-pro": "google/gemini-3.1-pro-preview",
  "gemini-2.5-pro": "google/gemini-2.5-pro",
  "gemini-2.5-flash": "google/gemini-2.5-flash",
  "together-qwen3-5-397b": "Qwen/Qwen3.5-397B-A17B",
  "together-qwen3-5-9b": "Qwen/Qwen3.5-9B",
  "together-kimi-k2-5": "moonshotai/Kimi-K2.5",
  "together-deepseek-v3-1": "deepseek-ai/DeepSeek-V3.1",
  "together-deepseek-v3": "deepseek-ai/DeepSeek-V3",
  "together-llama-3-3-70b-instruct-turbo": "meta-llama/Llama-3.3-70B-Instruct-Turbo",
  "together-gpt-oss-120b": "openai/gpt-oss-120b",
  "together-gpt-oss-20b": "openai/gpt-oss-20b",
  "together-glm-5-1": "zai-org/GLM-5.1",
};

/** Together serverless embedding model — 1024d, matches default domain pack. */
export const TOGETHER_GATEWAY_EMBEDDING_MODEL_ID = "together-multilingual-e5-large";
export const TOGETHER_GATEWAY_EMBEDDING_UPSTREAM = "intfloat/multilingual-e5-large-instruct";

export function hasTogetherGatewayForModel(catalogModelId: string): boolean {
  return Boolean(TOGETHER_GATEWAY_CHAT_MODELS[catalogModelId.trim()]);
}

export function togetherUpstreamModelId(catalogModelId: string): string | null {
  return TOGETHER_GATEWAY_CHAT_MODELS[catalogModelId.trim()] ?? null;
}

/** True when workspace can run this recommendation via a direct provider key or Together gateway. */
export function isIngestProviderSatisfied(
  rec: Pick<IngestModelRecommendation, "modelId" | "provider">,
  providerTypes: Set<string>,
): boolean {
  if (providerTypes.size === 0) return true;
  if (providerTypes.has(rec.provider)) return true;
  return (
    providerTypes.has(TOGETHER_GATEWAY_PROVIDER) && hasTogetherGatewayForModel(rec.modelId)
  );
}

/**
 * When only Together is connected, route the recommendation through Together
 * while keeping the canonical catalog model id for routes and policy.
 */
export function remapRecommendationViaTogether(
  rec: IngestModelRecommendation,
  providerTypes: Set<string>,
): IngestModelRecommendation | null {
  if (providerTypes.has(rec.provider)) return rec;
  if (!providerTypes.has(TOGETHER_GATEWAY_PROVIDER)) return null;
  if (!hasTogetherGatewayForModel(rec.modelId)) return null;
  return {
    ...rec,
    provider: TOGETHER_GATEWAY_PROVIDER,
    rationale: `${rec.rationale} (via Together AI — ${togetherUpstreamModelId(rec.modelId)})`,
  };
}

export function resolveIngestRecommendationProvider(
  rec: IngestModelRecommendation,
  providerTypes: Set<string>,
): IngestModelRecommendation | null {
  if (providerTypes.size === 0) return rec;
  if (providerTypes.has(rec.provider)) return rec;
  return remapRecommendationViaTogether(rec, providerTypes);
}
