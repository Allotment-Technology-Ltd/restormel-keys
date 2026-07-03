/**
 * Hybrid catalog governance: CI enforces that dashboard `model-catalog-seed.json`
 * covers every default model ID for these providers. Other providers may list more
 * models in `@restormel/keys` than the seed file until a sync pipeline expands coverage.
 */
export const CATALOG_DRIFT_SYNC_PROVIDER_IDS = ["openai", "anthropic", "google"] as const;
export type CatalogDriftSyncProviderId = (typeof CATALOG_DRIFT_SYNC_PROVIDER_IDS)[number];
