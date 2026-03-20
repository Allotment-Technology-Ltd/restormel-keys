<script lang="ts">
  import { DASHBOARD_BASE } from "$lib/dashboard-base";
  import { goto } from "$app/navigation";

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
    filter: { projectId: string | null; routeId: string | null; status: string | null } | null;
    controls: {
      availableProjects: string[];
      availableRoutes: string[];
      availableStatuses: string[];
      limit: number;
    };
    error: string | null;
  };

  let projectFilter = data.filter?.projectId ?? "";
  let routeFilter = data.filter?.routeId ?? "";
  let statusFilter = data.filter?.status ?? "";
  let limitFilter = String(data.controls?.limit ?? 100);

  function formatTime(ts: number): string {
    return new Date(ts).toLocaleString();
  }

  function statusClass(status: string): string {
    if (status === "resolved") return "status-resolved";
    if (status === "policy_blocked") return "status-policy";
    if (status === "no_route") return "status-no-route";
    return "status-other";
  }

  function applyFilters() {
    const params = new URLSearchParams();
    if (projectFilter) params.set("projectId", projectFilter);
    if (routeFilter) params.set("routeId", routeFilter);
    if (statusFilter) params.set("status", statusFilter);
    if (limitFilter) params.set("limit", limitFilter);
    goto(`${DASHBOARD_BASE}/logs${params.toString() ? "?" + params.toString() : ""}`);
  }
</script>

<h1 class="page-title">Logs & Traces</h1>
<p class="page-desc">
  Request logs captured by Restormel (from the Dashboard API execution path). Filter by project or route via query params. For analytics summaries, see <a href={DASHBOARD_BASE + "/analytics"}>Analytics</a>.
</p>
<p class="notice">
  <strong>Note:</strong> This page shows Restormel request logs. If your execution layer is OpenRouter/Portkey/Vercel and traffic doesn’t flow through Restormel, import gateway logs/usage exports via <a href={DASHBOARD_BASE + "/integrations"}>Integrations</a>.
</p>
<form class="filter-bar" onsubmit={(e) => { e.preventDefault(); applyFilters(); }} aria-label="Log filters">
  <label>
    Project
    <select bind:value={projectFilter}>
      <option value="">Any</option>
      {#each data.controls.availableProjects as p}
        <option value={p}>{p.slice(0, 8)}…</option>
      {/each}
    </select>
  </label>
  <label>
    Route
    <select bind:value={routeFilter}>
      <option value="">Any</option>
      {#each data.controls.availableRoutes as r}
        <option value={r}>{r.slice(0, 8)}…</option>
      {/each}
    </select>
  </label>
  <label>
    Status
    <select bind:value={statusFilter}>
      <option value="">Any</option>
      {#each data.controls.availableStatuses as s}
        <option value={s}>{s}</option>
      {/each}
    </select>
  </label>
  <label>
    Limit
    <select bind:value={limitFilter}>
      <option value="50">50</option>
      <option value="100">100</option>
      <option value="200">200</option>
    </select>
  </label>
  <button type="submit" class="btn-apply">Apply</button>
  <a href={DASHBOARD_BASE + "/logs"} class="btn-clear">Clear</a>
</form>
{#if data.filter && (data.filter.routeId || data.filter.projectId || data.filter.status)}
  <p class="filter-msg" role="status">
    Filtered by
    {#if data.filter.routeId && data.filter.projectId}
      <a href={DASHBOARD_BASE + "/projects/" + data.filter.projectId + "/routes/" + data.filter.routeId}>route {data.filter.routeId.slice(0, 8)}…</a>
    {:else if data.filter.routeId}
      route <code>{data.filter.routeId}</code>
    {:else}
      project <code>{data.filter.projectId}</code>
    {/if}
    {#if data.filter.status}
      · status <code>{data.filter.status}</code>
    {/if}
    · <a href={DASHBOARD_BASE + "/logs"}>Clear filter</a>
  </p>
{/if}

{#if data.error}
  <p class="error-msg" role="alert">{data.error}</p>
{:else if data.logs.length === 0}
  <p class="empty-msg">No request logs in the last 7 days. Traffic through resolved routes will appear here.</p>
  <p><a href={DASHBOARD_BASE + "/analytics"}>Analytics</a> · <a href={DASHBOARD_BASE + "/routes"}>Routes</a></p>
{:else}
  <ul class="log-list">
    {#each data.logs as log}
      <li class="log-row">
        <span class="log-time">{formatTime(log.createdAt)}</span>
        <span class={`log-status ${statusClass(log.requestStatus)}`}>{log.requestStatus}</span>
        <span class="log-provider">{log.providerType}</span>
        <span class="log-model">{log.finalModelId ?? "—"}</span>
        <span class="log-latency">{log.latencyMs} ms</span>
        {#if log.inputTokens != null || log.outputTokens != null}
          <span class="log-tokens">in: {log.inputTokens ?? "—"} out: {log.outputTokens ?? "—"}</span>
        {/if}
        {#if log.routeId}
          <a href={DASHBOARD_BASE + "/projects/" + log.projectId + "/routes/" + log.routeId} class="log-link">Route</a>
        {/if}
      </li>
    {/each}
  </ul>
  <p class="muted">
    Showing up to {limitFilter} logs.
    {#if data.logs.some((l) => l.requestStatus === "no_route")}
      <a href={DASHBOARD_BASE + "/routes"}>Fix no_route?</a> Check route coverage and ensure a published route matches your environment + stage.
    {/if}
  </p>
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
  .notice {
    margin: 0 0 var(--space-4);
    padding: var(--space-3) var(--space-4);
    border: 1px solid var(--rm-border);
    border-left-width: 4px;
    border-left-color: var(--rm-muted);
    border-radius: var(--radius-md);
    background: var(--rm-surface);
    font-size: var(--text-sm);
    color: var(--rm-muted);
    line-height: var(--leading-relaxed);
  }
  .notice a { color: var(--rm-sage); font-weight: 500; }
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
  .filter-bar {
    display: flex;
    flex-wrap: wrap;
    align-items: end;
    gap: var(--space-3);
    margin: 0 0 var(--space-3);
  }
  .filter-bar label {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: var(--text-xs);
    color: var(--rm-muted);
  }
  .filter-bar select {
    min-width: 9rem;
    border: 1px solid var(--rm-border);
    border-radius: var(--rm-radius);
    background: var(--rm-bg);
    color: var(--rm-text);
    padding: var(--space-2);
    font-size: var(--text-sm);
  }
  .btn-apply, .btn-clear {
    padding: var(--space-2) var(--space-3);
    border-radius: var(--rm-radius);
    font-size: var(--text-sm);
    text-decoration: none;
  }
  .btn-apply {
    border: 1px solid var(--rm-border);
    background: var(--rm-sage);
    color: var(--rm-bg);
  }
  .btn-clear {
    border: 1px solid var(--rm-border);
    color: var(--rm-muted);
  }
  .status-resolved {
    color: #2e8f57;
    font-weight: 600;
  }
  .status-policy {
    color: #b86b00;
    font-weight: 600;
  }
  .status-no-route {
    color: #c95c5c;
    font-weight: 600;
  }
  .status-other {
    color: var(--rm-text);
    font-weight: 600;
  }
</style>
