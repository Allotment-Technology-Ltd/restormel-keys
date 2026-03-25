import type { PageServerLoad } from "./$types";
import { buildDefaultProviderModelAllowlist, isProviderModelInDefaultAllowlist } from "@restormel/keys";
import { getModel, listCatalogModelObservationsForPairs, listProviderModelVariants } from "$lib/server/db";

const DEFAULT_ALLOWLIST = buildDefaultProviderModelAllowlist();

export const load: PageServerLoad = async ({ params }) => {
  try {
    const model = await getModel(params.id);
    if (!model) return { model: null, variants: [], error: "Not found" as string | null };
    const variants = await listProviderModelVariants(params.id);
    const pairs = variants.map((v) => ({
      catalogProviderId: v.catalogProviderId ?? v.providerIntegrationType,
      providerModelId: v.providerModelId,
    }));
    const observationMap = await listCatalogModelObservationsForPairs(pairs);

    const enrichedVariants = variants.map((v) => {
      const catalogProviderId = v.catalogProviderId ?? v.providerIntegrationType;
      const inDefaultAllowlist = isProviderModelInDefaultAllowlist(
        catalogProviderId,
        v.providerModelId,
        DEFAULT_ALLOWLIST
      );
      const obs = observationMap.get(`${catalogProviderId}\t${v.providerModelId}`);
      return {
        ...v,
        catalogProviderId,
        inDefaultAllowlist,
        crowdObservation:
          obs && (obs.deprecatedReportCount > 0 || obs.retiredReportCount > 0)
            ? {
                deprecatedReportCount: obs.deprecatedReportCount,
                retiredReportCount: obs.retiredReportCount,
                firstReportedAt: obs.firstReportedAt,
                lastReportedAt: obs.lastReportedAt,
              }
            : null,
      };
    });

    return { model, variants: enrichedVariants, error: null };
  } catch (e) {
    console.error("[models/[id]] load failed:", e);
    return { model: null, variants: [], error: "Unable to load model" };
  }
};
