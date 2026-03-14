"use client";

import { useMemo } from "react";
import type { KeysInstance } from "@restormel/keys";
import type { CostEstimateResult } from "@restormel/keys";

export interface UseCostResult {
  cost: CostEstimateResult | null;
}

/**
 * Returns cost estimate for a model and recalculates when keys or modelId change.
 */
export function useCost(
  keys: KeysInstance | null,
  modelId: string | null
): UseCostResult {
  const cost = useMemo(() => {
    if (!keys || !modelId) return null;
    return keys.estimateCost(modelId) ?? null;
  }, [keys, modelId]);

  return { cost };
}
