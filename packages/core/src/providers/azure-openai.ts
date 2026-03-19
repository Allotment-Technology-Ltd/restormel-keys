import type {
  ProviderClient,
  ProviderDefinition,
  ProviderCostEstimate,
  ProviderValidationResult,
} from "./types.js";

export const AZURE_OPENAI_MODELS: string[] = [];

async function validateKey(
  apiKey: string,
  fetchFn: typeof fetch = fetch,
): Promise<ProviderValidationResult> {
  try {
    const res = await fetchFn("https://management.azure.com/providers/Microsoft.CognitiveServices?api-version=2021-04-01", {
      method: "GET",
      headers: { Authorization: `Bearer ${apiKey}` },
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
  return { provider: "azure-openai", baseUrl: "https://YOUR_RESOURCE.openai.azure.com" };
}

export const azureOpenaiProvider: ProviderDefinition = {
  id: "azure-openai",
  name: "Azure OpenAI",
  models: AZURE_OPENAI_MODELS,
  aliases: ["azure"],
  validateKey,
  estimateCost,
  createClient,
};
