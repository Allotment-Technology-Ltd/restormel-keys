import type {
  ProviderClient,
  ProviderDefinition,
  ProviderCostEstimate,
  ProviderValidationResult,
} from "./types.js";

const BASE_URL = "https://api.cohere.com";

export const COHERE_MODELS = [
  "command-r-plus",
  "command-r",
  "command-r7b",
  "command-light",
  "command-a",
  "aya-23-8b",
  "aya-23-35b",
] as const;

const COHERE_PRICING: Record<string, { input: number; output: number }> = {
  "command-r-plus": { input: 2.5, output: 10 },
  "command-r": { input: 0.15, output: 0.6 },
  "command-r7b": { input: 0.03, output: 0.03 },
  "command-light": { input: 0.08, output: 0.08 },
  "command-a": { input: 0.15, output: 0.6 },
  "aya-23-8b": { input: 0.2, output: 0.2 },
  "aya-23-35b": { input: 0.8, output: 0.8 },
};

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

function estimateCost(modelId: string): ProviderCostEstimate | null {
  const p = COHERE_PRICING[modelId];
  if (!p) return null;
  return { id: modelId, inputPerMillion: p.input, outputPerMillion: p.output, unit: "USD" };
}

function createClient(_apiKey: string): ProviderClient {
  return { provider: "cohere", baseUrl: BASE_URL };
}

export const cohereProvider: ProviderDefinition = {
  id: "cohere",
  name: "Cohere",
  models: [...COHERE_MODELS],
  validateKey,
  estimateCost,
  createClient,
};
