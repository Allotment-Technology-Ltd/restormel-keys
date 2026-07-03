/**
 * OpenRouter provider adapter. Uses fetch(); no SDK.
 */
import type {
  ProviderClient,
  ProviderDefinition,
  ProviderCostEstimate,
  ProviderValidationResult,
} from "./types.js";

const BASE_URL = "https://openrouter.ai/api/v1";

// OpenRouter is an aggregator; model ids are "provider/model". Curated list for click-and-select.
export const OPENROUTER_MODELS: string[] = [
  "openai/gpt-4o",
  "openai/gpt-4o-mini",
  "openai/gpt-3.5-turbo",
  "anthropic/claude-sonnet-4",
  "anthropic/claude-3-haiku",
  "anthropic/claude-3-opus",
  "google/gemini-3.1-pro-preview",
  "google/gemini-3-flash-preview",
  "google/gemini-2.5-pro",
  "google/gemini-2.5-flash",
  "meta-llama/llama-3.3-70b-instruct",
  "meta-llama/llama-3.1-8b-instruct",
  "mistralai/mistral-large",
  "mistralai/mixtral-8x7b-instruct",
  "deepseek/deepseek-chat",
  "deepseek/deepseek-coder",
  "x-ai/grok-3-fast",
  "cohere/command-r-plus",
  "perplexity/sonar",
  "qwen/qwen-2.5-72b-instruct",
];

async function validateKey(
  apiKey: string,
  fetchFn: typeof fetch = fetch
): Promise<ProviderValidationResult> {
  try {
    const res = await fetchFn(`${BASE_URL}/models`, {
      method: "GET",
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) {
      const text = await res.text();
      return { valid: false, errors: [`${res.status}: ${text.slice(0, 200)}`] };
    }
    return { valid: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { valid: false, errors: [msg] };
  }
}

function estimateCost(_modelId: string): ProviderCostEstimate | null {
  // Pricing is available in OpenRouter model metadata, but we don't fetch here.
  return null;
}

function createClient(_apiKey: string): ProviderClient {
  return { provider: "openrouter", baseUrl: BASE_URL };
}

export const openrouterProvider: ProviderDefinition = {
  id: "openrouter",
  name: "OpenRouter",
  models: OPENROUTER_MODELS,
  validateKey,
  estimateCost,
  createClient,
};

