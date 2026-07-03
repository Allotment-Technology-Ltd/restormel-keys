import type {
  ProviderClient,
  ProviderDefinition,
  ProviderCostEstimate,
  ProviderValidationResult,
} from "./types.js";

const BASE_URL = "https://api.mistral.ai";

/**
 * Chat / text-generation model IDs accepted by Mistral's OpenAI-compatible API.
 * Includes `-latest` aliases, dated releases, labs IDs, and legacy slugs still seen in integrations.
 * Non-chat modalities (standalone OCR, TTS-only, etc.) are omitted.
 */
export const MISTRAL_MODELS = [
  "codestral-25-01",
  "codestral-25-08",
  "codestral-2405",
  "codestral-2501",
  "codestral-latest",
  "devstral-2-25-12",
  "devstral-medium-2507",
  "devstral-small-1-1-25-07",
  "devstral-small-1-0-25-05",
  "devstral-small-2505",
  "devstral-small-2507",
  "labs-devstral-small-2512",
  "labs-mistral-small-creative",
  "magistral-medium-1-0-25-06",
  "magistral-medium-1-1-25-07",
  "magistral-medium-1-2-25-09",
  "magistral-medium-2506",
  "magistral-medium-2507",
  "magistral-small-1-0-25-06",
  "magistral-small-1-1-25-07",
  "magistral-small-1-2-25-09",
  "magistral-small-2506",
  "magistral-small-2507",
  "ministral-3-14b-25-12",
  "ministral-3-3b-25-12",
  "ministral-3-8b-25-12",
  "ministral-3b-2410",
  "ministral-8b-2410",
  "minstral-8b-2409",
  "mistral-large-2402",
  "mistral-large-2407",
  "mistral-large-2411",
  "mistral-large-3-25-12",
  "mistral-large-latest",
  "mistral-medium-2312",
  "mistral-medium-3-25-05",
  "mistral-medium-3-1-25-08",
  "mistral-medium-latest",
  "mistral-moderation-2411",
  "mistral-moderation-26-03",
  "mistral-nemo-12b-24-07",
  "mistral-saba-2502",
  "mistral-small-2402",
  "mistral-small-2409",
  "mistral-small-2501",
  "mistral-small-2503",
  "mistral-small-3-0-25-01",
  "mistral-small-3-1-25-03",
  "mistral-small-3-2-25-06",
  "mistral-small-4-0-26-03",
  "mistral-small-creative-25-12",
  "mistral-small-latest",
  "open-mistral-7b",
  "open-mistral-nemo",
  "open-mixtral-8x22b",
  "open-mixtral-8x7b",
  "pixtral-12b-2409",
  "pixtral-large-2411",
  "pixtral-large-latest",
] as const;

/** USD per 1M tokens where published; unknown models return null from estimateCost. */
const MISTRAL_PRICING: Record<string, { input: number; output: number }> = {
  "mistral-large-latest": { input: 2, output: 6 },
  "mistral-medium-latest": { input: 2.7, output: 8.1 },
  "mistral-small-latest": { input: 0.2, output: 0.6 },
  "codestral-latest": { input: 0.3, output: 0.9 },
  "open-mistral-nemo": { input: 0.15, output: 0.15 },
  "pixtral-12b-2409": { input: 0.3, output: 0.3 },
  "pixtral-large-latest": { input: 2, output: 6 },
  "minstral-8b-2409": { input: 0.2, output: 0.2 },
  "mistral-large-3-25-12": { input: 2, output: 6 },
  "devstral-2-25-12": { input: 0.4, output: 2 },
  "mistral-medium-3-1-25-08": { input: 2.7, output: 8.1 },
  "mistral-small-4-0-26-03": { input: 0.2, output: 0.6 },
  "mistral-small-3-2-25-06": { input: 0.2, output: 0.6 },
  "ministral-3-14b-25-12": { input: 0.2, output: 0.2 },
  "ministral-3-8b-25-12": { input: 0.2, output: 0.2 },
  "ministral-3-3b-25-12": { input: 0.1, output: 0.1 },
  "magistral-medium-1-2-25-09": { input: 2, output: 6 },
  "magistral-small-1-2-25-09": { input: 0.2, output: 0.2 },
  "mistral-medium-3-25-05": { input: 2.7, output: 8.1 },
  "codestral-25-08": { input: 0.3, output: 0.9 },
  "mistral-large-2411": { input: 2, output: 6 },
  "pixtral-large-2411": { input: 2, output: 6 },
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
  const p = MISTRAL_PRICING[modelId];
  if (!p) return null;
  return { id: modelId, inputPerMillion: p.input, outputPerMillion: p.output, unit: "USD" };
}

function createClient(_apiKey: string): ProviderClient {
  return { provider: "mistral", baseUrl: BASE_URL };
}

export const mistralProvider: ProviderDefinition = {
  id: "mistral",
  name: "Mistral",
  models: [...MISTRAL_MODELS],
  validateKey,
  estimateCost,
  createClient,
};
