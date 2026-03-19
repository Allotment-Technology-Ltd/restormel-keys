import type {
  ProviderClient,
  ProviderDefinition,
  ProviderCostEstimate,
  ProviderValidationResult,
} from "./types.js";

const BASE_URL = "https://api.together.xyz";

export const TOGETHER_MODELS = [
  "meta-llama/Llama-3.3-70B-Instruct-Turbo",
  "meta-llama/Llama-3.1-8B-Instruct-Turbo",
  "mistralai/Mixtral-8x7B-Instruct-v0.1",
  "Qwen/Qwen2.5-72B-Instruct-Turbo",
] as const;

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

function estimateCost(_modelId: string): ProviderCostEstimate | null {
  return null;
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
