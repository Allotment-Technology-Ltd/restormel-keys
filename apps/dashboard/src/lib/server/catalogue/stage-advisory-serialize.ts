/**
 * Serialize stage advisory to a stable JSON shape for the binding pickers (advisory plan §3.4/§3.7).
 * Pure + offline-testable; the +server.ts endpoint is thin glue over this.
 */
import type { ProviderStageAdvisory } from "./stage-advisory";
import type { AnnotatedModel } from "./ranking";
import type { SuitabilityVerdict } from "./types";
import { formatCostPerMillion, formatRunCost } from "./cost";

export interface SerializedAdvisoryModel {
  id: string;
  name: string;
  verdict: SuitabilityVerdict;
  rationale: string;
  /** wrong_type only — the picker must disable the option. */
  blocked: boolean;
  homeJurisdiction: string | null;
  processingRegion: string | null;
  providerModelId: string | null;
  lifecycleState: string | null;
  /** Formatted; "cost unknown" when unpriced (never "$0"). */
  costPerMillion: string;
  runCost: string;
}

export interface SerializedProviderAdvisory {
  provider: string;
  hiddenByRegion: number;
  hiddenUnknownRegion: number;
  models: SerializedAdvisoryModel[];
}

function serializeModel(a: AnnotatedModel): SerializedAdvisoryModel {
  return {
    id: a.model.id,
    name: a.model.canonicalName,
    verdict: a.suitability.verdict,
    rationale: a.suitability.rationale,
    blocked: a.suitability.blocked,
    homeJurisdiction: a.model.homeJurisdiction ?? null,
    processingRegion: a.variant?.processingRegion ?? null,
    providerModelId: a.variant?.providerModelId ?? null,
    lifecycleState: (a.model.lifecycleState as string | null) ?? null,
    costPerMillion: formatCostPerMillion(a.cost),
    runCost: formatRunCost(a.runCost),
  };
}

export function serializeStageAdvisory(
  advisories: ProviderStageAdvisory[],
): SerializedProviderAdvisory[] {
  return advisories.map((adv) => ({
    provider: adv.provider,
    hiddenByRegion: adv.result.hiddenByRegion,
    hiddenUnknownRegion: adv.result.hiddenUnknownRegion,
    models: adv.result.ranked.map(serializeModel),
  }));
}
