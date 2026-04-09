/**
 * Restormel State — portable types for agent memory timelines.
 *
 * Non-goals (by design):
 * - Vector search / RAG storage
 * - Workflow orchestration or LangGraph-style checkpoint execution
 * - Persisted backend (hosts store event streams; this package is pure projection)
 */

/** Logical partition for memory cells (e.g. `session`, `user_preferences`, `open_hypotheses`). */
export type MemoryScope = string;

/**
 * Caps applied after folding the event stream. Unpinned cells are evicted oldest-first
 * by last-upsert ordinal; if still over budget, oldest pinned cells are evicted.
 */
export interface MemoryPolicy {
  maxCellsPerScope: number;
  maxApproxTokensPerScope: number;
}

/** Optional links to reasoning-graph artefacts (opaque to reducers beyond carry-through). */
export interface MemoryCellRefs {
  claim_ids?: string[];
  graph_snapshot_id?: string;
}

/** One materialized fact / note in working memory. */
export interface MemoryCell {
  id: string;
  scope: MemoryScope;
  /** Redacted text only — never store raw secrets in cells (host responsibility). */
  text: string;
  approx_tokens: number;
  pinned: boolean;
  source_event_id: string;
  refs?: MemoryCellRefs;
}

/** Deterministic output of {@link projectWorkingMemory}. */
export interface WorkingMemoryView {
  scopes: Record<MemoryScope, MemoryCell[]>;
  /** Monotonic count of applied events (order after sort). */
  last_sequence: number;
  /** State event ids applied in order (after stable sort). */
  applied_event_ids: string[];
}

export type StateEvent =
  | MemoryCellUpsertEvent
  | MemoryCellRemoveEvent
  | MemoryCellPinEvent
  | MemoryCellUnpinEvent
  | MemorySummarizeCompactEvent
  | ScopeClearEvent;

export interface MemoryCellUpsertEvent {
  type: "memory_cell_upsert";
  id: string;
  /** ISO-8601 timestamp for ordering tie-breaks with {@link MemoryCellUpsertEvent#id}. */
  ts: string;
  scope: MemoryScope;
  cell_id: string;
  text: string;
  pinned?: boolean;
  refs?: MemoryCellRefs;
  /** Correlate with `@restormel/observability` / host run identifiers. */
  run_id?: string;
}

export interface MemoryCellRemoveEvent {
  type: "memory_cell_remove";
  id: string;
  ts: string;
  scope: MemoryScope;
  cell_id: string;
  run_id?: string;
}

export interface MemoryCellPinEvent {
  type: "memory_cell_pin";
  id: string;
  ts: string;
  scope: MemoryScope;
  cell_id: string;
  run_id?: string;
}

export interface MemoryCellUnpinEvent {
  type: "memory_cell_unpin";
  id: string;
  ts: string;
  scope: MemoryScope;
  cell_id: string;
  run_id?: string;
}

/** Replace many cells with one summary cell (e.g. Stoa history compression). */
export interface MemorySummarizeCompactEvent {
  type: "memory_summarize_compact";
  id: string;
  ts: string;
  scope: MemoryScope;
  remove_cell_ids: string[];
  summary_cell_id: string;
  summary_text: string;
  pinned?: boolean;
  run_id?: string;
}

export interface ScopeClearEvent {
  type: "scope_clear";
  id: string;
  ts: string;
  scope: MemoryScope;
  run_id?: string;
}

/** ~4 chars per token heuristic (aligned with `@restormel/context-packs`). */
export function estimateApproxTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
