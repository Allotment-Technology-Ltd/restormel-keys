/**
 * Route builder model picker helpers — ensure ingestion routes surface 2026 catalog picks.
 */
import { CONNECT_STAGE_TO_INGESTION_ROUTE_STAGE, type ConnectModelStage } from "@restormel/contracts/connect";
import { ROUTE_STEP_PROVIDER_OPTIONS } from "$lib/route-step-providers";
import {
  INGEST_STAGE_MODEL_GUIDANCE,
  type IngestModelRecommendation,
} from "$lib/server/connect/model-guidance";
import type { ModelRecord, ProviderModelVariantRecord } from "$lib/server/neon";

const INGESTION_STAGE_TO_CONNECT: Record<string, ConnectModelStage> = Object.fromEntries(
  Object.entries(CONNECT_STAGE_TO_INGESTION_ROUTE_STAGE).map(([stage, routeStage]) => [routeStage, stage as ConnectModelStage]),
);

export function catalogSeedVersion(seed: { lastUpdated?: string | null }): string {
  return seed.lastUpdated?.trim() || "unknown";
}

export function recommendedModelIdsForIngestionStage(routeStage: string | null | undefined): string[] {
  const connectStage = routeStage ? INGESTION_STAGE_TO_CONNECT[routeStage] : undefined;
  if (!connectStage) {
    return INGEST_STAGE_MODEL_GUIDANCE.flatMap((g) => g.production.map((r) => r.modelId));
  }
  const guidance = INGEST_STAGE_MODEL_GUIDANCE.find((g) => g.stage === connectStage);
  return guidance ? guidance.production.map((r) => r.modelId) : [];
}

function variantServesProvider(
  v: Pick<ProviderModelVariantRecord, "providerIntegrationType" | "catalogProviderId" | "availabilityStatus">,
  pref: string,
): boolean {
  const status = (v.availabilityStatus ?? "").toLowerCase();
  if (status === "unavailable" || status === "retired") return false;
  const p = pref.trim().toLowerCase();
  const t = (v.providerIntegrationType ?? "").trim().toLowerCase();
  const c = (v.catalogProviderId ?? "").trim().toLowerCase();
  return t === p || (Boolean(c) && c === p);
}

export function buildModelIdsByProvider(
  modelRows: Pick<ModelRecord, "id" | "canonicalName">[],
  variantRows: ProviderModelVariantRecord[],
): Record<string, string[]> {
  const modelIdsByProvider: Record<string, string[]> = {};
  for (const k of ROUTE_STEP_PROVIDER_OPTIONS) modelIdsByProvider[k] = [];
  const nameById = new Map(modelRows.map((m) => [m.id, m.canonicalName]));
  for (const m of modelRows) {
    const mv = variantRows.filter((v) => v.modelId === m.id);
    for (const pref of ROUTE_STEP_PROVIDER_OPTIONS) {
      if (mv.some((v) => variantServesProvider(v, pref))) {
        modelIdsByProvider[pref].push(m.id);
      }
    }
  }
  for (const pref of ROUTE_STEP_PROVIDER_OPTIONS) {
    modelIdsByProvider[pref].sort((a, b) =>
      (nameById.get(a) ?? a).localeCompare(nameById.get(b) ?? b, undefined, { sensitivity: "base" }),
    );
  }
  return modelIdsByProvider;
}

function allIngestionRecommendations(): IngestModelRecommendation[] {
  const seen = new Set<string>();
  const out: IngestModelRecommendation[] = [];
  for (const g of INGEST_STAGE_MODEL_GUIDANCE) {
    for (const rec of g.production) {
      if (seen.has(rec.modelId)) continue;
      seen.add(rec.modelId);
      out.push(rec);
    }
  }
  return out;
}

/** Ensure production ingest picks appear in the picker even if variant join missed them. */
export function enrichIngestionRouteBuilderCatalog(args: {
  modelIdsByProvider: Record<string, string[]>;
  modelCatalog: { id: string; name: string }[];
  modelRows: Pick<ModelRecord, "id" | "canonicalName">[];
  variantRows: ProviderModelVariantRecord[];
}): void {
  for (const rec of allIngestionRecommendations()) {
    const provider = rec.provider;
    if (!(provider in args.modelIdsByProvider)) continue;
    const hasVariant = args.variantRows.some(
      (v) => v.modelId === rec.modelId && variantServesProvider(v, provider),
    );
    if (!hasVariant) continue;
    if (!args.modelIdsByProvider[provider].includes(rec.modelId)) {
      args.modelIdsByProvider[provider].push(rec.modelId);
    }
    if (!args.modelCatalog.some((m) => m.id === rec.modelId)) {
      const row = args.modelRows.find((m) => m.id === rec.modelId);
      args.modelCatalog.push({ id: rec.modelId, name: row?.canonicalName ?? rec.modelId });
    }
  }
  const nameById = new Map(args.modelCatalog.map((m) => [m.id, m.name]));
  for (const pref of ROUTE_STEP_PROVIDER_OPTIONS) {
    args.modelIdsByProvider[pref].sort((a, b) =>
      (nameById.get(a) ?? a).localeCompare(nameById.get(b) ?? b, undefined, { sensitivity: "base" }),
    );
  }
}
