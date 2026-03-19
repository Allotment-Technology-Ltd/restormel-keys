import type {
  ProviderClient,
  ProviderDefinition,
  ProviderCostEstimate,
  ProviderValidationResult,
} from "./types.js";

const BASE_URL = "https://api.fireworks.ai/inference";

export const FIREWORKS_MODELS = [
  "accounts/fireworks/models/llama-v3p3-70b-instruct",
  "accounts/fireworks/models/llama-v3p1-8b-instruct",
  "accounts/fireworks/models/mixtral-8x7b-instruct",
  "accounts/fireworks/models/qwen2p5-72b-instruct",
  "accounts/fireworks/models/qwen2-5-72b-instruct",
  "accounts/fireworks/models/deepseek-r1-distill-qwen-1.5b",
  "accounts/fireworks/models/code-llama-v2-34b-instruct",
  "accounts/fireworks/models/falcon-2-11b-instruct",
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
  return { provider: "fireworks", baseUrl: BASE_URL };
}

export const fireworksProvider: ProviderDefinition = {
  id: "fireworks",
  name: "Fireworks AI",
  models: [...FIREWORKS_MODELS],
  validateKey,
  estimateCost,
  createClient,
};
