/**
 * Stage advisory orchestration (advisory plan §3.2/§3.4/§3.8).
 *
 * For each connected provider, list its catalogue models and rank them for a stage — derived
 * suitability + cost, provider-neutral, region-filtered. This is the consumable surface the binding
 * pickers call (replacing the curated INGEST_STAGE_MODEL_GUIDANCE steering). Free-text ids that
 * aren't in the catalogue resolve to an `unknown` verdict via the engine.
 */
import type { CatalogueRepository } from "./repository";
import type { ConnectModelStage } from "./types";
import { rankModelsForStage, type RankResult, type RegionFilter } from "./ranking";
import type { RateResolver } from "./cost";

export interface StageAdvisoryRequest {
  providerTypes: string[];
  stage: ConnectModelStage;
  /** Underlying families bound upstream — validation that shares one is a cross-model caveat. */
  upstreamFamilies?: Set<string>;
  regionFilter?: RegionFilter;
  costResolver?: RateResolver;
}

export interface ProviderStageAdvisory {
  provider: string;
  result: RankResult;
}

/** Rank each connected provider's catalogue models for the stage. */
export async function computeStageAdvisory(
  repo: CatalogueRepository,
  req: StageAdvisoryRequest,
): Promise<ProviderStageAdvisory[]> {
  const out: ProviderStageAdvisory[] = [];
  for (const provider of req.providerTypes) {
    const models = await repo.listModelsForProvider(provider);
    const result = rankModelsForStage(models, req.stage, {
      providerType: provider,
      upstreamFamilies: req.upstreamFamilies,
      regionFilter: req.regionFilter,
      costResolver: req.costResolver,
    });
    out.push({ provider, result });
  }
  return out;
}
