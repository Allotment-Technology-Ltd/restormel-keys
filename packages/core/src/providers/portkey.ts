/**
 * Portkey provider adapter. Uses fetch(); no SDK.
 *
 * Portkey is a gateway; its key validates against Portkey's /models endpoint.
 */
import type {
  ProviderClient,
  ProviderDefinition,
  ProviderCostEstimate,
  ProviderValidationResult,
} from "./types.js";

const BASE_URL = "https://api.portkey.ai/v1";

export const PORTKEY_MODELS: string[] = [];

async function validateKey(
  apiKey: string,
  fetchFn: typeof fetch = fetch
): Promise<ProviderValidationResult> {
  try {
    const res = await fetchFn(`${BASE_URL}/models`, {
      method: "GET",
      headers: { "x-portkey-api-key": apiKey },
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
  return { provider: "portkey", baseUrl: BASE_URL };
}

export const portkeyProvider: ProviderDefinition = {
  id: "portkey",
  name: "Portkey",
  models: PORTKEY_MODELS,
  validateKey,
  estimateCost,
  createClient,
};

