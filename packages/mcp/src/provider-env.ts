/**
 * Resolve provider API keys from environment for providers.validate.
 * Never log raw values (security baseline).
 */

/** Conventional env names per provider id (first match wins). */
const CONVENTIONAL_ENV: Record<string, string[]> = {
  openai: ["OPENAI_API_KEY"],
  anthropic: ["ANTHROPIC_API_KEY"],
  google: ["GOOGLE_API_KEY", "GEMINI_API_KEY"],
  "azure-openai": ["AZURE_OPENAI_API_KEY"],
  openrouter: ["OPENROUTER_API_KEY"],
  groq: ["GROQ_API_KEY"],
  mistral: ["MISTRAL_API_KEY"],
  together: ["TOGETHER_API_KEY"],
  deepseek: ["DEEPSEEK_API_KEY"],
  fireworks: ["FIREWORKS_API_KEY"],
  cohere: ["COHERE_API_KEY"],
  perplexity: ["PERPLEXITY_API_KEY"],
  xai: ["XAI_API_KEY"],
  voyage: ["VOYAGE_API_KEY"],
  portkey: ["PORTKEY_API_KEY"],
};

function envKeyForProvider(providerId: string): string {
  return `RESTORMEL_MCP_${providerId.replace(/-/g, "_").toUpperCase()}_KEY`;
}

/**
 * Returns the first non-empty credential for the provider, or null.
 */
export function resolveProviderCredential(providerId: string): string | null {
  const id = providerId.toLowerCase().trim();
  const restormel = process.env[envKeyForProvider(id)];
  if (restormel?.trim()) return restormel.trim();

  const conventional = CONVENTIONAL_ENV[id];
  if (conventional) {
    for (const name of conventional) {
      const v = process.env[name];
      if (v?.trim()) return v.trim();
    }
  }

  return null;
}

/**
 * Human-readable hint when no key is found (no secret values).
 */
export function credentialEnvHint(providerId: string): string {
  const id = providerId.toLowerCase().trim();
  const restormel = envKeyForProvider(id);
  const conventional = CONVENTIONAL_ENV[id]?.[0];
  const parts = [`Set ${restormel}`];
  if (conventional) parts.push(`or ${conventional}`);
  return `${parts.join(" ")} in the MCP process environment.`;
}
