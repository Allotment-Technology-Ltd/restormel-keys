<script lang="ts">
  import { base } from "$app/paths";

  export let data: {
    logs: {
      id: string;
      projectId: string;
      environmentId: string;
      routeId: string | null;
      gatewayKeyId: string | null;
      providerType: string;
      finalModelId: string | null;
      requestStatus: string;
      latencyMs: number;
      inputTokens: number | null;
      outputTokens: number | null;
      estimatedCost: number | null;
      createdAt: number;
    }[];
    filter: { projectId: string | null; routeId: string | null } | null;
    error: string | null;
  };

  function formatTime(ts: number): string {
    return new Date(ts).toLocaleString();
  }
</script>

<h1 class="page-title">Logs & Traces</h1>
<p class="page-desc">
  Request logs from the gateway. Filter by project or route via query params. For analytics summaries, see <a href={base + "/analytics"}>Analytics</a>.
</p>
{#if data.filter && (data.filter.routeId || data.filter.projectId)}
  <p class="filter-msg" role="status">
    Filtered by
    {#if data.filter.routeId && data.filter.projectId}
      <a href={base + "/projects/" + data.filter.projectId + "/routes/" + data.filter.routeId}>route {data.filter.routeId.slice(0, 8)}…</a>
    {:else if data.filter.routeId}
      route <code>{data.filter.routeId}</code>
    {:else}
      project <code>{data.filter.projectId}</code>
    {/if}
    · <a href={base + "/logs"}>Clear filter</a>
  </p>
{/if}

{#if data.error}
  <p class="error-msg" role="alert">{data.error}</p>
{:else if data.logs.length === 0}
  <p class="empty-msg">No request logs in the last 7 days. Traffic through resolved routes will appear here.</p>
  <p><a href={base + "/analytics"}>Analytics</a> · <a href={base + "/routes"}>Routes</a></p>
{:else}
  <ul class="log-list">
    {#each data.logs as log}
      <li class="log-row">
        <span class="log-time">{formatTime(log.createdAt)}</span>
        <span class="log-status">{log.requestStatus}</span>
        <span class="log-provider">{log.providerType}</span>
        <span class="log-model">{log.finalModelId ?? "—"}</span>
        <span class="log-latency">{log.latencyMs} ms</span>
        {#if log.inputTokens != null || log.outputTokens != null}
          <span class="log-tokens">in: {log.inputTokens ?? "—"} out: {log.outputTokens ?? "—"}</span>
        {/if}
        {#if log.routeId}
          <a href={base + "/projects/" + log.projectId + "/routes/" + log.routeId} class="log-link">Route</a>
        {/if}
      </li>
    {/each}
  </ul>
  <p class="muted">Showing up to 100 logs. Add ?limit=200 or ?projectId=…&routeId=… to filter.</p>
{/if}

<style>
  .page-title {
    font-family: var(--rm-font-display);
    font-size: var(--text-2xl);
    font-weight: 600;
    color: var(--rm-text);
    margin: 0 0 var(--space-2);
  }
  .page-desc {
    color: var(--rm-muted);
    font-size: var(--text-sm);
    margin: 0 0 var(--space-4);
  }
  .error-msg {
    color: var(--coral-alert);
    font-size: var(--text-sm);
  }
  .empty-msg {
    color: var(--rm-muted);
    font-size: var(--text-sm);
  }
  .log-list {
    list-style: none;
    padding: 0;
    margin: 0;
  }
  .log-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-2) 0;
    border-bottom: 1px solid var(--rm-border);
    font-size: var(--text-sm);
  }
  .log-time {
    color: var(--rm-muted);
    white-space: nowrap;
  }
  .log-status, .log-provider, .log-model {
    color: var(--rm-text);
  }
  .log-latency, .log-tokens {
    color: var(--rm-muted);
    font-variant-numeric: tabular-nums;
  }
  .log-link {
    color: var(--rm-sage);
    font-size: var(--text-xs);
  }
  .muted {
    font-size: var(--text-sm);
    color: var(--rm-dim);
    margin-top: var(--space-4);
  }
  .filter-msg {
    font-size: var(--text-sm);
    color: var(--rm-muted);
    margin: 0 0 var(--space-3);
  }
  .filter-msg a {
    color: var(--rm-sage);
  }
  .filter-msg code {
    font-size: var(--text-xs);
    background: var(--rm-surface);
    padding: 2px 6px;
    border-radius: 4px;
  }
</style>
