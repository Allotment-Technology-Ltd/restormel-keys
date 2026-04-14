import type { RouteStepRecord } from "$lib/server/db";

/**
 * Consecutive steps sharing the same non-empty `parallelGroupId` form one parallel batch.
 * Members run concurrently (fan-out peers), not as an ordered fallback list inside the batch.
 * Whether that batch is “primary” or “fallback” for the route is determined by its position among batches
 * in the resolved step chain (same idea as linear segments), not by branch order inside the group.
 * Single-step batches are the common linear case.
 */
export function partitionIntoBatches(steps: RouteStepRecord[]): RouteStepRecord[][] {
  const out: RouteStepRecord[][] = [];
  let i = 0;
  while (i < steps.length) {
    const g = steps[i].parallelGroupId?.trim();
    if (g && i + 1 < steps.length && steps[i + 1].parallelGroupId?.trim() === g) {
      const batch: RouteStepRecord[] = [];
      while (i < steps.length && steps[i].parallelGroupId?.trim() === g) {
        batch.push(steps[i]);
        i++;
      }
      out.push(batch);
    } else {
      out.push([steps[i]]);
      i++;
    }
  }
  return out;
}
