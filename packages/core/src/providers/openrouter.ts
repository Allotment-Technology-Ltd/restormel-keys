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

// OpenRouter is an aggregator; model availability is dynamic. Keep this list minimal.
export const OPENROUTER_MODELS: string[] = [];

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

