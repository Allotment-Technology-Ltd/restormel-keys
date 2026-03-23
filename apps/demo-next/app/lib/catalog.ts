import {
  defaultProviders,
  openaiProvider,
  anthropicProvider,
  googleProvider,
} from "@restormel/keys";
import type { ProviderDefinition } from "@restormel/keys";
import type { CanonicalCatalogResponse } from "@restormel/keys/dashboard";

export const FALLBACK_PROVIDERS: ProviderDefinition[] = [
  openaiProvider,
  anthropicProvider,
  googleProvider,
];

export function buildFallbackCatalog(): CanonicalCatalogResponse {
  return {
    contractVersion: "local-fallback.v1",
    source: "restormel-keys",
    generatedAt: new Date().toISOString(),
    providers: FALLBACK_PROVIDERS.map((provider) => ({
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
    data: FALLBACK_PROVIDERS.flatMap((provider) =>
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
    for (const providerType of model.providerTypes) {
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
    const models = modelSet
      ? source.models.filter((modelId) => modelSet.has(modelId))
      : source.models;
    providers.push({
      ...source,
      models,
      name: providerInfo.displayName || source.name,
    });
  }

  return providers.length > 0 ? providers : FALLBACK_PROVIDERS;
}
