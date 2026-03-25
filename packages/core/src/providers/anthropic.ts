/**
 * Anthropic provider adapter. Uses fetch(); no Anthropic SDK.
 */
import type {
  ProviderClient,
  ProviderDefinition,
  ProviderCostEstimate,
  ProviderValidationResult,
} from "./types.js";

const BASE_URL = "https://api.anthropic.com";

export const ANTHROPIC_MODELS = [
  "claude-sonnet-4",
  "claude-haiku-4.5",
  "claude-opus-4",
  "claude-3-5-sonnet-20241022",
  "claude-3-5-haiku-20241022",
] as const;

/** Pricing per 1M tokens (USD). Input, output. */
const ANTHROPIC_PRICING: Record<string, { input: number; output: number }> = {
  "claude-sonnet-4": { input: 3, output: 15 },
  "claude-haiku-4.5": { input: 0.25, output: 1.25 },
  "claude-opus-4": { input: 15, output: 75 },
  "claude-3-5-sonnet-20241022": { input: 3, output: 15 },
  "claude-3-5-haiku-20241022": { input: 0.8, output: 4 },
};

async function validateKey(
  apiKey: string,
  fetchFn: typeof fetch = fetch
): Promise<ProviderValidationResult> {
  try {
    const res = await fetchFn(`${BASE_URL}/v1/models`, {
      method: "GET",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
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
  const p = ANTHROPIC_PRICING[modelId];
  if (!p) return null;
  return {
    id: modelId,
    inputPerMillion: p.input,
    outputPerMillion: p.output,
    unit: "USD",
  };
}

function createClient(apiKey: string): ProviderClient {
  return { provider: "anthropic", baseUrl: BASE_URL };
}

export const anthropicProvider: ProviderDefinition = {
  id: "anthropic",
  name: "Anthropic",
  models: [...ANTHROPIC_MODELS],
  validateKey,
  estimateCost,
  createClient,
};
