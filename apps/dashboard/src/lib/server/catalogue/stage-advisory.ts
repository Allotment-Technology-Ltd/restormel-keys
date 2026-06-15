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
import {
  rankModelsForStage,
  annotateModel,
  evaluateRegion,
  compareAnnotated,
  type AnnotatedModel,
  type RankResult,
  type RegionFilter,
} from "./ranking";
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

/** Rank each provider's catalogue models for the stage (per-provider grouped result). */
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

// ── Flat, provider-neutral advisory (the consumable surface) ─────────────────
/**
 * A single ranked candidate carries its provider + whether that provider is connected. The
 * `connected` flag is PRESENTATION ONLY — it is never an input to the sort (provider equality).
 */
export interface FlatAdvisoryEntry extends AnnotatedModel {
  provider: string;
  connected: boolean;
}

export interface FlatStageAdvisory {
  ranked: FlatAdvisoryEntry[];
  hiddenByRegion: number;
  hiddenUnknownRegion: number;
}

export interface FlatStageAdvisoryRequest {
  stage: ConnectModelStage;
  /** ALL catalogue providers to rank — connected or not (so the rest of the catalogue is evaluable). */
  providers: string[];
  /** Which of `providers` the user has connected. Marks rows; NEVER reorders them. */
  connected: Set<string>;
  /** Underlying families bound upstream — validation that shares one is a cross-model caveat. */
  upstreamFamilies?: Set<string>;
  regionFilter?: RegionFilter;
  costResolver?: RateResolver;
}

/**
 * Rank EVERY catalogue model across ALL providers in ONE list, ordered purely by suitability → cost
 * (the existing provider-neutral comparator). The newest/connected provider is never hoisted: the
 * sort sees no provider or connection term. §3.2/§3.8
 */
export async function computeFlatStageAdvisory(
  repo: CatalogueRepository,
  req: FlatStageAdvisoryRequest,
): Promise<FlatStageAdvisory> {
  const entries: FlatAdvisoryEntry[] = [];
  let hiddenByRegion = 0;
  let hiddenUnknownRegion = 0;

  for (const provider of req.providers) {
    const models = await repo.listModelsForProvider(provider);
    for (const model of models) {
      const annotated = annotateModel(model, req.stage, {
        providerType: provider,
        upstreamFamilies: req.upstreamFamilies,
        regionFilter: req.regionFilter,
        costResolver: req.costResolver,
      });
      const region = evaluateRegion(model, annotated.variant, req.regionFilter);
      if (!region.pass) {
        hiddenByRegion += 1;
        if (region.unknown) hiddenUnknownRegion += 1;
        continue;
      }
      entries.push({ ...annotated, provider, connected: req.connected.has(provider) });
    }
  }

  // Provider-neutral sort: verdict → cost → name. No provider/connected term (equality invariant).
  entries.sort(compareAnnotated);
  return { ranked: entries, hiddenByRegion, hiddenUnknownRegion };
}
