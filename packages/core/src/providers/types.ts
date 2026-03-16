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
}
