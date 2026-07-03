import type {
  ProviderClient,
  ProviderDefinition,
  ProviderCostEstimate,
  ProviderValidationResult,
} from "./types.js";

const BASE_URL = "https://api.deepseek.com";

/**
 * DeepSeek Chat API models (OpenAI-compatible).
 * @see https://api-docs.deepseek.com
 */
export const DEEPSEEK_MODELS = [
  "deepseek-chat",
  "deepseek-reasoner",
] as const;

const DEEPSEEK_PRICING: Record<string, { input: number; output: number }> = {
  "deepseek-chat": { input: 0.28, output: 0.42 },
  "deepseek-reasoner": { input: 0.28, output: 0.42 },
};

async function validateKey(
  apiKey: string,
  fetchFn: typeof fetch = fetch,
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

function estimateCost(modelId: string): ProviderCostEstimate | null {
  const p = DEEPSEEK_PRICING[modelId];
  if (!p) return null;
  return { id: modelId, inputPerMillion: p.input, outputPerMillion: p.output, unit: "USD" };
}

function createClient(_apiKey: string): ProviderClient {
  return { provider: "deepseek", baseUrl: BASE_URL };
}

export const deepseekProvider: ProviderDefinition = {
  id: "deepseek",
  name: "DeepSeek",
  models: [...DEEPSEEK_MODELS],
  validateKey,
  estimateCost,
  createClient,
};
