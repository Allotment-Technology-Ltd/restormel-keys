/**
 * Route flow map segments: linear steps vs parallel groups (shared parallelGroupId).
 * Used by RouteFlowCanvas and route editor reorder (move up/down).
 */
export type RouteFlowSegmentStep = {
  id: string;
  orderIndex: number;
  parallelGroupId?: string | null;
};

export type RouteFlowSegment<T extends RouteFlowSegmentStep = RouteFlowSegmentStep> =
  | { type: "linear"; steps: [T] }
  | { type: "parallel"; groupId: string; steps: T[] };

export function buildRouteFlowSegments<T extends RouteFlowSegmentStep>(ordered: T[]): RouteFlowSegment<T>[] {
  const seen = new Set<string>();
  const out: RouteFlowSegment<T>[] = [];
  for (const s of ordered) {
    if (seen.has(s.id)) continue;
    const gid = s.parallelGroupId?.trim() ?? "";
    if (!gid) {
      out.push({ type: "linear", steps: [s] });
      seen.add(s.id);
      continue;
    }
    const groupSteps = ordered
      .filter((t) => (t.parallelGroupId?.trim() ?? "") === gid)
      .sort((a, b) => a.orderIndex - b.orderIndex);
    groupSteps.forEach((t) => seen.add(t.id));
    if (groupSteps.length === 1) {
      out.push({ type: "linear", steps: [groupSteps[0]] });
    } else {
      out.push({ type: "parallel", groupId: gid, steps: groupSteps });
    }
  }
  return out;
}

/** Step ids in chain order (segment order, then branch order within parallel). */
export function routeFlowSegmentListToStepIds<T extends RouteFlowSegmentStep>(segments: RouteFlowSegment<T>[]): string[] {
  const out: string[] = [];
  for (const seg of segments) {
    const ordered = [...seg.steps].sort((a, b) => a.orderIndex - b.orderIndex);
    for (const s of ordered) out.push(s.id);
  }
  return out;
}
