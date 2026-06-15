import type { PageServerLoad } from "./$types";
import { buildDefaultProviderModelAllowlist, isProviderModelInDefaultAllowlist } from "@restormel/keys";
import { listCatalogModelObservationsForPairs, listModels, listProviderModelVariants } from "$lib/server/db";

const DEFAULT_ALLOWLIST = buildDefaultProviderModelAllowlist();

export const load: PageServerLoad = async ({ url }) => {
  const lifecycleState = url.searchParams.get("lifecycleState")?.trim() || undefined;
  const limit = Math.min(500, Math.max(1, parseInt(url.searchParams.get("limit") ?? "100", 10) || 100));
  const offset = Math.max(0, parseInt(url.searchParams.get("offset") ?? "0", 10) || 0);
  try {
    const models = await listModels({ lifecycleState, limit, offset, includeUnhealthy: true });
    const variantRows = await Promise.all(models.map((m) => listProviderModelVariants(m.id)));
    const byModelId = new Map(models.map((m, idx) => [m.id, variantRows[idx]]));

    const allPairs: { catalogProviderId: string; providerModelId: string }[] = [];
    for (const rows of variantRows) {
      for (const v of rows) {
        const catalogProviderId = v.catalogProviderId ?? v.providerIntegrationType;
        allPairs.push({ catalogProviderId, providerModelId: v.providerModelId });
      }
    }
    const observationMap = await listCatalogModelObservationsForPairs(allPairs);

    const enriched = models.map((m) => {
      const variants = byModelId.get(m.id) ?? [];
      const hasPricingRef = variants.some((v) => v.pricingRef != null && v.pricingRef.trim() !== "");
      const hasRateLimitRef = variants.some((v) => v.rateLimitRef != null && v.rateLimitRef.trim() !== "");
      const availabilityStates = new Set(
        variants
          .map((v) => (v.availabilityStatus ?? "").trim().toLowerCase())
          .filter((v) => v.length > 0)
      );
      const hasAvailableVariant = availabilityStates.has("available");

      let allowlistAlignedVariantCount = 0;
      let crowdDeprecatedReports = 0;
      let crowdRetiredReports = 0;
      const processingRegions = new Set<string>();
      for (const v of variants) {
        const catalogProviderId = v.catalogProviderId ?? v.providerIntegrationType;
        if (isProviderModelInDefaultAllowlist(catalogProviderId, v.providerModelId, DEFAULT_ALLOWLIST)) {
          allowlistAlignedVariantCount += 1;
        }
        const region = (v.processingRegion ?? "").trim();
        if (region) processingRegions.add(region);
        const key = `${catalogProviderId}\t${v.providerModelId}`;
        const obs = observationMap.get(key);
        if (obs) {
          crowdDeprecatedReports += obs.deprecatedReportCount;
          crowdRetiredReports += obs.retiredReportCount;
        }
      }

      const homeJurisdiction = (m.homeJurisdiction ?? "").trim() || null;

      return {
        ...m,
        homeJurisdiction,
        processingRegions: [...processingRegions].sort((a, b) => a.localeCompare(b)),
        variantsSummary: {
          providerCount: new Set(variants.map((v) => v.catalogProviderId ?? v.providerIntegrationType)).size,
          providerIds: [...new Set(variants.map((v) => (v.catalogProviderId ?? v.providerIntegrationType).toLowerCase()))].sort(),
          variantCount: variants.length,
          allowlistAlignedVariantCount,
          hasAvailableVariant,
          hasPricingRef,
          hasRateLimitRef,
          availabilityStates: [...availabilityStates],
          crowdDeprecatedReports,
          crowdRetiredReports,
          hasCrowdSignals: crowdDeprecatedReports > 0 || crowdRetiredReports > 0,
        },
      };
    });

    const availableProviders = [...new Set(enriched.flatMap((m) => m.variantsSummary.providerIds))].sort();
    const availableJurisdictions = [
      ...new Set(enriched.map((m) => m.homeJurisdiction).filter((j): j is string => !!j)),
    ].sort((a, b) => a.localeCompare(b));
    const availableRegions = [
      ...new Set(enriched.flatMap((m) => m.processingRegions)),
    ].sort((a, b) => a.localeCompare(b));
    return {
      models: enriched,
      availableProviders,
      availableJurisdictions,
      availableRegions,
      error: null as string | null,
    };
  } catch (e) {
    console.error("[models] load failed:", e);
    return {
      models: [],
      availableProviders: [],
      availableJurisdictions: [],
      availableRegions: [],
      error: "Unable to load model catalog",
    };
  }
};
