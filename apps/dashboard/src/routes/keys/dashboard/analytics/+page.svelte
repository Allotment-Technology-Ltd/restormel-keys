<script lang="ts">
  import { DASHBOARD_BASE } from "$lib/dashboard-base";
  import { navigating } from "$app/stores";
  import UsageChartsSection from "$lib/components/dashboard/UsageChartsSection.svelte";

  type Aggregate = {
    projectId: string | null;
    routeId: string | null;
    providerType: string | null;
    modelId: string | null;
    requestCount: number;
    inputTokens: number;
    outputTokens: number;
    estimatedCost: number | null;
    avgLatencyMs: number | null;
    errorRate: number | null;
  };

  type RequestLog = {
    id: string;
    projectId: string;
    environmentId: string;
    routeId: string | null;
    providerType: string;
    finalModelId: string | null;
    requestStatus: string;
    latencyMs: number;
    createdAt: number;
  };

  export let data: {
    aggregates: Aggregate[];
    recentLogs: RequestLog[];
    period: { since: number; until: number };
    days: number;
    projectId: string | null;
    projects: { id: string; name: string }[];
    error: string | null;
    usageCharts: {
      dailyRequests: { label: string; count: number }[];
      requestsOverTimeSource: "database" | "mock";
      costByModel: { model: string; costUsd: number }[];
      costByModelSource: "database" | "mock";
    } | null;
  };

  /** Legacy `$:` (not `$derived`) — dashboard uses `compilerOptions.runes: false`. */
  $: totalRequests = data.aggregates.reduce((s, a) => s + a.requestCount, 0);
  $: totalLatencyWeighted = data.aggregates.reduce(
    (s, a) => s + a.requestCount * (a.avgLatencyMs ?? 0),
    0
  );
  $: avgLatencyMs = totalRequests > 0 ? Math.round(totalLatencyWeighted / totalRequests) : null;
  $: totalErrorWeighted = data.aggregates.reduce(
    (s, a) => s + a.requestCount * (a.errorRate ?? 0),
    0
  );
  $: errorRate = totalRequests > 0 ? totalErrorWeighted / totalRequests : 0;
  $: totalSpend = data.aggregates.reduce((s, a) => s + (a.estimatedCost ?? 0), 0);
  $: hasRealCostSignals =
    data.aggregates.some((a) => a.estimatedCost != null && a.estimatedCost > 0) ||
    (data.usageCharts?.costByModelSource === "database" &&
      (data.usageCharts?.costByModel?.some((c) => c.costUsd > 0) ?? false));

  function projectScopedDaysHref(nextDays: number): string {
    const q = new URLSearchParams();
    q.set("days", String(nextDays));
    if (data.projectId) q.set("projectId", data.projectId);
    return `?${q.toString()}`;
  }

  function providerMix(): { name: string; count: number }[] {
    const byProvider: Record<string, number> = {};
    for (const a of data.aggregates) {
      const key = a.providerType ?? "—";
      byProvider[key] = (byProvider[key] ?? 0) + a.requestCount;
    }
    return Object.entries(byProvider)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }

  function modelMix(): { name: string; count: number }[] {
    const byModel: Record<string, number> = {};
    for (const a of data.aggregates) {
      const key = a.modelId ?? "—";
      byModel[key] = (byModel[key] ?? 0) + a.requestCount;
    }
    return Object.entries(byModel)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }

  function routeMix(): { routeId: string | null; projectId: string | null; count: number }[] {
    const byRoute: Record<string, { projectId: string | null; count: number }> = {};
    for (const a of data.aggregates) {
      const key = a.routeId ?? "—";
      if (!byRoute[key]) byRoute[key] = { projectId: a.projectId ?? null, count: 0 };
      byRoute[key].count += a.requestCount;
    }
    return Object.entries(byRoute)
      .map(([routeId, o]) => ({ routeId: routeId === "—" ? null : routeId, projectId: o.projectId, count: o.count }))
      .sort((a, b) => b.count - a.count);
  }

  function formatTime(ts: number): string {
    return new Date(ts).toLocaleString();
  }

  function periodLabel(): string {
    return data.days === 1 ? "Last 24 hours" : `Last ${data.days} days`;
  }
</script>

<svelte:head>
  <title>Analytics – Restormel</title>
</svelte:head>

<h1 class="page-title">Usage & Analytics</h1>
<p class="page-desc">
  Request counts, latency, error rate, and usage by provider, model, and route. Data from request logs ({periodLabel()}).
</p>
<p class="notice">
  <strong>Imported gateway analytics:</strong> If you’re using OpenRouter/Portkey/Vercel as your execution layer, you can import their usage exports into Restormel.
  Imported aggregates appear in <a href={DASHBOARD_BASE + "/usage"}>Usage</a> (and will be surfaced here as coverage expands). See <a href={DASHBOARD_BASE + "/integrations"}>Integrations</a>.
</p>
{#if !data.error}
  <p class="period-links" role="navigation" aria-label="Time range">
    <span class="period-label">Range:</span>
    <a href={projectScopedDaysHref(1)} class="period-link" class:active={data.days === 1}>24h</a>
    <a href={projectScopedDaysHref(7)} class="period-link" class:active={data.days === 7}>7d</a>
    <a href={projectScopedDaysHref(30)} class="period-link" class:active={data.days === 30}>30d</a>
    <a href={projectScopedDaysHref(90)} class="period-link" class:active={data.days === 90}>90d</a>
  </p>
  {#if data.projects.length > 0}
    <p class="period-links project-scope-links" role="navigation" aria-label="Project scope">
      <span class="period-label">Project:</span>
      <a href={projectScopedDaysHref(data.days)} class="period-link" class:active={!data.projectId}>All</a>
      {#each data.projects as p}
        <a
          href={`?days=${data.days}&projectId=${encodeURIComponent(p.id)}`}
          class="period-link"
          class:active={data.projectId === p.id}>{p.name}</a>
      {/each}
    </p>
  {/if}
{/if}

{#if $navigating}
  <p class="loading-msg" role="status" aria-live="polite">Loading analytics…</p>
{:else if data.error}
  <p class="error-msg" role="alert">{data.error}</p>
  <p><a href={DASHBOARD_BASE + "/logs"}>View Logs & Traces</a> for raw request data.</p>
{:else}
  {#if data.usageCharts}
    <UsageChartsSection
      dailyRequests={data.usageCharts.dailyRequests}
      requestsOverTimeSource={data.usageCharts.requestsOverTimeSource}
      costByModel={data.usageCharts.costByModel}
      costByModelSource={data.usageCharts.costByModelSource}
    />
  {/if}
  {#if data.aggregates.length === 0 && data.recentLogs.length === 0}
    <div class="empty-state" role="status">
      <p class="empty-title">No requests yet</p>
      <p class="empty-desc">Usage data will appear here once traffic flows through resolved routes.</p>
      <a href={DASHBOARD_BASE + "/routes"} class="btn btn-primary">Routes</a>
      <a href={DASHBOARD_BASE + "/logs"} class="btn btn-secondary">Logs & Traces</a>
    </div>
  {:else}
  <section class="section overview" aria-labelledby="overview-heading">
    <h2 id="overview-heading" class="section-title">Overview</h2>
    <div class="metrics">
      <div class="metric">
        <span class="metric-value">{totalRequests.toLocaleString()}</span>
        <span class="metric-label">Requests</span>
      </div>
      <div class="metric">
        <span class="metric-value">{avgLatencyMs != null ? avgLatencyMs + " ms" : "—"}</span>
        <span class="metric-label">Avg latency</span>
      </div>
      <div class="metric">
        <span class="metric-value">{(errorRate * 100).toFixed(1)}%</span>
        <span class="metric-label">Error rate</span>
      </div>
      <div class="metric">
        <span class="metric-value">{totalSpend > 0 ? "$" + totalSpend.toFixed(2) : "—"}</span>
        <span class="metric-label">Est. spend</span>
      </div>
    </div>
    {#if totalRequests > 0 && !hasRealCostSignals}
      <p class="muted">
        Estimated spend is not shown until <code>estimated_cost</code> is populated on request logs (or cost-by-model data
        is non-zero).
      </p>
    {/if}
  </section>

  <section class="section" aria-labelledby="mix-heading">
    <h2 id="mix-heading" class="section-title">Mix by provider, model, route</h2>
    <div class="mix-grid">
      <div class="mix-card">
        <h3 class="mix-title">Provider</h3>
        {#if providerMix().length === 0}
          <p class="muted">No data</p>
        {:else}
          <ul class="mix-list">
            {#each providerMix() as m}
              <li><span class="mix-name">{m.name}</span> <span class="mix-count">{m.count.toLocaleString()}</span></li>
            {/each}
          </ul>
        {/if}
      </div>
      <div class="mix-card">
        <h3 class="mix-title">Model</h3>
        {#if modelMix().length === 0}
          <p class="muted">No data</p>
        {:else}
          <ul class="mix-list">
            {#each modelMix() as m}
              <li>
                {#if m.name !== "—"}
                  <a href={DASHBOARD_BASE + "/models/" + encodeURIComponent(m.name)} class="mix-link">{m.name}</a>
                {:else}
                  <span class="mix-name">—</span>
                {/if}
                <span class="mix-count">{m.count.toLocaleString()}</span>
              </li>
            {/each}
          </ul>
        {/if}
      </div>
      <div class="mix-card">
        <h3 class="mix-title">Route</h3>
        {#if routeMix().length === 0}
          <p class="muted">No data</p>
        {:else}
          <ul class="mix-list">
            {#each routeMix() as m}
              <li class="mix-list-item-route">
                <span class="mix-route-primary">
                  {#if m.routeId}
                    <a href={m.projectId ? DASHBOARD_BASE + "/projects/" + m.projectId + "/routes/" + m.routeId : "#"} class="mix-link">{m.routeId.slice(0, 8)}…</a>
                  {:else}
                    <span class="mix-name">—</span>
                  {/if}
                  <span class="mix-count">{m.count.toLocaleString()}</span>
                </span>
                {#if m.routeId && m.projectId}
                  <a href={DASHBOARD_BASE + "/logs?routeId=" + encodeURIComponent(m.routeId) + "&projectId=" + encodeURIComponent(m.projectId)} class="mix-sublink">Logs</a>
                {/if}
              </li>
            {/each}
          </ul>
        {/if}
      </div>
    </div>
  </section>

  <section class="section" aria-labelledby="recent-heading">
    <h2 id="recent-heading" class="section-title">Recent requests (drill-down)</h2>
    <p class="section-desc">
      Latest request logs in the period. For full list and filters, use <a href={DASHBOARD_BASE + "/logs"}>Logs & Traces</a>.
    </p>
    {#if data.recentLogs.length === 0}
      <p class="muted">No recent requests in this period.</p>
    {:else}
      <ul class="log-list">
        {#each data.recentLogs as log}
          <li class="log-row">
            <span class="log-time" title={formatTime(log.createdAt)}>{formatTime(log.createdAt)}</span>
            <span class="log-status">{log.requestStatus}</span>
            <span class="log-provider">{log.providerType}</span>
            <span class="log-model">{log.finalModelId ?? "—"}</span>
            <span class="log-latency">{log.latencyMs} ms</span>
            {#if log.routeId}
              <a href={DASHBOARD_BASE + "/projects/" + log.projectId + "/routes/" + log.routeId} class="log-route">Route</a>
            {:else}
              <span class="log-route">—</span>
            {/if}
          </li>
        {/each}
      </ul>
      <p><a href={DASHBOARD_BASE + "/logs"} class="btn btn-secondary">Open Logs & Traces</a></p>
    {/if}
  </section>
  {/if}
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
    border-left-color: var(--rm-sage);
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
  .empty-state {
    background: var(--rm-surface-raised);
    border: 1px solid var(--rm-border);
    border-radius: var(--rm-radius);
    padding: var(--space-6);
  }
  .empty-title {
    font-weight: 600;
    margin: 0 0 var(--space-2);
  }
  .empty-desc {
    color: var(--rm-muted);
    font-size: var(--text-sm);
    margin: 0 0 var(--space-4);
  }
  .btn {
    padding: var(--space-2) var(--space-4);
    border-radius: var(--rm-radius);
    font-size: var(--text-sm);
    font-weight: 500;
    text-decoration: none;
    display: inline-block;
    margin-right: var(--space-2);
    border: none;
    cursor: pointer;
  }
  .btn-primary {
    background: var(--rm-sage);
    color: var(--rm-bg);
  }
  .btn-secondary {
    background: var(--rm-surface);
    color: var(--rm-text);
    border: 1px solid var(--rm-border);
  }
  .section {
    margin-bottom: var(--space-6);
  }
  .section-title {
    font-size: var(--text-base);
    font-weight: 600;
    color: var(--rm-text);
    margin: 0 0 var(--space-1);
  }
  .section-desc {
    color: var(--rm-muted);
    font-size: var(--text-sm);
    margin: 0 0 var(--space-3);
  }
  .metrics {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(8rem, 1fr));
    gap: var(--space-4);
    margin-bottom: var(--space-2);
  }
  .metric {
    background: var(--rm-surface-raised);
    border: 1px solid var(--rm-border);
    border-radius: var(--rm-radius);
    padding: var(--space-3);
  }
  .metric-value {
    display: block;
    font-size: var(--text-lg);
    font-weight: 600;
    color: var(--rm-text);
  }
  .metric-label {
    font-size: var(--text-xs);
    color: var(--rm-muted);
  }
  .muted {
    font-size: var(--text-sm);
    color: var(--rm-dim);
  }
  .mix-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(14rem, 1fr));
    gap: var(--space-4);
  }
  .mix-card {
    background: var(--rm-surface-raised);
    border: 1px solid var(--rm-border);
    border-radius: var(--rm-radius);
    padding: var(--space-3);
  }
  .mix-title {
    font-size: var(--text-sm);
    font-weight: 600;
    margin: 0 0 var(--space-2);
  }
  .mix-list {
    list-style: none;
    padding: 0;
    margin: 0;
  }
  .period-links {
    font-size: var(--text-sm);
    color: var(--rm-muted);
    margin: 0 0 var(--space-4);
  }
  .period-label {
    margin-right: var(--space-2);
  }
  .period-link {
    color: var(--rm-sage);
    text-decoration: none;
    margin-right: var(--space-2);
  }
  .period-link:hover {
    text-decoration: underline;
  }
  .period-link.active {
    font-weight: 600;
    color: var(--rm-text);
  }
  .mix-list li {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--space-1) 0;
    font-size: var(--text-sm);
  }
  .mix-list-item-route {
    flex-wrap: wrap;
    gap: var(--space-1);
  }
  .mix-route-primary {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex: 1;
    min-width: 0;
  }
  .mix-sublink {
    font-size: var(--text-xs);
    color: var(--rm-sage);
    text-decoration: none;
  }
  .mix-sublink:hover {
    text-decoration: underline;
  }
  .mix-name, .mix-link {
    color: var(--rm-text);
  }
  .mix-link {
    text-decoration: none;
  }
  .mix-link:hover {
    text-decoration: underline;
  }
  .mix-count {
    color: var(--rm-muted);
    font-variant-numeric: tabular-nums;
  }
  .log-list {
    list-style: none;
    padding: 0;
    margin: 0;
  }
  .log-row {
    display: grid;
    grid-template-columns: auto auto 6rem 8rem 5rem auto;
    gap: var(--space-3);
    align-items: center;
    padding: var(--space-2) 0;
    border-bottom: 1px solid var(--rm-border);
    font-size: var(--text-sm);
  }
  .log-time {
    color: var(--rm-muted);
    white-space: nowrap;
  }
  .log-status {
    font-variant-numeric: tabular-nums;
  }
  .log-provider, .log-model {
    color: var(--rm-text);
  }
  .log-latency {
    color: var(--rm-muted);
    font-variant-numeric: tabular-nums;
  }
  .log-route {
    font-size: var(--text-xs);
    color: var(--rm-sage);
  }
  .loading-msg {
    color: var(--rm-muted);
    font-size: var(--text-sm);
  }
</style>
