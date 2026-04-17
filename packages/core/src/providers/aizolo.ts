/**
 * AiZolo — OpenAI Chat Completions–compatible API at chat.aizolo.com.
 * Auth: Bearer token as issued by AiZolo (often `aizolo_…`); pass through unchanged.
 */
import type {
  ProviderClient,
  ProviderDefinition,
  ProviderCostEstimate,
  ProviderValidationResult,
} from "./types.js";
import { AIZOLO_VENDOR_MODEL_IDS } from "./aizolo-models.js";

/** Base for `POST …/chat/completions` (same pattern as other OpenAI-compatible adapters). */
const BASE_URL = "https://chat.aizolo.com/api/v1";

/** Vendor `model` strings; aligned with dashboard catalog `provider_model_variants` for `aizolo`. */
export const AIZOLO_MODELS = [...AIZOLO_VENDOR_MODEL_IDS];

async function validateKey(
  apiKey: string,
  fetchFn: typeof fetch = fetch,
): Promise<ProviderValidationResult> {
  try {
    const res = await fetchFn(`${BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey.trim()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai",
        messages: [{ role: "user", content: "." }],
        max_tokens: 1,
      }),
    });
    if (res.status === 401 || res.status === 403) {
      const text = await res.text();
      return { valid: false, errors: [`${res.status}: ${text.slice(0, 200)}`] };
    }
    if (!res.ok && res.status !== 429) {
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
  return { provider: "aizolo", baseUrl: BASE_URL };
}

export const aizoloProvider: ProviderDefinition = {
  id: "aizolo",
  name: "AiZolo",
  models: [...AIZOLO_MODELS],
  validateKey,
  estimateCost,
  createClient,
};
