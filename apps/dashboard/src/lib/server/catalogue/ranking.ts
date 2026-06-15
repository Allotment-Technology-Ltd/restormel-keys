/**
 * Provider-neutral ranking + region/jurisdiction filtering (advisory plan §3.8).
 *
 * Ranks candidate models for a stage by (suitability verdict, cost, neutral name tiebreak) — and
 * NEVER by provider identity. This is the enforcement point for the provider-equality principle:
 * no provider is ever ordered above another by who it is. Region filtering composes on top and
 * fails honestly (an emptied stage is surfaced, never silently back-filled with an excluded provider).
 */
import type { CatalogueModel, CatalogueVariant, ConnectModelStage, StageSuitability } from "./types";
import { deriveSuitability, VERDICT_RANK } from "./suitability";
import {
  resolveCostPerMillion,
  projectedRunCostUsd,
  defaultKeysRateResolver,
  type RateResolver,
  type CostResolution,
  type RunCostEstimate,
} from "./cost";

export interface AnnotatedModel {
  model: CatalogueModel;
  /** The variant for the ranking provider (carries processingRegion + upstream id), if any. */
  variant: CatalogueVariant | null;
  suitability: StageSuitability;
  cost: CostResolution;
  runCost: RunCostEstimate;
}

export interface RegionFilter {
  /** Allow-list of home jurisdictions (e.g. ["EU/FR"]). Empty/undefined = no constraint. */
  homeJurisdictions?: string[];
  /** Allow-list of processing regions (e.g. ["EU"]). */
  processingRegions?: string[];
  /** Exclude these home jurisdictions (e.g. ["US", "CN"]). */
  excludeHomeJurisdictions?: string[];
  /** Exclude these processing regions. */
  excludeProcessingRegions?: string[];
  /** Keep models whose region is UNKNOWN (null). Default: a positive allow-list drops them. */
  keepUnknownRegion?: boolean;
}

export interface RankContext {
  providerType: string;
  upstreamFamilies?: Set<string>;
  regionFilter?: RegionFilter;
  costResolver?: RateResolver;
}

function variantFor(model: CatalogueModel, providerType: string): CatalogueVariant | null {
  const p = providerType.trim().toLowerCase();
  return (model.variants ?? []).find((v) => v.providerIntegrationType.trim().toLowerCase() === p) ?? null;
}

function nonEmpty(arr?: string[]): boolean {
  return Array.isArray(arr) && arr.length > 0;
}

/**
 * Hierarchy/prefix-aware home-jurisdiction match. Jurisdictions are stored as `/`-separated
 * hierarchies (e.g. `EU/FR`). A filter token matches a stored value if it equals it OR is a
 * leading path segment of it — so token `EU` matches stored `EU/FR`, but token `US` does not.
 * Matching is segment-wise (token `EU` does not match a hypothetical `EUR`).
 */
function homeJurisdictionMatches(filterTokens: string[], stored: string): boolean {
  const storedSegments = stored.split("/");
  for (const token of filterTokens) {
    const tokenSegments = token.split("/");
    if (tokenSegments.length > storedSegments.length) continue;
    let ok = true;
    for (let i = 0; i < tokenSegments.length; i++) {
      if (tokenSegments[i] !== storedSegments[i]) {
        ok = false;
        break;
      }
    }
    if (ok) return true;
  }
  return false;
}

export interface RegionDecision {
  pass: boolean;
  /** True when a constraint applied but the model's region value was null (unknown). */
  unknown: boolean;
}

/** Evaluate a model+variant against a region filter. */
export function evaluateRegion(
  model: CatalogueModel,
  variant: CatalogueVariant | null,
  filter: RegionFilter | undefined,
): RegionDecision {
  if (!filter) return { pass: true, unknown: false };
  const home = model.homeJurisdiction ?? null;
  const region = variant?.processingRegion ?? null;
  let unknown = false;

  // Exclusions first (a known excluded value always fails). Exclude beats allow, so the
  // hierarchy-aware match must apply here too (excluding `EU` drops an `EU/FR` model).
  if (nonEmpty(filter.excludeHomeJurisdictions) && home && homeJurisdictionMatches(filter.excludeHomeJurisdictions!, home)) {
    return { pass: false, unknown: false };
  }
  if (nonEmpty(filter.excludeProcessingRegions) && region && filter.excludeProcessingRegions!.includes(region)) {
    return { pass: false, unknown: false };
  }

  // Positive allow-lists. Home jurisdiction is hierarchy/prefix-aware: filter `EU` admits `EU/FR`.
  if (nonEmpty(filter.homeJurisdictions)) {
    if (home === null) unknown = true;
    else if (!homeJurisdictionMatches(filter.homeJurisdictions!, home)) return { pass: false, unknown: false };
  }
  if (nonEmpty(filter.processingRegions)) {
    if (region === null) unknown = true;
    else if (!filter.processingRegions!.includes(region)) return { pass: false, unknown: false };
  }

  if (unknown && !filter.keepUnknownRegion) return { pass: false, unknown: true };
  return { pass: true, unknown };
}

export function annotateModel(
  model: CatalogueModel,
  stage: ConnectModelStage,
  ctx: RankContext,
): AnnotatedModel {
  const variant = variantFor(model, ctx.providerType);
  const modelRef = variant?.providerModelId ?? model.id;
  const resolver = ctx.costResolver ?? defaultKeysRateResolver;
  const suitability = deriveSuitability(model, stage, {
    upstreamFamilies: ctx.upstreamFamilies,
    provider: ctx.providerType,
    providerModelId: variant?.providerModelId ?? null,
  });
  return {
    model,
    variant,
    suitability,
    cost: resolveCostPerMillion(modelRef, resolver),
    runCost: projectedRunCostUsd(modelRef, stage, resolver),
  };
}

/** Neutral comparator: verdict → cost (known before unknown, cheaper first) → canonical name. No provider. */
export function compareAnnotated(a: AnnotatedModel, b: AnnotatedModel): number {
  const v = VERDICT_RANK[a.suitability.verdict] - VERDICT_RANK[b.suitability.verdict];
  if (v !== 0) return v;
  if (a.runCost.known !== b.runCost.known) return a.runCost.known ? -1 : 1;
  if (a.runCost.known && b.runCost.known) {
    const d = a.runCost.usd - b.runCost.usd;
    if (Math.abs(d) > 1e-9) return d < 0 ? -1 : 1;
  }
  return a.model.canonicalName.localeCompare(b.model.canonicalName);
}

export interface RankResult {
  ranked: AnnotatedModel[];
  /** Models dropped by the region filter (so the UI can say "N hidden by region"). */
  hiddenByRegion: number;
  /** Of the hidden, how many were dropped specifically for unknown region. */
  hiddenUnknownRegion: number;
}

/** Filter by region, annotate, and rank neutrally. */
export function rankModelsForStage(
  models: CatalogueModel[],
  stage: ConnectModelStage,
  ctx: RankContext,
): RankResult {
  const kept: AnnotatedModel[] = [];
  let hiddenByRegion = 0;
  let hiddenUnknownRegion = 0;

  for (const model of models) {
    const variant = variantFor(model, ctx.providerType);
    const region = evaluateRegion(model, variant, ctx.regionFilter);
    if (!region.pass) {
      hiddenByRegion += 1;
      if (region.unknown) hiddenUnknownRegion += 1;
      continue;
    }
    kept.push(annotateModel(model, stage, ctx));
  }

  kept.sort(compareAnnotated);
  return { ranked: kept, hiddenByRegion, hiddenUnknownRegion };
}
