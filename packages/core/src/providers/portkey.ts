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

// Portkey is a gateway; these are common model ids users can route to.
export const PORTKEY_MODELS: string[] = [
  "gpt-4o",
  "gpt-4o-mini",
  "gpt-3.5-turbo",
  "claude-sonnet-4",
  "claude-haiku-4.5",
  "gemini-3.1-pro-preview",
  "gemini-3-flash-preview",
  "gemini-2.5-pro",
  "gemini-2.5-flash",
  "llama-3.3-70b-versatile",
  "deepseek-chat",
  "mistral-large-latest",
];

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

