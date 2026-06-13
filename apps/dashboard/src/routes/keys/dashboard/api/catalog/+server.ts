import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import {
  buildDefaultProviderModelAllowlist,
  isProviderModelInDefaultAllowlist,
} from "@restormel/keys";
import {
  buildExternalSignalsFreshness,
  getOpenRouterEndpointHealthByModel,
  loadCatalogExternalContext,
} from "$lib/server/catalog-external-signals";
import {
  epochMsToIsoOrNull,
  isViableCatalogVariantAvailability,
} from "$lib/server/catalog-viability";
import { listCatalogModelObservationsForPairs, listModels, listProviderModelVariantsByModelIds } from "$lib/server/db";
import { GATEWAY_PROVIDER_TYPES } from "$lib/server/module-gates";
import { resolveModuleFlagsSync } from "$lib/server/module-flags";

// ---------------------------------------------------------------------------
// Serve-stale: last-known-good catalog response (in-process module-level cache).
//
// Mirrors the pattern from auth.ts `lastKnownGoodOrDegraded` (~:169).
// On a DB/Neon error we return the last successful catalog body rather than
// propagating a 500.  The external contract shape is preserved exactly.
// ---------------------------------------------------------------------------

type CatalogResponseBody = Record<string, unknown>;

/** Last successfully built catalog payload, or null on a cold process. */
let _lastKnownGoodCatalog: CatalogResponseBody | null = null;
/** Epoch-ms timestamp of the last successful catalog build (for logging). */
let _lastKnownGoodAt = 0;

function writeCatalogCache(body: CatalogResponseBody): void {
  _lastKnownGoodCatalog = body;
  _lastKnownGoodAt = Date.now();
}

/**
 * Returns a serve-stale catalog JSON response, or a clearly-degraded 503 if no
 * prior successful response has been cached (cold process + DB down).
 *
 * The returned body carries `degraded: true` so consumers can detect infra blips
 * without the shape breaking.  On the stale path the `contract_version` and all
 * fields are identical to the last live response — the external contract is preserved.
 */
function serveStaleCatalogOrDegraded(dbError: unknown): Response {
  const errMessage = dbError instanceof Error ? dbError.message : String(dbError);

  if (_lastKnownGoodCatalog !== null) {
    // Serve last-known-good with the same shape + a degraded marker.
    const staleBody: CatalogResponseBody = {
      ..._lastKnownGoodCatalog,
      degraded: true,
      degradedReason: "db_error",
      degradedAt: new Date().toISOString(),
      lastKnownGoodAt: new Date(_lastKnownGoodAt).toISOString(),
    };
    return json(staleBody, {
      status: 200,
      headers: {
        // Short re-validation TTL so consumers retry promptly once the DB recovers.
        "cache-control": "public, max-age=30, stale-while-revalidate=120",
        "x-catalog-degraded": "true",
      },
    });
  }

  // Cold process + DB down: return a valid-shaped degraded 503.
  return json(
    {
      contract_version: CONTRACT_VERSION,
      source: "restormel-keys",
      generatedAt: new Date().toISOString(),
      compatibility: CATALOG_COMPATIBILITY,
      degraded: true,
      degradedReason: "db_error_cold_start",
      degradedDetail: errMessage,
      providers: [],
      data: [],
      paging: { limit: 0, offset: 0, count: 0 },
    },
    {
      status: 503,
      headers: {
        "cache-control": "no-store",
        "x-catalog-degraded": "true",
      },
    }
  );
}

/** Bump when response semantics change (e.g. default allowlist, externalSignals, crowd observations). */
const CONTRACT_VERSION = "2026-03-26.catalog.v6";
const CATALOG_COMPATIBILITY = {
  minCliVersion: "0.1.4",
  minCoreDashboardVersion: "0.2.7",
  docsUrl: "https://restormel.dev/keys/docs/guides/canonical-catalog",
} as const;

const DEFAULT_PROVIDER_MODEL_ALLOWLIST = buildDefaultProviderModelAllowlist();

type ProviderValidationMode = "native" | "openai_compatible" | "none";

/** Canonical public OpenAI-compatible bases (align with @restormel/keys provider adapters). */
const OPENAI_COMPATIBLE_DEFAULT_BASE: Record<string, string> = {
  openrouter: "https://openrouter.ai/api/v1",
  vercel: "https://ai-gateway.vercel.sh/v1",
  aizolo: "https://chat.aizolo.com/api/v1",
  portkey: "https://api.portkey.ai/v1",
  together: "https://api.together.xyz/v1",
  fireworks: "https://api.fireworks.ai/inference/v1",
  perplexity: "https://api.perplexity.ai",
};

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
  aizolo: { displayName: "AiZolo", validationMode: "openai_compatible", requiresBaseUrl: false, requiresModel: true },
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
  const flags = resolveModuleFlagsSync();
  const lifecycleState = url.searchParams.get("lifecycleState")?.trim() || undefined;
  const family = url.searchParams.get("family")?.trim() || undefined;
  const limitParam = url.searchParams.get("limit");
  const limit = limitParam != null ? Math.min(Math.max(1, parseInt(limitParam, 10) || 500), 1000) : 500;
  const offsetParam = url.searchParams.get("offset");
  const offset = offsetParam != null ? Math.max(0, parseInt(offsetParam, 10) || 0) : 0;
  const includeUnhealthy =
    url.searchParams.get("includeUnhealthy") === "1" ||
    url.searchParams.get("includeUnhealthy")?.toLowerCase() === "true";
  const skipDefaultAllowlist =
    url.searchParams.get("skipDefaultAllowlist") === "1" ||
    url.searchParams.get("skipDefaultAllowlist")?.toLowerCase() === "true";

  // -------------------------------------------------------------------------
  // DB reads — wrapped to serve last-known-good on any DB/Neon error.
  // Three reads at the original lines :91, :97, :173 are all covered here.
  // -------------------------------------------------------------------------
  let rawModels: Awaited<ReturnType<typeof listModels>>;
  let externalCtx: Awaited<ReturnType<typeof loadCatalogExternalContext>> | null;
  let rawVariants: Awaited<ReturnType<typeof listProviderModelVariantsByModelIds>>;
  let crowdByKey: Awaited<ReturnType<typeof listCatalogModelObservationsForPairs>>;

  try {
    [rawModels, externalCtx] = await Promise.all([
      listModels({ lifecycleState, family, limit, offset, includeUnhealthy }),
      flags.catalogExternalSignals ? loadCatalogExternalContext() : Promise.resolve(null),
    ]);
  } catch (err) {
    console.error("[catalog] DB error on listModels/loadCatalogExternalContext — serving stale", err);
    return serveStaleCatalogOrDegraded(err);
  }

  const models = rawModels;
  const modelIds = models.map((m) => m.id);

  try {
    rawVariants = await listProviderModelVariantsByModelIds(modelIds);
  } catch (err) {
    console.error("[catalog] DB error on listProviderModelVariantsByModelIds — serving stale", err);
    return serveStaleCatalogOrDegraded(err);
  }
  let variants = includeUnhealthy
    ? rawVariants
    : rawVariants.filter((variant) => isViableCatalogVariantAvailability(variant.availabilityStatus));
  if (!flags.gatewayProviders) {
    variants = variants.filter((variant) => {
      const providerId = (variant.catalogProviderId ?? variant.providerIntegrationType).toLowerCase();
      return !GATEWAY_PROVIDER_TYPES.has(providerId);
    });
  }
  if (!skipDefaultAllowlist) {
    variants = variants.filter((variant) => {
      const providerId = variant.catalogProviderId ?? variant.providerIntegrationType;
      return isProviderModelInDefaultAllowlist(
        providerId,
        variant.providerModelId,
        DEFAULT_PROVIDER_MODEL_ALLOWLIST
      );
    });
    const orListed = externalCtx?.openRouterListedIds;
    if (orListed) {
      variants = variants.filter((variant) => {
        const providerId = variant.catalogProviderId ?? variant.providerIntegrationType;
        if (providerId !== "openrouter") return true;
        return orListed.has(variant.providerModelId);
      });
    }
  }

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
    .filter(([providerType]) => flags.gatewayProviders || !GATEWAY_PROVIDER_TYPES.has(providerType.toLowerCase()))
    .map(([providerType, modelCount]) => {
      const meta = PROVIDER_META[providerType];
      const mode = meta?.validationMode ?? "openai_compatible";
      const requiresBaseUrl = meta?.requiresBaseUrl ?? true;
      const requiresModel = meta?.requiresModel ?? true;
      const validation: {
        mode: ProviderValidationMode;
        requiresBaseUrl: boolean;
        requiresModel: boolean;
        defaultApiBaseUrl?: string;
      } = { mode, requiresBaseUrl, requiresModel };
      if (mode === "openai_compatible" && !requiresBaseUrl) {
        const base = OPENAI_COMPATIBLE_DEFAULT_BASE[providerType];
        if (base) validation.defaultApiBaseUrl = base;
      }
      return {
        id: providerType,
        displayName: titleCaseProvider(providerType),
        modelCount,
        validation,
      };
    });

  const observationPairs = variants.map((v) => ({
    catalogProviderId: v.catalogProviderId ?? v.providerIntegrationType,
    providerModelId: v.providerModelId,
  }));

  try {
    crowdByKey = await listCatalogModelObservationsForPairs(observationPairs);
  } catch (err) {
    console.error("[catalog] DB error on listCatalogModelObservationsForPairs — serving stale", err);
    return serveStaleCatalogOrDegraded(err);
  }

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
      deprecationDate: epochMsToIsoOrNull(model.deprecationDate),
      retirementDate: epochMsToIsoOrNull(model.retirementDate),
      replacementModelId: model.replacementModelId,
      providerTypes,
      variants: modelVariants.map((variant) => {
        const providerType = variant.catalogProviderId ?? variant.providerIntegrationType;
        const obsKey = `${providerType}\t${variant.providerModelId}`;
        const obs = crowdByKey.get(obsKey);
        const crowdObservations =
          obs && (obs.deprecatedReportCount > 0 || obs.retiredReportCount > 0)
            ? {
                deprecatedReportCount: obs.deprecatedReportCount,
                retiredReportCount: obs.retiredReportCount,
                firstReportedAt:
                  obs.firstReportedAt != null ? new Date(obs.firstReportedAt).toISOString() : null,
                lastReportedAt:
                  obs.lastReportedAt != null ? new Date(obs.lastReportedAt).toISOString() : null,
              }
            : undefined;
        return {
          id: variant.id,
          providerType,
          providerModelId: variant.providerModelId,
          availabilityStatus: variant.availabilityStatus,
          ...(crowdObservations ? { crowdObservations } : {}),
        };
      }),
    };
  }).filter((model) => includeUnhealthy || model.variants.length > 0);

  const openRouterModelIds = Array.from(
    new Set(
      variants
        .filter((variant) => (variant.catalogProviderId ?? variant.providerIntegrationType) === "openrouter")
        .map((variant) => variant.providerModelId)
    )
  );
  const openRouterEndpointHealth = flags.catalogExternalSignals
    ? await getOpenRouterEndpointHealthByModel(openRouterModelIds)
    : {};

  const freshness = flags.catalogExternalSignals && externalCtx
    ? buildExternalSignalsFreshness({
        openRouterModelsFetchedAt: externalCtx.payload.openRouter.fetchedAt,
        openaiFetchedAt: externalCtx.payload.providerStatus.openai.fetchedAt,
        anthropicFetchedAt: externalCtx.payload.providerStatus.anthropic.fetchedAt,
        endpointHealthByModel: openRouterEndpointHealth,
      })
    : null;

  // Build the response body and update the serve-stale cache before returning.
  const responseBody: CatalogResponseBody = {
    contract_version: CONTRACT_VERSION,
    source: "restormel-keys",
    generatedAt: new Date().toISOString(),
    compatibility: CATALOG_COMPATIBILITY,
    ...(flags.catalogExternalSignals && externalCtx
      ? {
          externalSignals: {
            freshness,
            ...externalCtx.payload,
            openRouter: {
              ...externalCtx.payload.openRouter,
              endpointHealthByModel: openRouterEndpointHealth,
            },
          },
        }
      : {}),
    providers,
    data,
    paging: { limit, offset, count: data.length },
  };

  // Update last-known-good cache so a subsequent DB error can serve this response.
  writeCatalogCache(responseBody);

  return json(responseBody, {
    headers: {
      // Short public TTL: the catalog changes infrequently and is externally consumed by
      // allotmentology.tech; a 60 s max-age lets any CDN/Traefik layer absorb repeat reads
      // while keeping data reasonably fresh. stale-while-revalidate gives a grace window.
      "cache-control": "public, max-age=60, stale-while-revalidate=300",
    },
  });
};
