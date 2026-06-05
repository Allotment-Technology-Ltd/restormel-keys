import type {
  ProviderClient,
  ProviderDefinition,
  ProviderCostEstimate,
  ProviderValidationResult,
} from "./types.js";

const BASE_URL = "https://api.together.xyz";

/**
 * Serverless chat models on Together (OpenAI-compatible `/v1/chat/completions`).
 * Curated from Together docs + commonly used legacy slugs; Together adds models frequently — validate via `/v1/models`.
 */
export const TOGETHER_MODELS = [
  // External / partner models (single Together key — OpenAI-compatible `provider/model` strings)
  "anthropic/claude-sonnet-4-6",
  "anthropic/claude-sonnet-4-5",
  "anthropic/claude-haiku-4-5",
  "anthropic/claude-opus-4-6",
  "openai/gpt-5.4",
  "openai/gpt-4o",
  "openai/gpt-4o-mini",
  "google/gemini-3.1-pro-preview",
  "google/gemini-2.5-pro",
  "google/gemini-2.5-flash",
  // Together serverless chat
  "LiquidAI/LFM2-24B-A2B",
  "MiniMaxAI/MiniMax-M2.5",
  "MiniMaxAI/MiniMax-M2.7",
  "NousResearch/Hermes-3-Llama-3.1-405B",
  "Qwen/Qwen2.5-72B-Instruct-Turbo",
  "Qwen/Qwen2.5-7B-Instruct-Turbo",
  "Qwen/Qwen3-235B-A22B-Instruct-2507-tput",
  "Qwen/Qwen3-Coder-480B-A35B-Instruct-FP8",
  "Qwen/Qwen3-Coder-Next-FP8",
  "Qwen/Qwen3.5-397B-A17B",
  "Qwen/Qwen3.5-9B",
  "deepcogito/cogito-v2-1-671b",
  "deepseek-ai/DeepSeek-R1",
  "deepseek-ai/DeepSeek-V3",
  "deepseek-ai/DeepSeek-V3.1",
  "essentialai/rnj-1-instruct",
  "google/gemma-2-27b-it",
  "google/gemma-3n-E4B-it",
  "google/gemma-4-31B-it",
  "meta-llama/Llama-3.1-405B-Instruct-Turbo",
  "meta-llama/Llama-3.1-70B-Instruct-Turbo",
  "meta-llama/Llama-3.1-8B-Instruct-Turbo",
  "meta-llama/Llama-3.2-90B-Vision-Instruct-Turbo",
  "meta-llama/Llama-3.3-70B-Instruct-Turbo",
  "meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8",
  "meta-llama/Meta-Llama-3-8B-Instruct-Lite",
  "mistralai/Mistral-7B-Instruct-v0.3",
  "mistralai/Mixtral-8x7B-Instruct-v0.1",
  "moonshotai/Kimi-K2.5",
  "openai/gpt-oss-120b",
  "openai/gpt-oss-20b",
  "zai-org/GLM-5",
  "zai-org/GLM-5.1",
] as const;

/** USD per 1M from Together serverless pricing where published; many models are dynamic — null falls back to dashboard estimates. */
const TOGETHER_PRICING: Record<string, { input: number; output: number }> = {
  "MiniMaxAI/MiniMax-M2.7": { input: 0.3, output: 1.2 },
  "MiniMaxAI/MiniMax-M2.5": { input: 0.3, output: 1.2 },
  "Qwen/Qwen3.5-397B-A17B": { input: 0.6, output: 3.6 },
  "Qwen/Qwen3.5-9B": { input: 0.1, output: 0.15 },
  "moonshotai/Kimi-K2.5": { input: 0.5, output: 2.8 },
  "zai-org/GLM-5.1": { input: 1.4, output: 4.4 },
  "zai-org/GLM-5": { input: 1.0, output: 3.2 },
  "openai/gpt-oss-120b": { input: 0.15, output: 0.6 },
  "openai/gpt-oss-20b": { input: 0.05, output: 0.2 },
  "deepseek-ai/DeepSeek-V3.1": { input: 0.6, output: 1.7 },
  "Qwen/Qwen3-Coder-Next-FP8": { input: 0.5, output: 1.2 },
  "Qwen/Qwen3-Coder-480B-A35B-Instruct-FP8": { input: 2.0, output: 2.0 },
  "Qwen/Qwen3-235B-A22B-Instruct-2507-tput": { input: 0.2, output: 0.6 },
  "deepseek-ai/DeepSeek-R1": { input: 3.0, output: 7.0 },
  "meta-llama/Llama-3.3-70B-Instruct-Turbo": { input: 0.88, output: 0.88 },
  "deepcogito/cogito-v2-1-671b": { input: 1.25, output: 1.25 },
  "essentialai/rnj-1-instruct": { input: 0.15, output: 0.15 },
  "Qwen/Qwen2.5-7B-Instruct-Turbo": { input: 0.3, output: 0.3 },
  "google/gemma-4-31B-it": { input: 0.2, output: 0.5 },
  "google/gemma-3n-E4B-it": { input: 0.06, output: 0.12 },
  "LiquidAI/LFM2-24B-A2B": { input: 0.03, output: 0.12 },
  "meta-llama/Meta-Llama-3-8B-Instruct-Lite": { input: 0.1, output: 0.1 },
};

async function validateKey(
  apiKey: string,
  fetchFn: typeof fetch = fetch,
): Promise<ProviderValidationResult> {
  try {
    const res = await fetchFn(`${BASE_URL}/v1/models`, {
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

function estimateCost(modelId: string): ProviderCostEstimate | null {
  const p = TOGETHER_PRICING[modelId];
  if (!p) return null;
  return { id: modelId, inputPerMillion: p.input, outputPerMillion: p.output, unit: "USD" };
}

function createClient(_apiKey: string): ProviderClient {
  return { provider: "together", baseUrl: BASE_URL };
}

export const togetherProvider: ProviderDefinition = {
  id: "together",
  name: "Together AI",
  models: [...TOGETHER_MODELS],
  validateKey,
  estimateCost,
  createClient,
};
