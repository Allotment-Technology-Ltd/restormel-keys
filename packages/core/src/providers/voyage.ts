/**
 * Voyage AI provider adapter (embeddings). Uses fetch(); no SDK.
 * https://docs.voyageai.com/
 */
import type {
  ProviderClient,
  ProviderDefinition,
  ProviderCostEstimate,
  ProviderValidationResult,
} from "./types.js";

const BASE_URL = "https://api.voyageai.com";

export const VOYAGE_MODELS = [
  "voyage-3",
  "voyage-3-lite",
  "voyage-large-2",
  "voyage-large-2-instruct",
  "voyage-code-2",
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
  return { provider: "voyage", baseUrl: BASE_URL };
}

export const voyageProvider: ProviderDefinition = {
  id: "voyage",
  name: "Voyage AI",
  models: [...VOYAGE_MODELS],
  validateKey,
  estimateCost,
  createClient,
};
