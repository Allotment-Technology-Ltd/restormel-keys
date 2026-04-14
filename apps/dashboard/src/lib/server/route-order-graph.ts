/**
 * Deterministic resolve order from optional control-plane graph (Option B).
 * When there are no edges, callers should use linear orderIndex order.
 */
import type { RouteStepRecord } from "$lib/server/db";

export type RouteStepEdgeInput = { fromStepId: string; toStepId: string; priority: number };

/** DFS pre-order from entry; append unreachable enabled steps by orderIndex. */
export function computeEnabledStepOrderForGraph(
  steps: RouteStepRecord[],
  edges: RouteStepEdgeInput[],
  entryStepId: string | null
): RouteStepRecord[] {
  const enabled = steps.filter((s) => s.enabled).sort((a, b) => a.orderIndex - b.orderIndex);
  if (enabled.length === 0) return [];

  const idSet = new Set(enabled.map((s) => s.id));
  const filtered = edges.filter((e) => idSet.has(e.fromStepId) && idSet.has(e.toStepId));
  if (filtered.length === 0) return enabled;

  const adj = new Map<string, Array<{ to: string; pri: number }>>();
  const indeg = new Map<string, number>();
  for (const s of enabled) {
    indeg.set(s.id, 0);
    adj.set(s.id, []);
  }
  for (const e of filtered) {
    adj.get(e.fromStepId)!.push({ to: e.toStepId, pri: e.priority });
    indeg.set(e.toStepId, (indeg.get(e.toStepId) ?? 0) + 1);
  }
  for (const [, arr] of adj) {
    arr.sort((a, b) => a.pri - b.pri || a.to.localeCompare(b.to));
  }

  let start =
    entryStepId && idSet.has(entryStepId)
      ? entryStepId
      : enabled.find((s) => (indeg.get(s.id) ?? 0) === 0)?.id ?? enabled[0].id;

  const visited = new Set<string>();
  const orderIds: string[] = [];

  function dfs(u: string) {
    if (visited.has(u)) return;
    visited.add(u);
    orderIds.push(u);
    for (const { to } of adj.get(u) ?? []) dfs(to);
  }
  dfs(start);

  for (const s of enabled) {
    if (!visited.has(s.id)) orderIds.push(s.id);
  }

  const byId = new Map(steps.map((s) => [s.id, s]));
  return orderIds.map((id) => byId.get(id)!).filter(Boolean);
}
