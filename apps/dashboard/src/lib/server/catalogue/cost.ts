/**
 * Catalogue cost resolution (advisory plan §3.3).
 *
 * Resolves $/1M input+output for a model via Keys pricing, and a projected $/run at the picker
 * using representative per-stage token footprints. CRITICAL: an unpriced model resolves to
 * `known:false` ("cost unknown") — NEVER $0 (the $0 failure mode in connect-core's
 * llm-token-usd-rates must not reach the UI).
 */
import { estimateCost, defaultProviders } from "@restormel/keys";
import type { ConnectModelStage } from "./types";

export interface CostPerMillion {
  inputPerMillion: number;
  outputPerMillion: number;
}

export type CostResolution =
  | { known: true; perMillion: CostPerMillion; source: string }
  | { known: false; reason: "no_pricing" };

/** Pluggable so tests stay independent of Keys' live pricing data. */
export type RateResolver = (modelRef: string) => CostPerMillion | null;

export const defaultKeysRateResolver: RateResolver = (modelRef) => {
  const trimmed = modelRef.trim();
  const stripped = trimmed.includes("/") ? trimmed.slice(trimmed.indexOf("/") + 1) : trimmed;
  const r =
    (estimateCost(stripped, defaultProviders) as
      | { inputPerMillion?: number; outputPerMillion?: number }
      | null
      | undefined) ??
    (estimateCost(trimmed, defaultProviders) as
      | { inputPerMillion?: number; outputPerMillion?: number }
      | null
      | undefined);
  if (!r) return null;
  const inputPerMillion = r.inputPerMillion ?? 0;
  const outputPerMillion = r.outputPerMillion ?? 0;
  if (inputPerMillion <= 0 && outputPerMillion <= 0) return null;
  return { inputPerMillion, outputPerMillion };
};

/** Resolve $/1M. Returns `known:false` (never $0) when pricing is absent. */
export function resolveCostPerMillion(
  modelRef: string,
  resolver: RateResolver = defaultKeysRateResolver,
): CostResolution {
  const rates = resolver(modelRef);
  if (rates && (rates.inputPerMillion > 0 || rates.outputPerMillion > 0)) {
    return { known: true, perMillion: rates, source: "keys" };
  }
  return { known: false, reason: "no_pricing" };
}

/**
 * Representative per-stage token footprint for a projected $/run at the picker. These are
 * deliberate estimates (a "typical" production source ≈ 12k input tokens / ~60 claims); the
 * real per-run cost depends on source size. Embedding output is 0 (vectors are char-billed
 * separately and tracked on the embedding route).
 */
export const STAGE_TOKEN_ESTIMATE: Record<ConnectModelStage, { input: number; output: number }> = {
  extraction: { input: 13_000, output: 4_000 },
  grouping: { input: 5_000, output: 1_500 },
  validation: { input: 8_000, output: 3_000 },
  remediation: { input: 4_000, output: 1_500 },
  embedding: { input: 12_000, output: 0 },
};

export type RunCostEstimate =
  | { known: true; usd: number; perMillion: CostPerMillion }
  | { known: false };

export function projectedRunCostUsd(
  modelRef: string,
  stage: ConnectModelStage,
  resolver: RateResolver = defaultKeysRateResolver,
): RunCostEstimate {
  const res = resolveCostPerMillion(modelRef, resolver);
  if (!res.known) return { known: false };
  const t = STAGE_TOKEN_ESTIMATE[stage];
  const usd =
    (res.perMillion.inputPerMillion * t.input + res.perMillion.outputPerMillion * t.output) /
    1_000_000;
  return { known: true, usd, perMillion: res.perMillion };
}

/** UI-ready $/1M label; never renders "$0.00" for an unpriced model. */
export function formatCostPerMillion(res: CostResolution): string {
  if (!res.known) return "cost unknown";
  return `$${res.perMillion.inputPerMillion.toFixed(2)} in / $${res.perMillion.outputPerMillion.toFixed(2)} out · 1M`;
}

/** UI-ready $/run label; never "$0.0000" for an unpriced model. */
export function formatRunCost(est: RunCostEstimate): string {
  if (!est.known) return "cost unknown";
  return `~$${est.usd.toFixed(4)}/run`;
}
