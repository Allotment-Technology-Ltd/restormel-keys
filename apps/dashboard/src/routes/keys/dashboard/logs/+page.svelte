<script lang="ts">
  import { DASHBOARD_BASE } from "$lib/dashboard-base";
  import { goto } from "$app/navigation";
  import { onMount } from "svelte";
  import {
    TIME_PRESETS,
    SOURCE_OPTIONS,
    logFiltersToQuery,
    classifyLogSource,
    sourceBucketLabel,
    receiptOutcome,
    isFailureStatus,
    failureExplanation,
    receiptPolicyChecks,
    type LogRow,
    type TimePreset,
    type SourceBucket,
    type NamedOption,
  } from "$lib/logs-filters";

  export let data: {
    logs: LogRow[];
    filter:
      | {
          projectId: string | null;
          routeId: string | null;
          status: string | null;
          source: SourceBucket | null;
          time: TimePreset;
          q: string | null;
          projectName: string | null;
          routeName: string | null;
        }
      | null;
    controls: {
      projectOptions: NamedOption[];
      routeOptions: NamedOption[];
      availableStatuses: string[];
      time: TimePreset;
      limit: number;
      source: SourceBucket | null;
      status: string | null;
      q: string | null;
    };
    counts: { matched: number; windowTotal: number };
    hasFilters: boolean;
    error: string | null;
  };

  let projectFilter = data.filter?.projectId ?? "";
  let routeFilter = data.filter?.routeId ?? "";
  let statusFilter = data.controls.status ?? "";
  let sourceFilter: SourceBucket | "" = data.controls.source ?? "";
  let timeFilter: TimePreset = data.controls.time ?? "7d";
  let qFilter = data.controls.q ?? "";
  let limitFilter = String(data.controls.limit ?? 100);

  let selectedLog: LogRow | null = null;
  let expandedFixLogId: string | null = null;
  const LOGS_VISITED_KEY = "restormel_logs_visited";
  const LOGS_BANNER_DISMISSED_KEY = "rk_logs_banner_dismissed";
  let showGatewayBanner = true;

  onMount(() => {
    localStorage.setItem(LOGS_VISITED_KEY, "true");
    showGatewayBanner = localStorage.getItem(LOGS_BANNER_DISMISSED_KEY) !== "true";
    // Deep-link: open the receipt for #log-<id> if present.
    const hash = window.location.hash;
    if (hash.startsWith("#log-")) {
      const id = hash.slice("#log-".length);
      const found = data.logs.find((l) => l.id === id);
      if (found) selectedLog = found;
    }
  });

  function formatTime(ts: number): string {
    return new Date(ts).toLocaleString();
  }

  function statusClass(status: string): string {
    const o = receiptOutcome(status);
    if (o === "resolved") return "status-resolved";
    if (o === "blocked") return "status-policy";
    if (o === "no_route") return "status-no-route";
    if (o === "failed" || o === "limited") return "status-failed";
    return "status-other";
  }

  function applyFilters() {
    const query = logFiltersToQuery({
      projectId: projectFilter || null,
      routeId: routeFilter || null,
      status: statusFilter || null,
      source: (sourceFilter || null) as SourceBucket | null,
      time: timeFilter,
      q: qFilter.trim() || null,
      limit: parseInt(limitFilter, 10) || 100,
    });
    goto(`${DASHBOARD_BASE}/logs${query ? "?" + query : ""}`);
  }

  function fixNoRouteHref(log: LogRow): string {
    const params = new URLSearchParams();
    params.set("newRoute", "true");
    if (log.environmentId) params.set("env", log.environmentId);
    if (log.finalModelId) params.set("model", log.finalModelId);
    return `${DASHBOARD_BASE}/routes?${params.toString()}`;
  }

  function toggleFixPanel(logId: string) {
    expandedFixLogId = expandedFixLogId === logId ? null : logId;
  }

  function dismissGatewayBanner() {
    showGatewayBanner = false;
    localStorage.setItem(LOGS_BANNER_DISMISSED_KEY, "true");
  }

  function openLogDetail(log: LogRow) {
    selectedLog = log;
    // Make the open receipt deep-linkable without a navigation/reload.
    if (typeof history !== "undefined") {
      history.replaceState(history.state, "", `${DASHBOARD_BASE}/logs${window.location.search}#log-${log.id}`);
    }
  }

  function closeLogDetail() {
    selectedLog = null;
    if (typeof history !== "undefined") {
      history.replaceState(history.state, "", `${DASHBOARD_BASE}/logs${window.location.search}`);
    }
  }

  function copyRowLink(log: LogRow) {
    const link = `${window.location.origin}${DASHBOARD_BASE}/logs${window.location.search}#log-${log.id}`;
    void navigator.clipboard?.writeText(link).catch(() => {});
  }

  function routeBuilderHref(log: LogRow): string {
    return `${DASHBOARD_BASE}/projects/${log.projectId}/routes/${log.routeId}`;
  }

  // ----- Export (current filtered set; already server-capped at the limit) -----
  const EXPORT_FIELDS: (keyof LogRow)[] = [
    "id",
    "createdAt",
    "requestStatus",
    "providerType",
    "finalModelId",
    "routeId",
    "projectId",
    "environmentId",
    "gatewayKeyId",
    "latencyMs",
    "ttftMs",
    "inputTokens",
    "outputTokens",
    "estimatedCost",
    "fallbackCount",
    "errorCode",
    "source",
  ];

  function download(filename: string, mime: string, content: string) {
    const blob = new Blob([content], { type: mime });
    const href = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = href;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(href);
  }

  function exportJson() {
    download("restormel-logs.json", "application/json", JSON.stringify(data.logs, null, 2));
  }

  function csvCell(v: unknown): string {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }

  function exportCsv() {
    const header = EXPORT_FIELDS.join(",");
    const lines = data.logs.map((row) => EXPORT_FIELDS.map((f) => csvCell(row[f])).join(","));
    download("restormel-logs.csv", "text/csv", [header, ...lines].join("\n"));
  }

  function onWindowKeydown(e: KeyboardEvent) {
    if (e.key === "Escape" && selectedLog) {
      e.preventDefault();
      closeLogDetail();
    }
  }
</script>

<svelte:window on:keydown={onWindowKeydown} />

<h1 class="page-title">Logs &amp; Traces</h1>
<p class="page-desc">
  Request logs captured by Restormel (Dashboard API resolve path + Connect ingest resolves). Each row
  expands to its full receipt; failures are tagged with what went wrong. For summaries, see
  <a href={DASHBOARD_BASE + "/analytics"}>Usage &amp; Analytics</a>.
</p>
{#if showGatewayBanner}
  <div class="notice notice-info" role="status">
    <div>
      <strong>ℹ Gateway logs note:</strong> This page shows Restormel request logs. If your execution layer is OpenRouter/Portkey/Vercel and traffic does not flow through Restormel, import gateway logs/usage exports via <a href={DASHBOARD_BASE + "/integrations"}>Connections</a>.
    </div>
    <button type="button" class="notice-dismiss" aria-label="Dismiss info banner" onclick={dismissGatewayBanner}>×</button>
  </div>
{/if}

<form class="filter-bar" onsubmit={(e) => { e.preventDefault(); applyFilters(); }} aria-label="Log filters">
  <label>
    Project
    <select bind:value={projectFilter}>
      <option value="">Any project</option>
      {#each data.controls.projectOptions as p}
        <option value={p.id}>{p.name}</option>
      {/each}
    </select>
  </label>
  <label>
    Route
    <select bind:value={routeFilter}>
      <option value="">All routes</option>
      {#each data.controls.routeOptions as r}
        <option value={r.id}>{r.name}</option>
      {/each}
    </select>
  </label>
  <label>
    Status
    <select bind:value={statusFilter}>
      <option value="">Any status</option>
      {#each data.controls.availableStatuses as s}
        <option value={s}>{s === "no_route" ? "No matching route" : s}</option>
      {/each}
    </select>
  </label>
  <label>
    Source
    <select bind:value={sourceFilter}>
      <option value="">Any source</option>
      {#each SOURCE_OPTIONS as o}
        <option value={o.value}>{o.label}</option>
      {/each}
    </select>
  </label>
  <label>
    Time
    <select bind:value={timeFilter}>
      {#each TIME_PRESETS as t}
        <option value={t.value}>{t.label}</option>
      {/each}
    </select>
  </label>
  <label class="filter-search">
    Search
    <input type="search" bind:value={qFilter} placeholder="status, model, route, error…" />
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

<p class="muted-note">
  Free-text search scans status, provider, model, route id, error code, source, and the resolve explanation
  (no full-text index — see PR notes). <code>status</code> and <code>source</code> are matched after the
  time/route window.
</p>

{#if data.filter}
  <p class="filter-msg" role="status">
    Showing
    <strong>{data.counts.matched}</strong>
    of {data.counts.windowTotal} in window
    {#if data.filter.projectName || data.filter.projectId}
      · project <code>{data.filter.projectName ?? data.filter.projectId}</code>
    {/if}
    {#if data.filter.routeId}
      · <a href={DASHBOARD_BASE + "/projects/" + data.filter.projectId + "/routes/" + data.filter.routeId}
        >route {data.filter.routeName ?? data.filter.routeId.slice(0, 8) + "…"}</a>
    {/if}
    {#if data.filter.status}· status <code>{data.filter.status}</code>{/if}
    {#if data.filter.source}· source <code>{sourceBucketLabel(data.filter.source)}</code>{/if}
    {#if data.filter.q}· “{data.filter.q}”{/if}
    · <a href={DASHBOARD_BASE + "/logs"}>Clear filters</a>
  </p>
{/if}

{#if data.error}
  <p class="error-msg" role="alert">
    {data.error} · <a href={DASHBOARD_BASE + "/logs"}>Try again</a>
  </p>
{:else if data.logs.length === 0}
  {#if data.hasFilters}
    <p class="empty-msg" role="status">
      No requests match these filters in this time window. Widen the time range or
      <a href={DASHBOARD_BASE + "/logs"}>clear filters</a> to see all traffic.
    </p>
  {:else}
    <p class="empty-msg" role="status">No request logs in this time window. Traffic through resolved routes (and Connect ingest resolves) will appear here.</p>
    <p><a href={DASHBOARD_BASE + "/analytics"}>Usage &amp; Analytics</a> · <a href={DASHBOARD_BASE + "/routes"}>Routes</a></p>
  {/if}
{:else}
  <div class="list-toolbar">
    <span class="muted">{data.counts.matched} {data.counts.matched === 1 ? "row" : "rows"} (capped at {limitFilter})</span>
    <span class="export-actions">
      <button type="button" class="btn-export" onclick={exportCsv}>Export CSV</button>
      <button type="button" class="btn-export" onclick={exportJson}>Export JSON</button>
    </span>
  </div>
  <ul class="log-list">
    {#each data.logs as log (log.id)}
      <li
        id={"log-" + log.id}
        class="log-row-wrap"
        class:log-row-no-route={log.requestStatus === "no_route"}
        class:log-row-failed={isFailureStatus(log.requestStatus) && log.requestStatus !== "no_route"}
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
          {#if log.errorCode}
            <span class="log-error" title="error code">{log.errorCode}</span>
          {/if}
          {#if log.routeId}
            <span class="log-link">route: {log.routeId.slice(0, 8)}…</span>
          {/if}
          <span class="log-source" class:log-source-connect={log.source === "connect_ingest"}>
            {sourceBucketLabel(classifyLogSource(log))}
          </span>
        </button>
        {#if log.requestStatus === "no_route"}
          <button type="button" class="log-fix-link" onclick={() => toggleFixPanel(log.id)}>Fix?</button>
        {/if}
        {#if log.requestStatus === "no_route" && expandedFixLogId === log.id}
          <div class="no-route-fix-panel" role="region" aria-label="Suggested fix for no matching route">
            <p>
              This request did not match any route. The model requested was:
              <strong>{log.finalModelId ?? "unknown"}</strong>.
            </p>
            <p class="fix-panel-lead">
              <strong>Automated fix:</strong> Open the new-route wizard with this request’s environment and model
              pre-filled. Nothing is saved until you finish the wizard.
            </p>
            <div class="fix-panel-actions">
              <button type="button" class="btn-fix-approve" onclick={() => { expandedFixLogId = null; void goto(fixNoRouteHref(log)); }}>
                Approve — open wizard
              </button>
              <button type="button" class="btn-fix-reject" onclick={() => (expandedFixLogId = null)}>Not now</button>
              <a
                href={DASHBOARD_BASE + "/routes"}
                class="btn-fix-diy"
                onclick={() => { expandedFixLogId = null; }}>I’ll fix it myself →</a>
            </div>
            <p class="fix-panel-docs">
              <a href="/keys/docs/walkthrough/phase-2-resolve">Why no_route happens →</a>
            </p>
          </div>
        {/if}
      </li>
    {/each}
  </ul>
{/if}

{#if selectedLog}
  <div class="detail-backdrop" role="presentation" onclick={closeLogDetail}></div>
  <div class="detail-panel" role="dialog" aria-modal="true" aria-labelledby="request-detail-title">
    <header class="detail-header">
      <h2 id="request-detail-title">Request receipt</h2>
      <div class="detail-header-actions">
        <button type="button" class="detail-copy" onclick={() => copyRowLink(selectedLog!)} aria-label="Copy deep link to this request">Copy link</button>
        <button type="button" class="detail-close" onclick={closeLogDetail} aria-label="Close request receipt">×</button>
      </div>
    </header>
    <div class="detail-body">
      <!-- 1. Request -->
      <section class="receipt-section">
        <h3 class="receipt-h">1 · Request</h3>
        <p><strong>When:</strong> {formatTime(selectedLog.createdAt)}</p>
        <p><strong>Source:</strong> {sourceBucketLabel(classifyLogSource(selectedLog))}{#if selectedLog.metadata?.stage} · stage <code>{selectedLog.metadata.stage}</code>{/if}</p>
        <p><strong>Model requested:</strong> {selectedLog.finalModelId ?? "Not recorded in log row"}</p>
      </section>

      <!-- 2. Route matched -->
      <section class="receipt-section">
        <h3 class="receipt-h">2 · Route matched</h3>
        <p>
          {#if selectedLog.routeId}
            <a href={routeBuilderHref(selectedLog)}>Open route builder ↗</a> ({selectedLog.routeId.slice(0, 8)}…)
          {:else}
            No route matched this request.
          {/if}
        </p>
        <p><strong>Provider resolved:</strong> {selectedLog.providerType}</p>
      </section>

      <!-- 3. Policy outcomes -->
      <section class="receipt-section">
        <h3 class="receipt-h">3 · Policy outcomes</h3>
        {#if receiptPolicyChecks(selectedLog).length > 0}
          <ul>
            {#each receiptPolicyChecks(selectedLog) as check}
              <li>{check.label}</li>
            {/each}
          </ul>
        {:else}
          <p class="muted">No policy check recorded for this request.</p>
        {/if}
      </section>

      <!-- 4. Step attempts / timing -->
      <section class="receipt-section">
        <h3 class="receipt-h">4 · Step attempts &amp; timing</h3>
        <p>
          <strong>Attempts:</strong>
          {#if selectedLog.fallbackCount != null}
            {selectedLog.fallbackCount + 1} (incl. {selectedLog.fallbackCount} fallback{selectedLog.fallbackCount === 1 ? "" : "s"})
          {:else}
            1 (no fallback recorded)
          {/if}
        </p>
        <p>
          <strong>Latency:</strong> total {selectedLog.latencyMs} ms{#if selectedLog.ttftMs != null} · resolve/TTFT {selectedLog.ttftMs} ms{:else} · resolve time not recorded{/if}
        </p>
      </section>

      <!-- 5. Response / error -->
      <section class="receipt-section">
        <h3 class="receipt-h">5 · {isFailureStatus(selectedLog.requestStatus) ? "What went wrong" : "Response"}</h3>
        <p>
          <strong>Outcome:</strong>
          <span class={`log-status ${statusClass(selectedLog.requestStatus)}`}>{selectedLog.requestStatus}</span>
        </p>
        {#if isFailureStatus(selectedLog.requestStatus)}
          <p class="failure-line">{failureExplanation(selectedLog)}</p>
          {#if selectedLog.errorCode}<p><strong>Error code:</strong> <code>{selectedLog.errorCode}</code></p>{/if}
        {:else if selectedLog.metadata?.explanation}
          <p class="muted">{selectedLog.metadata.explanation}</p>
        {/if}
        {#if selectedLog.inputTokens != null || selectedLog.outputTokens != null || selectedLog.estimatedCost != null}
          <p class="muted">
            tokens in {selectedLog.inputTokens ?? "—"} / out {selectedLog.outputTokens ?? "—"}{#if selectedLog.estimatedCost != null} · est. ${selectedLog.estimatedCost.toFixed(4)}{/if}
          </p>
        {/if}
      </section>

      <!-- Coverage note: honest about what the engine does and does not record. -->
      <p class="coverage-note">
        Receipt fields are populated from the request-log row + its metadata. Fields marked “not recorded”
        were not captured at the failure site. <a href="/keys/docs/walkthrough/phase-2-resolve">How resolve logging works ↗</a>
      </p>
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
  .notice-info {
    border-left-color: var(--path-blue);
    background: color-mix(in oklab, var(--path-blue) 12%, var(--rm-surface));
    color: var(--rm-text);
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: var(--space-3);
  }
  .notice-dismiss {
    border: 1px solid var(--rm-border);
    border-radius: var(--rm-radius);
    background: transparent;
    color: var(--rm-muted);
    line-height: 1;
    padding: 0.1rem 0.4rem;
  }
  .notice a { color: var(--rm-sage); font-weight: 500; }
  .error-msg {
    color: var(--coral-alert);
    font-size: var(--text-sm);
  }
  .error-msg a { color: var(--rm-sage); }
  .empty-msg {
    color: var(--rm-muted);
    font-size: var(--text-sm);
  }
  .empty-msg a { color: var(--rm-sage); }
  .muted-note {
    font-size: var(--text-xs);
    color: var(--rm-dim);
    margin: 0 0 var(--space-3);
  }
  .muted-note code {
    background: var(--rm-surface);
    padding: 1px 4px;
    border-radius: 4px;
  }
  .list-toolbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: var(--space-3);
    margin: 0 0 var(--space-2);
    flex-wrap: wrap;
  }
  .export-actions {
    display: flex;
    gap: var(--space-2);
  }
  .btn-export {
    font-size: var(--text-xs);
    border: 1px solid var(--rm-border);
    background: var(--rm-surface);
    color: var(--rm-text);
    padding: var(--space-1) var(--space-2);
    border-radius: var(--rm-radius);
    cursor: pointer;
  }
  .btn-export:hover { background: var(--rm-bg); }
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
    scroll-margin-top: var(--space-6);
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
    font-family: var(--rm-font-mono, ui-monospace, monospace);
    color: var(--rm-muted);
    white-space: nowrap;
  }
  .log-status, .log-provider, .log-model {
    color: var(--rm-text);
  }
  .log-latency, .log-tokens {
    font-family: var(--rm-font-mono, ui-monospace, monospace);
    color: var(--rm-muted);
    font-variant-numeric: tabular-nums;
  }
  .log-error {
    font-family: var(--rm-font-mono, ui-monospace, monospace);
    font-size: var(--text-xs);
    color: var(--coral-alert);
  }
  .log-link {
    color: var(--rm-sage);
    font-size: var(--text-xs);
  }
  .log-source {
    font-family: var(--rm-font-mono, ui-monospace, monospace);
    font-size: var(--text-xs);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--rm-muted);
    border: 1px solid var(--rm-border, currentColor);
    padding: 0 var(--space-1, 0.25rem);
    margin-left: auto;
  }
  .log-source-connect {
    color: var(--rm-text);
    border-color: var(--rm-text, currentColor);
  }
  .log-fix-link {
    color: var(--amber-insight);
    font-size: var(--text-xs);
    font-weight: 600;
    border: none;
    background: transparent;
    padding: 0;
  }
  .log-row-no-route {
    border-left: 4px solid var(--amber-insight);
    background: color-mix(in oklab, var(--amber-insight) 14%, transparent);
    padding-left: var(--space-2);
  }
  .log-row-failed {
    border-left: 4px solid var(--coral-alert);
    background: color-mix(in oklab, var(--coral-alert) 10%, transparent);
    padding-left: var(--space-2);
  }
  .fix-panel-lead {
    margin: var(--space-2) 0;
    font-size: var(--text-sm);
    color: var(--rm-text);
  }
  .fix-panel-actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2);
    margin: var(--space-3) 0 var(--space-2);
  }
  .btn-fix-approve {
    padding: var(--space-2) var(--space-3);
    border-radius: var(--rm-radius);
    border: none;
    background: var(--color-yellow);
    color: var(--color-ink);
    font-size: var(--text-sm);
    font-weight: 500;
    cursor: pointer;
  }
  .btn-fix-approve:hover { filter: brightness(1.05); }
  .btn-fix-reject {
    padding: var(--space-2) var(--space-3);
    border-radius: var(--rm-radius);
    border: 1px solid var(--rm-border);
    background: var(--rm-surface);
    color: var(--rm-text);
    font-size: var(--text-sm);
    cursor: pointer;
  }
  .btn-fix-diy {
    font-size: var(--text-sm);
    color: var(--rm-sage);
    text-decoration: none;
  }
  .btn-fix-diy:hover { text-decoration: underline; }
  .fix-panel-docs { margin: 0; font-size: var(--text-xs); }
  .fix-panel-docs a { color: var(--rm-sage); }
  .no-route-fix-panel {
    width: 100%;
    border: 1px solid var(--rm-border);
    border-radius: var(--rm-radius);
    background: var(--rm-surface);
    padding: var(--space-2);
    font-size: var(--text-sm);
    color: var(--rm-muted);
  }
  .no-route-fix-panel p { margin: 0 0 var(--space-1); }
  .no-route-fix-panel p:last-child { margin-bottom: 0; }
  .no-route-fix-panel a { color: var(--rm-sage); }
  .muted {
    font-size: var(--text-sm);
    color: var(--rm-dim);
  }
  .filter-msg {
    font-size: var(--text-sm);
    color: var(--rm-muted);
    margin: 0 0 var(--space-3);
  }
  .filter-msg a { color: var(--rm-sage); }
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
    margin: 0 0 var(--space-2);
  }
  .filter-bar label {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: var(--text-xs);
    color: var(--rm-muted);
  }
  .filter-bar select,
  .filter-bar input {
    min-width: 9rem;
    border: 1px solid var(--rm-border);
    border-radius: var(--rm-radius);
    background: var(--rm-bg);
    color: var(--rm-text);
    padding: var(--space-2);
    font-size: var(--text-sm);
  }
  .filter-search input { min-width: 12rem; }
  .btn-apply, .btn-clear {
    padding: var(--space-2) var(--space-3);
    border-radius: var(--rm-radius);
    font-size: var(--text-sm);
    text-decoration: none;
  }
  .btn-apply {
    border: 1px solid var(--rm-border);
    background: var(--color-yellow);
    color: var(--color-ink);
  }
  .btn-clear {
    border: 1px solid var(--rm-border);
    color: var(--rm-muted);
  }
  .status-resolved { color: var(--signal-teal); font-weight: 600; }
  .status-policy { color: var(--amber-insight); font-weight: 600; }
  .status-no-route { color: var(--coral-alert); font-weight: 600; }
  .status-failed { color: var(--coral-alert); font-weight: 600; }
  .status-other { color: var(--rm-dim); font-weight: 600; }
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
    width: min(32rem, 100vw);
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
  .detail-header-actions { display: flex; align-items: center; gap: var(--space-2); }
  .detail-copy {
    border: 1px solid var(--rm-border);
    background: var(--rm-surface);
    color: var(--rm-text);
    font-size: var(--text-xs);
    padding: var(--space-1) var(--space-2);
    border-radius: var(--rm-radius);
    cursor: pointer;
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
    gap: var(--space-4);
  }
  .receipt-section { display: grid; gap: var(--space-1); }
  .receipt-h {
    margin: 0 0 var(--space-1);
    font-size: var(--text-xs);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--rm-muted);
    font-family: var(--rm-font-mono, ui-monospace, monospace);
  }
  .detail-body p {
    margin: 0;
    font-size: var(--text-sm);
    color: var(--rm-muted);
  }
  .detail-body strong { color: var(--rm-text); }
  .detail-body a { color: var(--rm-sage); }
  .detail-body ul {
    margin: var(--space-1) 0 0;
    padding-left: 1.25rem;
    color: var(--rm-muted);
    font-size: var(--text-sm);
  }
  .detail-body code {
    font-size: var(--text-xs);
    background: var(--rm-surface);
    padding: 1px 5px;
    border-radius: 4px;
  }
  .failure-line { color: var(--coral-alert) !important; }
  .coverage-note {
    font-size: var(--text-xs);
    color: var(--rm-dim);
    border-top: 1px solid var(--rm-border);
    padding-top: var(--space-2);
  }
  .coverage-note a { color: var(--rm-sage); }
</style>
