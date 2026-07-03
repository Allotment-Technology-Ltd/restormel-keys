/**
 * xAI (Grok) provider adapter. Uses fetch(); no SDK.
 * https://docs.x.ai/
 */
import type {
  ProviderClient,
  ProviderDefinition,
  ProviderCostEstimate,
  ProviderValidationResult,
} from "./types.js";

const BASE_URL = "https://api.x.ai/v1";

export const XAI_MODELS = [
  "grok-3-fast",
  "grok-3",
  "grok-3-mini",
  "grok-2-vision-1212",
  "grok-2-1212",
  "grok-2-mini",
] as const;

const XAI_PRICING: Record<string, { input: number; output: number }> = {
  "grok-3-fast": { input: 0.2, output: 0.8 },
  "grok-3": { input: 2, output: 10 },
  "grok-3-mini": { input: 0.1, output: 0.4 },
  "grok-2-vision-1212": { input: 2, output: 10 },
  "grok-2-1212": { input: 2, output: 10 },
  "grok-2-mini": { input: 0.1, output: 0.4 },
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
  const p = XAI_PRICING[modelId];
  if (!p) return null;
  return { id: modelId, inputPerMillion: p.input, outputPerMillion: p.output, unit: "USD" };
}

function createClient(_apiKey: string): ProviderClient {
  return { provider: "xai", baseUrl: BASE_URL };
}

export const xaiProvider: ProviderDefinition = {
  id: "xai",
  name: "xAI (Grok)",
  models: [...XAI_MODELS],
  validateKey,
  estimateCost,
  createClient,
};
