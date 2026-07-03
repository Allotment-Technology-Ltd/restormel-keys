import type {
  ProviderClient,
  ProviderDefinition,
  ProviderCostEstimate,
  ProviderValidationResult,
} from "./types.js";

const BASE_URL = "https://api.groq.com/openai";

export const GROQ_MODELS = [
  "llama-3.3-70b-versatile",
  "llama-3.2-90b-vision-preview",
  "llama-3.2-11b-vision-preview",
  "llama-3.1-8b-instant",
  "llama-3.1-70b-versatile",
  "mixtral-8x7b-32768",
  "gemma2-9b-it",
  "llama-guard-3-8b",
] as const;

const GROQ_PRICING: Record<string, { input: number; output: number }> = {
  "llama-3.3-70b-versatile": { input: 0.59, output: 0.79 },
  "llama-3.2-90b-vision-preview": { input: 0.9, output: 0.9 },
  "llama-3.2-11b-vision-preview": { input: 0.15, output: 0.15 },
  "llama-3.1-8b-instant": { input: 0.05, output: 0.08 },
  "llama-3.1-70b-versatile": { input: 0.59, output: 0.79 },
  "mixtral-8x7b-32768": { input: 0.24, output: 0.24 },
  "gemma2-9b-it": { input: 0.2, output: 0.2 },
  "llama-guard-3-8b": { input: 0.05, output: 0.05 },
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
  const p = GROQ_PRICING[modelId];
  if (!p) return null;
  return { id: modelId, inputPerMillion: p.input, outputPerMillion: p.output, unit: "USD" };
}

function createClient(_apiKey: string): ProviderClient {
  return { provider: "groq", baseUrl: BASE_URL };
}

export const groqProvider: ProviderDefinition = {
  id: "groq",
  name: "Groq",
  models: [...GROQ_MODELS],
  validateKey,
  estimateCost,
  createClient,
};
