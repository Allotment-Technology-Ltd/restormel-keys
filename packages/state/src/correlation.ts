import type {
  ContextPackRetrievalInput,
  ContextPackRestormelCorrelation,
} from "@restormel/context-packs";

/**
 * Correlate a context-pack build with a state timeline and an observability run.
 * Same shape as {@link ContextPackRestormelCorrelation} on {@link ContextPackRetrievalInput}.
 */
export type StateContextPackCorrelation = ContextPackRestormelCorrelation;

/**
 * Attach correlation metadata for debugging (bad answer → memory + trace).
 */
export function attachCorrelationToRetrievalInput(
  input: ContextPackRetrievalInput,
  correlation: StateContextPackCorrelation
): ContextPackRetrievalInput {
  return {
    ...input,
    restormel_correlation: {
      ...input.restormel_correlation,
      ...correlation,
    },
  };
}

/** Narrow helper for logs / traces alongside `@restormel/observability` RunTrace.runId. */
export interface StateObservabilityCorrelation {
  run_id: string;
  state_tail_event_id?: string;
  /** Optional scope → active cell count after projection. */
  memory_scope_cell_counts?: Record<string, number>;
}

export function observabilityCorrelationFromView(
  runId: string,
  view: { applied_event_ids: string[]; scopes: Record<string, unknown[]> }
): StateObservabilityCorrelation {
  const tail = view.applied_event_ids[view.applied_event_ids.length - 1];
  const memory_scope_cell_counts: Record<string, number> = {};
  for (const [k, v] of Object.entries(view.scopes)) {
    memory_scope_cell_counts[k] = v.length;
  }
  return {
    run_id: runId,
    state_tail_event_id: tail,
    memory_scope_cell_counts,
  };
}
