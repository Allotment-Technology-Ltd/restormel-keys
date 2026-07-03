"use client";

import { useRef, useEffect } from "react";
import type { CostEstimateResult } from "@restormel/keys";
import "@restormel/keys-elements";
import type { RkCostEstimatorElement } from "./elements";

export interface CostEstimatorProps {
  cost: CostEstimateResult | null;
  budget?: number;
  estimatedCost?: number;
  onCostUpdated?: (detail: {
    cost: CostEstimateResult | null;
    budget?: number;
    estimatedCost?: number;
  }) => void;
}

export function CostEstimator({
  cost,
  budget,
  estimatedCost,
  onCostUpdated,
}: CostEstimatorProps): React.ReactElement {
  const ref = useRef<RkCostEstimatorElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.cost = cost;
    el.budget = budget;
    el.estimatedCost = estimatedCost;
  }, [cost, budget, estimatedCost]);

  useEffect(() => {
    const el = ref.current;
    if (!el || !onCostUpdated) return;
    const handler = (e: Event) => {
      const ev = e as CustomEvent<{ cost: CostEstimateResult | null; budget?: number; estimatedCost?: number }>;
      onCostUpdated(ev.detail);
    };
    el.addEventListener("rk-cost-updated", handler);
    return () => el.removeEventListener("rk-cost-updated", handler);
  }, [onCostUpdated]);

  return (
    <rk-cost-estimator
      ref={ref}
      budget={budget}
      estimated-cost={estimatedCost}
    />
  );
}
