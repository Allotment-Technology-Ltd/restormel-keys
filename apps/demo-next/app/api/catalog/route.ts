import {
  fetchCanonicalCatalogWithFallback,
  type CanonicalCatalogResponse,
} from "@restormel/keys/dashboard";
import { buildFallbackCatalog } from "@/app/lib/catalog";

type CatalogRouteBody = {
  source: "restormel" | "fallback";
  degradedReason?: string;
  catalog: CanonicalCatalogResponse;
};

export async function GET() {
  const baseUrl = process.env.RESTORMEL_KEYS_BASE?.trim() || undefined;
  const result = await fetchCanonicalCatalogWithFallback({
    baseUrl,
    fallback: () => buildFallbackCatalog(),
  });

  const body: CatalogRouteBody = {
    source: result.source,
    degradedReason: result.degradedReason,
    catalog: result.catalog,
  };

  return Response.json(body, {
    status: 200,
    headers: result.source === "restormel"
      ? { "cache-control": "public, s-maxage=300, stale-while-revalidate=600" }
      : { "cache-control": "no-store" },
  });
}
