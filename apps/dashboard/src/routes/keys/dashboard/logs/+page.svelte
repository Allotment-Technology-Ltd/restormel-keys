<script lang="ts">
  import { DASHBOARD_BASE } from "$lib/dashboard-base";
  import { goto } from "$app/navigation";
  import { onMount } from "svelte";

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
      ttftMs: number | null;
      inputTokens: number | null;
      outputTokens: number | null;
      estimatedCost: number | null;
      fallbackCount: number | null;
      errorCode: string | null;
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
  let selectedLog: (typeof data.logs)[number] | null = null;
  const LOGS_VISITED_KEY = "restormel_logs_visited";

  onMount(() => {
    localStorage.setItem(LOGS_VISITED_KEY, "true");
  });

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

  function fixNoRouteHref(log: (typeof data.logs)[number]): string {
    const params = new URLSearchParams();
    params.set("newRoute", "true");
    if (log.environmentId) params.set("env", log.environmentId);
    return `${DASHBOARD_BASE}/routes?${params.toString()}`;
  }

  function policyChecks(log: (typeof data.logs)[number]): string[] {
    const checks: string[] = [];
    if (log.requestStatus === "policy_blocked") checks.push("policy_blocked");
    if (log.errorCode?.toLowerCase().includes("policy")) checks.push(log.errorCode);
    return checks;
  }

  function openLogDetail(log: (typeof data.logs)[number]) {
    selectedLog = log;
  }

  function closeLogDetail() {
    selectedLog = null;
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
      <li
        class="log-row-wrap"
        class:log-row-no-route={log.requestStatus === "no_route"}
      >
        <button type="button" class="log-row" onclick={() => openLogDetail(log)}>
          <span class="log-time">{formatTime(log.createdAt)}</span>
          <span class={`log-status ${statusClass(log.requestStatus)}`}>{log.requestStatus}</span>
          <span class="log-provider">{log.providerType}</span>
          <span class="log-model">{log.finalModelId ?? "—"}</span>
          <span class="log-latency">{log.latencyMs} ms</span>
          {#if log.inputTokens != null || log.outputTokens != null}
            <span class="log-tokens">in: {log.inputTokens ?? "—"} out: {log.outputTokens ?? "—"}</span>
          {/if}
          {#if log.routeId}
            <span class="log-link">route: {log.routeId.slice(0, 8)}…</span>
          {/if}
        </button>
        {#if log.requestStatus === "no_route"}
          <a
            href={fixNoRouteHref(log)}
            class="log-fix-link"
            onclick={(e) => e.stopPropagation()}
          >Fix?</a>
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

{#if selectedLog}
  <div class="detail-backdrop" role="presentation" onclick={closeLogDetail}></div>
  <div class="detail-panel" role="dialog" aria-modal="true" aria-labelledby="request-detail-title">
    <header class="detail-header">
      <h2 id="request-detail-title">Request detail</h2>
      <button type="button" class="detail-close" onclick={closeLogDetail} aria-label="Close request detail">
        ×
      </button>
    </header>
    <div class="detail-body">
      <p><strong>Timestamp:</strong> {formatTime(selectedLog.createdAt)}</p>
      <p>
        <strong>Status:</strong>
        <span class={`log-status ${statusClass(selectedLog.requestStatus)}`}>{selectedLog.requestStatus}</span>
      </p>
      <p><strong>Model requested:</strong> {selectedLog.finalModelId ?? "Unavailable in log record"}</p>
      <p><strong>Provider resolved:</strong> {selectedLog.providerType}</p>
      <p>
        <strong>Route matched:</strong>
        {#if selectedLog.routeId}
          <a href={DASHBOARD_BASE + "/projects/" + selectedLog.projectId + "/routes/" + selectedLog.routeId}>
            {selectedLog.routeId}
          </a>
        {:else}
          No route matched
        {/if}
      </p>
      <div>
        <strong>Policy checks run:</strong>
        {#if policyChecks(selectedLog).length > 0}
          <ul>
            {#each policyChecks(selectedLog) as check}
              <li>{check}</li>
            {/each}
          </ul>
        {:else}
          <p class="muted">No policy check metadata available for this request.</p>
        {/if}
      </div>
      <p>
        <strong>Latency breakdown:</strong>
        total {selectedLog.latencyMs} ms
        {#if selectedLog.ttftMs != null}
          · resolve/TTFT {selectedLog.ttftMs} ms
        {:else}
          · resolve time unavailable
        {/if}
      </p>
      <div>
        <strong>Raw response metadata:</strong>
        <pre>{JSON.stringify({
          gatewayKeyId: selectedLog.gatewayKeyId,
          errorCode: selectedLog.errorCode,
          fallbackCount: selectedLog.fallbackCount,
          inputTokens: selectedLog.inputTokens,
          outputTokens: selectedLog.outputTokens,
          estimatedCost: selectedLog.estimatedCost,
          environmentId: selectedLog.environmentId,
          projectId: selectedLog.projectId,
        }, null, 2)}</pre>
      </div>
    </div>
  </div>
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
  .log-row-wrap {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-2) 0;
    border-bottom: 1px solid var(--rm-border);
    font-size: var(--text-sm);
  }
  .log-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-3);
    border: none;
    background: transparent;
    color: inherit;
    width: 100%;
    text-align: left;
    padding: 0;
    cursor: pointer;
  }
  .log-row:focus-visible {
    outline: 2px solid var(--rm-sage);
    outline-offset: 2px;
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
  .log-fix-link {
    color: #c08a1c;
    font-size: var(--text-xs);
    font-weight: 600;
  }
  .log-row-no-route {
    border-left: 4px solid #c08a1c;
    background: color-mix(in oklab, #c08a1c 14%, transparent);
    padding-left: var(--space-2);
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
  .detail-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.35);
    z-index: 40;
  }
  .detail-panel {
    position: fixed;
    top: 0;
    right: 0;
    width: min(30rem, 100vw);
    height: 100vh;
    background: var(--rm-bg);
    border-left: 1px solid var(--rm-border);
    box-shadow: -8px 0 20px rgba(0, 0, 0, 0.2);
    z-index: 50;
    display: flex;
    flex-direction: column;
  }
  .detail-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
    padding: var(--space-4);
    border-bottom: 1px solid var(--rm-border);
  }
  .detail-header h2 {
    margin: 0;
    font-size: var(--text-base);
    color: var(--rm-text);
  }
  .detail-close {
    border: none;
    background: transparent;
    color: var(--rm-muted);
    font-size: 1.4rem;
    cursor: pointer;
    line-height: 1;
  }
  .detail-body {
    padding: var(--space-4);
    overflow: auto;
    display: grid;
    gap: var(--space-2);
  }
  .detail-body p {
    margin: 0;
    font-size: var(--text-sm);
    color: var(--rm-muted);
  }
  .detail-body strong {
    color: var(--rm-text);
  }
  .detail-body ul {
    margin: var(--space-1) 0 0;
    padding-left: 1.25rem;
    color: var(--rm-muted);
    font-size: var(--text-sm);
  }
  .detail-body pre {
    margin: var(--space-1) 0 0;
    font-size: var(--text-xs);
    white-space: pre-wrap;
    background: var(--rm-surface);
    border: 1px solid var(--rm-border);
    border-radius: var(--rm-radius);
    padding: var(--space-2);
    color: var(--rm-text);
  }
</style>
