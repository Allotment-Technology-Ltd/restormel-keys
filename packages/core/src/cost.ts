/**
 * Cost estimation across providers and tracking of actual usage.
 */
import type { ProviderDefinition } from "./providers/types.js";
import type { UsageRecord } from "./types.js";

export interface CostEstimateResult {
  modelId: string;
  providerId?: string;
  inputPerMillion?: number;
  outputPerMillion?: number;
  unit?: string;
}

/** Optional store for tracking usage (e.g. for billing). */
export interface UsageTracker {
  track(userId: string, keyId: string, modelId: string, usage: UsageRecord): void | Promise<void>;
}

const defaultTracker: UsageTracker = {
  track() {},
};

/**
 * Look up cost estimate for a model across providers. Returns first match.
 */
export function estimateCost(
  modelId: string,
  providers: ProviderDefinition[]
): CostEstimateResult | null {
  for (const p of providers) {
    const est = p.estimateCost(modelId);
    if (est) {
      return {
        modelId: est.id,
        providerId: p.id,
        inputPerMillion: est.inputPerMillion,
        outputPerMillion: est.outputPerMillion,
        unit: est.unit,
      };
    }
  }
  return null;
}

/**
 * Record actual usage for cost tracking. Idempotent if tracker supports it.
 */
export function trackCost(
  userId: string,
  keyId: string,
  modelId: string,
  usage: UsageRecord,
  tracker: UsageTracker = defaultTracker
): void | Promise<void> {
  return tracker.track(userId, keyId, modelId, usage);
}
