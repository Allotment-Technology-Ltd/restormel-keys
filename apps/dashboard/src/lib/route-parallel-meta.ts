/**
 * Pure helpers for Phase F parallel metadata (no server imports — safe for client + server).
 */
export type StepLike = {
  enabled: boolean;
  parallelGroupId?: string | null;
};

/** True when two or more enabled steps share the same non-empty parallelGroupId (fan-out shape). */
export function routeRequiresParallelFanout(steps: StepLike[]): boolean {
  const groups = new Map<string, number>();
  for (const s of steps) {
    if (!s.enabled) continue;
    const g = s.parallelGroupId?.trim();
    if (!g) continue;
    groups.set(g, (groups.get(g) ?? 0) + 1);
  }
  for (const n of groups.values()) {
    if (n > 1) return true;
  }
  return false;
}
