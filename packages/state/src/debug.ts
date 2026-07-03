import type { WorkingMemoryView } from "./types.js";

/** JSON-friendly snapshot for admin / support tools (no PII enrichment). */
export function workingMemoryToDebugJson(view: WorkingMemoryView): {
  last_sequence: number;
  applied_event_count: number;
  scope_ids: string[];
  scope_cell_counts: Record<string, number>;
  tail_event_ids: string[];
  scopes: WorkingMemoryView["scopes"];
} {
  const scope_ids = Object.keys(view.scopes).sort();
  const scope_cell_counts: Record<string, number> = {};
  for (const s of scope_ids) {
    scope_cell_counts[s] = view.scopes[s]?.length ?? 0;
  }
  return {
    last_sequence: view.last_sequence,
    applied_event_count: view.applied_event_ids.length,
    scope_ids,
    scope_cell_counts,
    tail_event_ids: view.applied_event_ids.slice(-12),
    scopes: view.scopes,
  };
}
