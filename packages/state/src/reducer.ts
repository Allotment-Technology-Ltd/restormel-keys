import {
  estimateApproxTokens,
  type MemoryCell,
  type MemoryPolicy,
  type MemoryScope,
  type StateEvent,
  type WorkingMemoryView,
} from "./types.js";

interface InternalCell extends MemoryCell {
  /** Last upsert / summarize event index (for LRU among unpinned). */
  ordinal: number;
}

function compareEvents(a: StateEvent, b: StateEvent): number {
  const t = a.ts.localeCompare(b.ts);
  if (t !== 0) return t;
  return a.id.localeCompare(b.id);
}

function getScopeMap(
  scopes: Map<MemoryScope, Map<string, InternalCell>>,
  scope: MemoryScope
): Map<string, InternalCell> {
  let m = scopes.get(scope);
  if (!m) {
    m = new Map();
    scopes.set(scope, m);
  }
  return m;
}

function pruneScope(cells: InternalCell[], policy: MemoryPolicy): MemoryCell[] {
  const maxC = policy.maxCellsPerScope;
  const maxT = policy.maxApproxTokensPerScope;
  let working = [...cells];

  const totalTokens = () => working.reduce((s, c) => s + c.approx_tokens, 0);

  const evictOne = (preferUnpinned: boolean): boolean => {
    const candidates = preferUnpinned ? working.filter((c) => !c.pinned) : working;
    const pool = candidates.length > 0 ? candidates : working;
    if (pool.length === 0) return false;
    pool.sort((a, b) => a.ordinal - b.ordinal);
    const victim = pool[0];
    working = working.filter((c) => c.id !== victim.id);
    return true;
  };

  while (working.length > maxC && evictOne(true)) {
    /* drain unpinned by LRU */
  }
  while (working.length > maxC && evictOne(false)) {
    /* if only pinned left */
  }

  while (totalTokens() > maxT && evictOne(true)) {
    /* drop unpinned LRU by tokens */
  }
  while (totalTokens() > maxT && evictOne(false)) {
    /* then pinned if necessary */
  }

  working.sort((a, b) => a.ordinal - b.ordinal);
  return working.map(({ ordinal: _o, ...rest }) => rest);
}

/**
 * Fold an append-only {@link StateEvent} stream into a {@link WorkingMemoryView}
 * and enforce {@link MemoryPolicy} per scope.
 */
export function projectWorkingMemory(events: StateEvent[], policy: MemoryPolicy): WorkingMemoryView {
  const sorted = [...events].sort(compareEvents);
  const scopes = new Map<MemoryScope, Map<string, InternalCell>>();
  const applied_event_ids: string[] = [];

  sorted.forEach((e, index) => {
    applied_event_ids.push(e.id);
    const ordinal = index;

    switch (e.type) {
      case "memory_cell_upsert": {
        const m = getScopeMap(scopes, e.scope);
        const tokens = estimateApproxTokens(e.text);
        m.set(e.cell_id, {
          id: e.cell_id,
          scope: e.scope,
          text: e.text,
          approx_tokens: tokens,
          pinned: e.pinned ?? m.get(e.cell_id)?.pinned ?? false,
          source_event_id: e.id,
          refs: e.refs,
          ordinal,
        });
        break;
      }
      case "memory_cell_remove": {
        getScopeMap(scopes, e.scope).delete(e.cell_id);
        break;
      }
      case "memory_cell_pin": {
        const cell = getScopeMap(scopes, e.scope).get(e.cell_id);
        if (cell) {
          cell.pinned = true;
          cell.ordinal = ordinal;
        }
        break;
      }
      case "memory_cell_unpin": {
        const cell = getScopeMap(scopes, e.scope).get(e.cell_id);
        if (cell) {
          cell.pinned = false;
          cell.ordinal = ordinal;
        }
        break;
      }
      case "memory_summarize_compact": {
        const m = getScopeMap(scopes, e.scope);
        for (const cid of e.remove_cell_ids) {
          m.delete(cid);
        }
        const tokens = estimateApproxTokens(e.summary_text);
        m.set(e.summary_cell_id, {
          id: e.summary_cell_id,
          scope: e.scope,
          text: e.summary_text,
          approx_tokens: tokens,
          pinned: e.pinned ?? false,
          source_event_id: e.id,
          ordinal,
        });
        break;
      }
      case "scope_clear": {
        scopes.set(e.scope, new Map());
        break;
      }
    }
  });

  const outScopes: Record<MemoryScope, MemoryCell[]> = {};
  for (const [scope, cellMap] of scopes) {
    const pruned = pruneScope([...cellMap.values()], policy);
    if (pruned.length > 0) {
      outScopes[scope] = pruned;
    }
  }

  return {
    scopes: outScopes,
    last_sequence: sorted.length,
    applied_event_ids,
  };
}

/**
 * Render scopes as newline-separated lines for prompt injection (host decides truncation).
 */
export function workingMemoryToPromptBlock(view: WorkingMemoryView, scopeOrder?: MemoryScope[]): string {
  const keys = scopeOrder?.length
    ? scopeOrder.filter((s) => view.scopes[s]?.length)
    : Object.keys(view.scopes).sort();
  const lines: string[] = [];
  for (const scope of keys) {
    const cells = view.scopes[scope];
    if (!cells?.length) continue;
    lines.push(`## ${scope}`);
    for (const c of cells) {
      const pin = c.pinned ? " (pinned)" : "";
      lines.push(`- [${c.id}]${pin} ${c.text}`);
    }
  }
  return lines.join("\n");
}
