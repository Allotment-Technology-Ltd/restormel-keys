import {
  defaultProviders,
  openaiProvider,
  anthropicProvider,
  googleProvider,
} from "@restormel/keys";
import type { ProviderDefinition } from "@restormel/keys";
import type { CanonicalCatalogResponse } from "@restormel/keys/dashboard";

const NON_VIABLE_MODEL_STATES = new Set(["deprecated", "retired"]);
const VIABLE_VARIANT_STATUSES = new Set(["available"]);
const KNOWN_RETIRED_MODEL_IDS = new Set([
  "claude-3-5-haiku-20241022",
]);

export const FALLBACK_PROVIDERS: ProviderDefinition[] = [
  openaiProvider,
  anthropicProvider,
  googleProvider,
];

function normalizeValue(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function isKnownRetiredModel(modelId: string): boolean {
  return KNOWN_RETIRED_MODEL_IDS.has(modelId.trim().toLowerCase());
}

function isViableLifecycleState(lifecycleState: string | null): boolean {
  const normalized = normalizeValue(lifecycleState);
  if (!normalized) return true;
  return !NON_VIABLE_MODEL_STATES.has(normalized);
}

function isViableVariantStatus(availabilityStatus: string | null): boolean {
  return VIABLE_VARIANT_STATUSES.has(normalizeValue(availabilityStatus));
}

function toSafeProviderDefinitions(providers: ProviderDefinition[]): ProviderDefinition[] {
  return providers
    .map((provider) => ({
      ...provider,
      models: provider.models.filter((modelId) => !isKnownRetiredModel(modelId)),
    }))
    .filter((provider) => provider.models.length > 0);
}

const SAFE_FALLBACK_PROVIDERS: ProviderDefinition[] = toSafeProviderDefinitions(FALLBACK_PROVIDERS);

export function buildFallbackCatalog(): CanonicalCatalogResponse {
  return {
    contractVersion: "local-fallback.v1",
    source: "restormel-keys",
    generatedAt: new Date().toISOString(),
    providers: SAFE_FALLBACK_PROVIDERS.map((provider) => ({
      id: provider.id,
      displayName: provider.name,
      modelCount: provider.models.length,
      validation: {
        mode: provider.id === "openai" || provider.id === "anthropic" || provider.id === "google"
          ? "native"
          : "openai_compatible",
        requiresBaseUrl: false,
        requiresModel: true,
      },
    })),
    data: SAFE_FALLBACK_PROVIDERS.flatMap((provider) =>
      provider.models.map((modelId) => ({
        id: modelId,
        canonicalName: modelId,
        family: provider.id,
        lifecycleState: "active",
        providerTypes: [provider.id],
        variants: [],
      }))
    ),
    paging: { limit: 0, offset: 0, count: FALLBACK_PROVIDERS.length },
  };
}

export function providerDefinitionsFromCatalog(catalog: CanonicalCatalogResponse): ProviderDefinition[] {
  const modelIdsByProvider = new Map<string, Set<string>>();
  for (const model of catalog.data) {
    if (isKnownRetiredModel(model.id) || !isViableLifecycleState(model.lifecycleState)) continue;
    for (const variant of model.variants) {
      if (!isViableVariantStatus(variant.availabilityStatus)) continue;
      const providerType = variant.providerType;
      const bucket = modelIdsByProvider.get(providerType) ?? new Set<string>();
      bucket.add(model.id);
      modelIdsByProvider.set(providerType, bucket);
    }
  }

  const providers: ProviderDefinition[] = [];
  for (const providerInfo of catalog.providers) {
    const source = defaultProviders.find(
      (provider) =>
        provider.id === providerInfo.id ||
        Boolean(provider.aliases?.includes(providerInfo.id))
    );
    if (!source) continue;
    const modelSet = modelIdsByProvider.get(providerInfo.id);
    if (!modelSet || modelSet.size === 0) continue;
    const models = source.models.filter((modelId) => modelSet.has(modelId) && !isKnownRetiredModel(modelId));
    if (models.length === 0) continue;
    providers.push({
      ...source,
      models,
      name: providerInfo.displayName || source.name,
    });
  }

  return providers.length > 0 ? providers : SAFE_FALLBACK_PROVIDERS;
}
