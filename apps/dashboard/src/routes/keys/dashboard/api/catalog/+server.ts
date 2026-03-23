import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { listModels, listProviderModelVariantsByModelIds } from "$lib/server/db";

const CONTRACT_VERSION = "2026-03-20.catalog.v1";

type ProviderValidationMode = "native" | "openai_compatible" | "none";

const PROVIDER_META: Record<
  string,
  { displayName: string; validationMode: ProviderValidationMode; requiresBaseUrl: boolean; requiresModel: boolean }
> = {
  openai: { displayName: "OpenAI", validationMode: "native", requiresBaseUrl: false, requiresModel: true },
  anthropic: { displayName: "Anthropic", validationMode: "native", requiresBaseUrl: false, requiresModel: true },
  google: { displayName: "Google", validationMode: "native", requiresBaseUrl: false, requiresModel: true },
  openrouter: { displayName: "OpenRouter", validationMode: "openai_compatible", requiresBaseUrl: false, requiresModel: true },
  vercel: { displayName: "Vercel AI Gateway", validationMode: "openai_compatible", requiresBaseUrl: false, requiresModel: true },
  portkey: { displayName: "Portkey", validationMode: "openai_compatible", requiresBaseUrl: false, requiresModel: true },
  azure: { displayName: "Azure OpenAI", validationMode: "openai_compatible", requiresBaseUrl: true, requiresModel: true },
  mistral: { displayName: "Mistral", validationMode: "native", requiresBaseUrl: false, requiresModel: true },
  deepseek: { displayName: "DeepSeek", validationMode: "native", requiresBaseUrl: false, requiresModel: true },
  cohere: { displayName: "Cohere", validationMode: "native", requiresBaseUrl: false, requiresModel: true },
  groq: { displayName: "Groq", validationMode: "native", requiresBaseUrl: false, requiresModel: true },
  together: { displayName: "Together AI", validationMode: "openai_compatible", requiresBaseUrl: false, requiresModel: true },
  fireworks: { displayName: "Fireworks", validationMode: "openai_compatible", requiresBaseUrl: false, requiresModel: true },
  perplexity: { displayName: "Perplexity", validationMode: "openai_compatible", requiresBaseUrl: false, requiresModel: true },
  xai: { displayName: "xAI", validationMode: "native", requiresBaseUrl: false, requiresModel: true },
  voyage: { displayName: "Voyage AI", validationMode: "native", requiresBaseUrl: false, requiresModel: true },
};

function titleCaseProvider(providerType: string): string {
  const known = PROVIDER_META[providerType];
  if (known) return known.displayName;
  return providerType
    .split(/[_-]+/g)
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(" ");
}

/** GET: canonical provider+model catalog for downstream BYOK UIs. Public read. */
export const GET: RequestHandler = async ({ url }) => {
  const lifecycleState = url.searchParams.get("lifecycleState")?.trim() || undefined;
  const family = url.searchParams.get("family")?.trim() || undefined;
  const limitParam = url.searchParams.get("limit");
  const limit = limitParam != null ? Math.min(Math.max(1, parseInt(limitParam, 10) || 500), 1000) : 500;
  const offsetParam = url.searchParams.get("offset");
  const offset = offsetParam != null ? Math.max(0, parseInt(offsetParam, 10) || 0) : 0;

  const models = await listModels({ lifecycleState, family, limit, offset });
  const modelIds = models.map((m) => m.id);
  const variants = await listProviderModelVariantsByModelIds(modelIds);

  const variantsByModel = new Map<string, typeof variants>();
  for (const variant of variants) {
    const list = variantsByModel.get(variant.modelId) ?? [];
    list.push(variant);
    variantsByModel.set(variant.modelId, list);
  }

  const providerModelCounts = new Map<string, number>();
  const uniqueModelProviderPairs = new Set<string>();
  for (const variant of variants) {
    const providerId = variant.catalogProviderId ?? variant.providerIntegrationType;
    const key = `${providerId}\0${variant.modelId}`;
    if (uniqueModelProviderPairs.has(key)) continue;
    uniqueModelProviderPairs.add(key);
    providerModelCounts.set(providerId, (providerModelCounts.get(providerId) ?? 0) + 1);
  }

  const providers = Array.from(providerModelCounts.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([providerType, modelCount]) => {
      const meta = PROVIDER_META[providerType];
      return {
        id: providerType,
        displayName: titleCaseProvider(providerType),
        modelCount,
        validation: {
          mode: meta?.validationMode ?? "openai_compatible",
          requiresBaseUrl: meta?.requiresBaseUrl ?? true,
          requiresModel: meta?.requiresModel ?? true,
        },
      };
    });

  const data = models.map((model) => {
    const modelVariants = variantsByModel.get(model.id) ?? [];
    const providerTypes = Array.from(
      new Set(modelVariants.map((v) => v.catalogProviderId ?? v.providerIntegrationType))
    ).sort();
    return {
      id: model.id,
      canonicalName: model.canonicalName,
      family: model.family,
      lifecycleState: model.lifecycleState,
      providerTypes,
      variants: modelVariants.map((variant) => ({
        id: variant.id,
        providerType: variant.catalogProviderId ?? variant.providerIntegrationType,
        providerModelId: variant.providerModelId,
        availabilityStatus: variant.availabilityStatus,
      })),
    };
  });

  return json({
    contractVersion: CONTRACT_VERSION,
    source: "restormel-keys",
    generatedAt: new Date().toISOString(),
    providers,
    data,
    paging: { limit, offset, count: data.length },
  });
};
