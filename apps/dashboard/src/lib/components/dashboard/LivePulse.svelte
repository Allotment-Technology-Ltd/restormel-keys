<script lang="ts">
  export let pulse: {
    requestCount24h: number;
    errorRate: number;
    p50LatencyMs: number | null;
    p95LatencyMs: number | null;
    avgLatencyMs: number | null;
    topRoute:
      | {
          routeId: string | null;
          routeName: string;
          requestCount: number;
        }
      | null;
    analyticsUnavailable: boolean;
  } | null = null;

  export let isFreeTier = false;

  function percent(v: number): string {
    return `${(v * 100).toFixed(1)}%`;
  }

  function displayLatency(value: number | null): string {
    return value != null ? `${Math.round(value)} ms` : "—";
  }
</script>

<section class="live-pulse" aria-labelledby="live-pulse-heading">
  <div class="pulse-header">
    <h2 id="live-pulse-heading">Live pulse</h2>
    {#if isFreeTier}
      <p class="pro-nudge">Unlock 30-day history and cost breakdown with Pro →</p>
    {/if}
  </div>

  {#if !pulse || pulse.requestCount24h === 0}
    <p class="empty">No requests in the last 24 hours yet.</p>
  {:else}
    <div class="pulse-grid">
      <article>
        <span class="metric">{pulse.requestCount24h.toLocaleString()}</span>
        <span class="label">Requests (24h)</span>
      </article>
      <article>
        <span class="metric">{percent(pulse.errorRate)}</span>
        <span class="label">Error rate</span>
      </article>
      <article>
        <span class="metric">{displayLatency(pulse.p50LatencyMs)}</span>
        <span class="label">p50 latency</span>
      </article>
      <article>
        <span class="metric">{displayLatency(pulse.p95LatencyMs)}</span>
        <span class="label">p95 latency</span>
      </article>
    </div>
    <p class="top-route">
      Top route: <strong>{pulse.topRoute?.routeName ?? "—"}</strong>
      {#if pulse.topRoute}
        <span>({pulse.topRoute.requestCount.toLocaleString()} requests)</span>
      {/if}
    </p>
    {#if pulse.analyticsUnavailable}
      <p class="limited-note">Limited data — Analytics unavailable.</p>
    {/if}
  {/if}
</section>

<style>
  .live-pulse {
    border: 1px solid var(--rm-border);
    background: var(--rm-surface-raised);
    border-radius: var(--rm-radius);
    padding: var(--space-4);
    display: grid;
    gap: var(--space-3);
  }
  .pulse-header h2 {
    margin: 0;
    font-size: var(--text-base);
    color: var(--rm-text);
  }
  .pro-nudge {
    margin: var(--space-1) 0 0;
    font-size: var(--text-xs);
    color: var(--rm-muted);
  }
  .pulse-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(8rem, 1fr));
    gap: var(--space-3);
  }
  .pulse-grid article {
    border: 1px solid var(--rm-border);
    border-radius: var(--rm-radius);
    background: var(--rm-surface);
    padding: var(--space-3);
    display: grid;
    gap: 0.25rem;
  }
  .metric {
    font-size: var(--text-xl);
    color: var(--rm-text);
    font-weight: 600;
  }
  .label {
    font-size: var(--text-xs);
    color: var(--rm-muted);
  }
  .top-route {
    margin: 0;
    font-size: var(--text-sm);
    color: var(--rm-muted);
  }
  .top-route strong {
    color: var(--rm-text);
  }
  .top-route span {
    margin-left: var(--space-1);
  }
  .limited-note {
    margin: 0;
    font-size: var(--text-xs);
    color: var(--rm-dim);
  }
  .empty {
    margin: 0;
    color: var(--rm-muted);
    font-size: var(--text-sm);
  }
</style>
