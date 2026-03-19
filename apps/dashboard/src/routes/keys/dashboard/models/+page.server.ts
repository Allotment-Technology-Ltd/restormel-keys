import type { PageServerLoad } from "./$types";
import { listModels, listProviderModelVariants } from "$lib/server/db";

export const load: PageServerLoad = async ({ url }) => {
  const lifecycleState = url.searchParams.get("lifecycleState")?.trim() || undefined;
  const family = url.searchParams.get("family")?.trim() || undefined;
  const limit = Math.min(500, Math.max(1, parseInt(url.searchParams.get("limit") ?? "100", 10) || 100));
  const offset = Math.max(0, parseInt(url.searchParams.get("offset") ?? "0", 10) || 0);
  try {
    const models = await listModels({ lifecycleState, family, limit, offset });
    const variantRows = await Promise.all(models.map((m) => listProviderModelVariants(m.id)));
    const byModelId = new Map(models.map((m, idx) => [m.id, variantRows[idx]]));

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

      return {
        ...m,
        variantsSummary: {
          providerCount: new Set(variants.map((v) => v.providerIntegrationType)).size,
          hasAvailableVariant,
          hasPricingRef,
          hasRateLimitRef,
          availabilityStates: [...availabilityStates],
        },
      };
    });

    return { models: enriched, error: null as string | null };
  } catch (e) {
    console.error("[models] load failed:", e);
    return { models: [], error: "Unable to load model catalog" };
  }
};
