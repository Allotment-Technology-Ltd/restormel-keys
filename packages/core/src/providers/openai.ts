/**
 * OpenAI provider adapter. Uses fetch(); no OpenAI SDK.
 */
import type {
  ProviderClient,
  ProviderDefinition,
  ProviderCostEstimate,
  ProviderValidationResult,
} from "./types.js";

const BASE_URL = "https://api.openai.com";

export const OPENAI_MODELS = [
  "gpt-4o",
  "gpt-4o-mini",
  "gpt-4o-nano",
  "gpt-4o-audio-preview",
  "gpt-4.1",
  "gpt-4.1-mini",
  "gpt-4-turbo",
  "gpt-4-turbo-mini",
  "gpt-3.5-turbo",
  "o1",
  "o1-mini",
  "o3-mini",
] as const;

/** Pricing per 1M tokens (USD). Input, output. */
const OPENAI_PRICING: Record<string, { input: number; output: number }> = {
  "gpt-4o": { input: 2.5, output: 10 },
  "gpt-4o-mini": { input: 0.15, output: 0.6 },
  "gpt-4o-nano": { input: 0.1, output: 0.4 },
  "gpt-4o-audio-preview": { input: 2.5, output: 10 },
  "gpt-4.1": { input: 2.5, output: 10 },
  "gpt-4.1-mini": { input: 0.4, output: 1.6 },
  "gpt-4-turbo": { input: 10, output: 30 },
  "gpt-4-turbo-mini": { input: 0.4, output: 1.6 },
  "gpt-3.5-turbo": { input: 0.5, output: 1.5 },
  o1: { input: 15, output: 60 },
  "o1-mini": { input: 3, output: 12 },
  "o3-mini": { input: 1.1, output: 4.4 },
};

async function validateKey(
  apiKey: string,
  fetchFn: typeof fetch = fetch
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
  const p = OPENAI_PRICING[modelId];
  if (!p) return null;
  return {
    id: modelId,
    inputPerMillion: p.input,
    outputPerMillion: p.output,
    unit: "USD",
  };
}

function createClient(apiKey: string): ProviderClient {
  return { provider: "openai", baseUrl: BASE_URL };
}

export const openaiProvider: ProviderDefinition = {
  id: "openai",
  name: "OpenAI",
  models: [...OPENAI_MODELS],
  validateKey,
  estimateCost,
  createClient,
};
