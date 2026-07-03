/**
 * Provider adapter types. Pure TypeScript; no SDK dependencies.
 */

export interface ProviderValidationResult {
  valid: boolean;
  errors?: string[];
}

export interface ProviderCostEstimate {
  /** Model identifier. */
  id: string;
  /** Cost per 1M input tokens (USD). */
  inputPerMillion?: number;
  /** Cost per 1M output tokens (USD). */
  outputPerMillion?: number;
  unit?: string;
}

/** Minimal client interface; callers use fetch() or this. */
export interface ProviderClient {
  /** Provider id (e.g. "openai"). */
  provider: string;
  /** Base URL for API (e.g. https://api.openai.com). */
  baseUrl: string;
}

export interface ProviderDefinition {
  id: string;
  /** Display name. */
  name: string;
  /** Model ids served by this provider. */
  models: string[];
  /** Validate provider credential (e.g. OpenAI API key) via GET /v1/models. Uses fetch; no SDK. */
  validateKey: (providerCredential: string, fetchFn?: typeof fetch) => Promise<ProviderValidationResult>;
  /** Cost estimate for a model (pricing table lookup). */
  estimateCost: (modelId: string) => ProviderCostEstimate | null;
  /** Create a minimal client (no SDK). Parameter is the provider credential (e.g. OpenAI API key). */
  createClient: (providerCredential: string) => ProviderClient;
  /** Alternative ids that resolve to this provider (e.g. ["vertex"] for google). */
  aliases?: string[];
  /** Inline SVG string for the provider icon; overrides built-in icons in UI components. */
  icon?: string;
}

export function defineProvider(def: ProviderDefinition): ProviderDefinition {
  return def;
}

export function resolveProviderId(
  id: string,
  providers: ProviderDefinition[],
): ProviderDefinition | undefined {
  return providers.find(
    (p) => p.id === id || p.aliases?.includes(id),
  );
}

/**
 * Return the canonical provider id for storage. Use when persisting key records
 * so that alias-based ids (e.g. "vertex") are stored as the definition's id
 * (e.g. "google"). If no provider matches, returns the original id.
 */
export function canonicalizeProviderId(
  id: string,
  providers: ProviderDefinition[],
): string {
  const def = resolveProviderId(id, providers);
  return def?.id ?? id;
}
