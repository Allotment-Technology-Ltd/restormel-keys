/**
 * Allowed values for persisted `provider_preference` on route steps.
 * Shared by dashboard UI (`route-step-providers`) and server validation — keep in sync with
 * {@link normalizeProviderForStorage} in `$lib/server/canonical-provider`.
 */
export const ROUTE_STEP_ALLOWED_STORAGE_PROVIDER_IDS = [
  "openai",
  "anthropic",
  "google",
  "openrouter",
  "vercel",
  "portkey",
  "voyage",
  "mistral",
  "deepseek",
  "together",
  "cohere",
  "groq",
  "aizolo",
] as const;

export type RouteStepAllowedStorageProviderId =
  (typeof ROUTE_STEP_ALLOWED_STORAGE_PROVIDER_IDS)[number];

export const ROUTE_STEP_ALLOWED_STORAGE_PROVIDERS = new Set<string>(
  ROUTE_STEP_ALLOWED_STORAGE_PROVIDER_IDS,
);
