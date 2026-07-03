/**
 * Google AI provider adapter. Uses fetch(); no Google SDK.
 */
import type {
  ProviderClient,
  ProviderDefinition,
  ProviderCostEstimate,
  ProviderValidationResult,
} from "./types.js";

const BASE_URL = "https://generativelanguage.googleapis.com";

/** Google AI (Generative Language API) model ids aligned with dashboard catalog + drift checks. */
export const GOOGLE_MODELS = [
  "gemini-3.1-pro-preview",
  "gemini-3-flash-preview",
  "gemini-2.5-pro",
  "gemini-2.5-flash",
] as const;

/** Pricing per 1M tokens (USD). Input, output. Placeholders track UI estimates; verify against Google pricing pages. */
const GOOGLE_PRICING: Record<string, { input: number; output: number }> = {
  "gemini-3.1-pro-preview": { input: 1.25, output: 5 },
  "gemini-3-flash-preview": { input: 0.5, output: 3 },
  "gemini-2.5-pro": { input: 1.25, output: 5 },
  "gemini-2.5-flash": { input: 0.075, output: 0.3 },
};

async function validateKey(
  apiKey: string,
  fetchFn: typeof fetch = fetch
): Promise<ProviderValidationResult> {
  try {
    const url = `${BASE_URL}/v1/models?key=${encodeURIComponent(apiKey)}`;
    const res = await fetchFn(url, { method: "GET" });
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
  const p = GOOGLE_PRICING[modelId];
  if (!p) return null;
  return {
    id: modelId,
    inputPerMillion: p.input,
    outputPerMillion: p.output,
    unit: "USD",
  };
}

function createClient(apiKey: string): ProviderClient {
  return { provider: "google", baseUrl: BASE_URL };
}

export const googleProvider: ProviderDefinition = {
  id: "google",
  name: "Google AI",
  models: [...GOOGLE_MODELS],
  aliases: ["vertex", "google-ai", "gemini"],
  validateKey,
  estimateCost,
  createClient,
};
