import { buildRouteFlowSegments } from "$lib/route-flow-segments";

/** Minimal step fields for primary-chain enable/disable checks (matches canvas “primary” = first segment). */
export type StepForPrimaryEnableGuard = {
  id: string;
  orderIndex: number;
  enabled: boolean;
  parallelGroupId?: string | null;
};

/**
 * When disabling (`nextEnabled` false), blocks if that would leave the first flow segment with **no**
 * enabled steps — while that segment previously had at least one enabled. Matches “don’t turn off every
 * model in the primary segment”; reorder/add another enabled model there first.
 */
export function getPrimaryChainEnableBlockMessage(args: {
  steps: StepForPrimaryEnableGuard[];
  stepId: string;
  nextEnabled: boolean;
}): string | null {
  const { steps, stepId, nextEnabled } = args;
  if (nextEnabled) return null;

  const orderedBefore = [...steps].sort((a, b) => a.orderIndex - b.orderIndex);
  const segmentsBefore = buildRouteFlowSegments(orderedBefore);
  const firstBefore = segmentsBefore[0];
  const hadEnabledInFirst = firstBefore?.steps.some((s) => s.enabled) ?? false;
  if (!hadEnabledInFirst) return null;

  const hypothetical = steps.map((s) => (s.id === stepId ? { ...s, enabled: false } : s));
  const segmentsAfter = buildRouteFlowSegments([...hypothetical].sort((a, b) => a.orderIndex - b.orderIndex));
  const firstAfter = segmentsAfter[0];
  const hasEnabledInFirstAfter = firstAfter?.steps.some((s) => s.enabled) ?? false;
  if (hasEnabledInFirstAfter) return null;

  if (firstAfter?.type === "linear") {
    return "The primary position in this route must keep at least one enabled model. Enable another model there, add one ahead of it, or move an enabled model before it, then try again.";
  }
  return "This primary parallel group must keep at least one enabled model. Enable another branch in the group, add a model ahead of it in the chain, or move an enabled model before it, then try again.";
}
