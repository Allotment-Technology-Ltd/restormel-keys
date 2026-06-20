<script lang="ts">
  /**
   * Phase 3 Stage 3 — EXCEPTIONS QUEUE.
   *
   * The one place a human triages only what failed: failed source documents
   * (parse/fetch errors) and failed ingest runs. Replaces babysitting every step.
   *
   * Actions reuse the EXISTING endpoints — no new mutation surface:
   *   - failed run      → POST /api/connect/ingest/jobs/[id]/restart  ("Re-run")
   *   - failed document → DELETE /api/connect/sources/documents/[id]  ("Dismiss")
   * Both link out to the relevant surface for the full picture.
   */
  import { DASHBOARD_BASE } from "$lib/dashboard-base";
  import { RUNS_HREF } from "$lib/nav-config";
  import { formatSourceKind } from "$lib/connect/pipeline-utils";
  import type { SourceException } from "$lib/connect/source-health-types";

  export let exceptions: SourceException[] = [];
  /** Total failing items server-side (may exceed the rendered slice). */
  export let total = 0;
  /** Bubbles up when an action mutates state so the parent can refresh the page data. */
  export let onResolved: () => void = () => {};

  const DOCS_API = DASHBOARD_BASE + "/api/connect/sources/documents";
  const JOBS_API = DASHBOARD_BASE + "/api/connect/ingest/jobs";

  let busyId: string | null = null;
  let actionError: string | null = null;

  function relativeTime(iso: string): string {
    const then = new Date(iso).getTime();
    if (Number.isNaN(then)) return "";
    const secs = Math.max(0, Math.round((Date.now() - then) / 1000));
    if (secs < 60) return "just now";
    const mins = Math.round(secs / 60);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.round(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.round(hrs / 24)}d ago`;
  }

  async function rerunRun(id: string) {
    if (busyId) return;
    busyId = id;
    actionError = null;
    try {
      const res = await fetch(`${JOBS_API}/${id}/restart`, { method: "POST" });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        actionError = d.message ?? `Could not re-run (HTTP ${res.status}).`;
        return;
      }
      onResolved();
    } catch {
      actionError = "Network error while re-running.";
    } finally {
      busyId = null;
    }
  }

  async function dismissDocument(id: string, title: string) {
    if (busyId) return;
    if (!confirm(`Dismiss "${title}" from the exceptions queue?\n\nThe failed document is removed. You can re-add it from the source any time.`))
      return;
    busyId = id;
    actionError = null;
    try {
      const res = await fetch(`${DOCS_API}/${id}`, { method: "DELETE" });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        actionError = d.message ?? `Could not dismiss (HTTP ${res.status}).`;
        return;
      }
      onResolved();
    } catch {
      actionError = "Network error while dismissing.";
    } finally {
      busyId = null;
    }
  }
</script>

<section class="exceptions" aria-labelledby="exceptions-heading">
  <div class="exceptions-head">
    <h2 id="exceptions-heading" class="section-title">
      Exceptions queue
      {#if total > 0}<span class="count-badge" aria-label={`${total} items need attention`}>{total}</span>{/if}
    </h2>
    <p class="exceptions-sub">Just the things that need you — documents and runs that failed. Everything else ingests on its own in the background.</p>
  </div>

  {#if actionError}
    <p class="action-error" role="alert">{actionError}</p>
  {/if}

  {#if exceptions.length === 0}
    <div class="queue-clear" role="status">
      <span class="clear-mark" aria-hidden="true">✓</span>
      <div>
        <p class="clear-title">All clear</p>
        <p class="clear-sub">Nothing needs you right now — your sources are ingesting cleanly in the background.</p>
      </div>
    </div>
  {:else}
    <ul class="queue">
      {#each exceptions as ex (ex.type + ":" + ex.id)}
        <li class="queue-row">
          <div class="queue-main">
            <div class="queue-title-row">
              <span class="queue-type">{ex.type === "run" ? "Run" : formatSourceKind(ex.kind)}</span>
              <span class="queue-title">{ex.title}</span>
            </div>
            <p class="queue-error">{ex.error}</p>
            <span class="queue-when">{relativeTime(ex.at)}</span>
          </div>
          <div class="queue-actions">
            {#if ex.type === "run"}
              <button
                type="button"
                class="btn btn-primary btn-sm"
                disabled={busyId === ex.id}
                on:click={() => rerunRun(ex.id)}
              >
                {busyId === ex.id ? "…" : "Re-run"}
              </button>
              <a class="btn btn-outline btn-sm" href={`${RUNS_HREF}/${ex.id}`}>Open</a>
            {:else}
              <button
                type="button"
                class="btn btn-outline btn-sm"
                disabled={busyId === ex.id}
                on:click={() => dismissDocument(ex.id, ex.title)}
              >
                {busyId === ex.id ? "…" : "Dismiss"}
              </button>
            {/if}
          </div>
        </li>
      {/each}
    </ul>
    {#if total > exceptions.length}
      <p class="queue-overflow">Showing {exceptions.length} of {total} — resolve these, then refresh for more.</p>
    {/if}
  {/if}
</section>

<style>
  .exceptions {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }
  .exceptions-head {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }
  .section-title {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    font-family: var(--font-display);
    font-size: var(--text-display-sm, 1.25rem);
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: var(--text-display-tracking);
    margin: 0;
    color: var(--color-ink);
  }
  .count-badge {
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    font-weight: 700;
    background: var(--state-fail-bg);
    color: var(--state-fail-fg);
    border: var(--border-thin);
    padding: 0 var(--space-2);
  }
  .exceptions-sub {
    margin: 0;
    color: var(--color-ink-muted);
  }
  .action-error {
    margin: 0;
    padding: var(--space-2) var(--space-3);
    border: var(--border-thin);
    background: var(--state-fail-bg);
    color: var(--state-fail-fg);
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
  }
  .queue-clear {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-4);
    border: var(--border);
    background: var(--state-ok-bg);
  }
  .clear-mark {
    font-family: var(--font-display);
    font-size: var(--text-display-md);
    font-weight: 900;
    line-height: 1;
    color: var(--state-ok-fg);
  }
  .clear-title {
    margin: 0;
    font-family: var(--font-display);
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: var(--text-display-tracking);
    color: var(--color-ink);
  }
  .clear-sub {
    margin: 0;
    color: var(--color-ink-muted);
  }
  .queue {
    list-style: none;
    margin: 0;
    padding: 0;
    border: var(--border);
    background: var(--color-surface);
    box-shadow: var(--shadow-sm);
  }
  .queue-row {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--space-3);
    padding: var(--space-3);
    border-bottom: var(--border-thin);
    border-left: 6px solid var(--state-fail-fg);
  }
  .queue-row:last-child {
    border-bottom: none;
  }
  .queue-main {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    min-width: 0;
  }
  .queue-title-row {
    display: flex;
    align-items: baseline;
    gap: var(--space-2);
    flex-wrap: wrap;
  }
  .queue-type {
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    text-transform: uppercase;
    color: var(--color-ink-muted);
    border: var(--border-thin);
    padding: 0 var(--space-1);
    flex-shrink: 0;
  }
  .queue-title {
    font-weight: 700;
    color: var(--color-ink);
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .queue-error {
    margin: 0;
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    color: var(--state-fail-fg);
    overflow-wrap: anywhere;
  }
  .queue-when {
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    color: var(--color-ink-faint);
  }
  .queue-actions {
    display: flex;
    gap: var(--space-2);
    flex-shrink: 0;
  }
  .queue-overflow {
    margin: 0;
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    color: var(--color-ink-muted);
  }
</style>
