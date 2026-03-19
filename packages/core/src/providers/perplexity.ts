import type {
  ProviderClient,
  ProviderDefinition,
  ProviderCostEstimate,
  ProviderValidationResult,
} from "./types.js";

const BASE_URL = "https://api.perplexity.ai";

export const PERPLEXITY_MODELS = [
  "sonar-pro",
  "sonar",
  "sonar-deep-research",
] as const;

async function validateKey(
  apiKey: string,
  fetchFn: typeof fetch = fetch,
): Promise<ProviderValidationResult> {
  try {
    const res = await fetchFn(`${BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "sonar",
        messages: [{ role: "user", content: "test" }],
        max_tokens: 1,
      }),
    });
    if (res.status === 401 || res.status === 403) {
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
  return { provider: "perplexity", baseUrl: BASE_URL };
}

export const perplexityProvider: ProviderDefinition = {
  id: "perplexity",
  name: "Perplexity",
  models: [...PERPLEXITY_MODELS],
  validateKey,
  estimateCost,
  createClient,
};
