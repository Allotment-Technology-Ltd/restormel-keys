<script lang="ts">
  /**
   * Phase 3 Stage 3 — per-source-kind HEALTH CARDS.
   *
   * The watched-source model made visible: one card per source kind showing what
   * was indexed, what failed (→ exceptions queue), and when it last synced. Read-
   * only presentation of the health summary; the card never blocks the console.
   */
  import { formatSourceKind } from "$lib/connect/pipeline-utils";
  import type { SourceHealthCard } from "$lib/connect/source-health-types";

  export let cards: SourceHealthCard[] = [];

  function statusLabel(status: SourceHealthCard["status"]): string {
    switch (status) {
      case "attention":
        return "Needs attention";
      case "syncing":
        return "Syncing";
      case "healthy":
        return "Watching";
      default:
        return "Empty";
    }
  }

  function relativeTime(iso: string | null): string {
    if (!iso) return "never";
    const then = new Date(iso).getTime();
    if (Number.isNaN(then)) return "unknown";
    const secs = Math.max(0, Math.round((Date.now() - then) / 1000));
    if (secs < 60) return "just now";
    const mins = Math.round(secs / 60);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.round(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.round(hrs / 24);
    return `${days}d ago`;
  }
</script>

{#if cards.length > 0}
  <ul class="health-grid" aria-label="Source health">
    {#each cards as card (card.kind)}
      <li class="health-card status-{card.status}">
        <div class="card-head">
          <span class="card-kind">{formatSourceKind(card.kind)}</span>
          <span class="card-status">{statusLabel(card.status)}</span>
        </div>
        <dl class="card-metrics">
          <div class="metric">
            <dt>Indexed</dt>
            <dd class="metric-num">{card.indexed}</dd>
          </div>
          <div class="metric" class:metric-alert={card.failed > 0}>
            <dt>Failed</dt>
            <dd class="metric-num">{card.failed}</dd>
          </div>
          {#if card.pending > 0}
            <div class="metric">
              <dt>Pending</dt>
              <dd class="metric-num">{card.pending}</dd>
            </div>
          {/if}
        </dl>
        <p class="card-synced">
          Last synced <time datetime={card.lastSyncedAt ?? ""}>{relativeTime(card.lastSyncedAt)}</time>
        </p>
      </li>
    {/each}
  </ul>
{/if}

<style>
  .health-grid {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(13rem, 1fr));
    gap: var(--space-3);
  }
  .health-card {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    padding: var(--space-3);
    border: var(--border);
    background: var(--color-surface);
    box-shadow: var(--shadow-sm);
    /* Left status spine — the at-a-glance health colour. */
    border-left-width: 6px;
  }
  .health-card.status-healthy {
    border-left-color: var(--state-ok-fg);
  }
  .health-card.status-syncing {
    border-left-color: var(--color-blue);
  }
  .health-card.status-attention {
    border-left-color: var(--state-fail-fg);
  }
  .health-card.status-empty {
    border-left-color: var(--color-ink-faint);
  }
  .card-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: var(--space-2);
  }
  .card-kind {
    font-family: var(--font-display);
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: var(--text-display-tracking);
    color: var(--color-ink);
  }
  .card-status {
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    text-transform: uppercase;
    color: var(--color-ink-muted);
  }
  .status-attention .card-status {
    color: var(--state-fail-fg);
    font-weight: 700;
  }
  .card-metrics {
    display: flex;
    gap: var(--space-4);
    margin: 0;
  }
  .metric {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .metric dt {
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    text-transform: uppercase;
    color: var(--color-ink-muted);
  }
  .metric-num {
    margin: 0;
    font-family: var(--font-display);
    font-size: var(--text-display-sm);
    font-weight: 900;
    line-height: 1;
    color: var(--color-ink);
  }
  .metric-alert .metric-num {
    color: var(--state-fail-fg);
  }
  .card-synced {
    margin: 0;
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    color: var(--color-ink-muted);
  }
</style>
