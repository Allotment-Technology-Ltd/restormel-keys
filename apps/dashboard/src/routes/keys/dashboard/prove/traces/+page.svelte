<script lang="ts">
  /**
   * R5: Prove / Traces tab.
   * Ingest provenance trace list — newest-first, export per trace.
   * The GET /connect/v1/traces list endpoint is not yet available (deferred).
   * Renders an honest absent-state per rubric R5-S2 until the endpoint ships.
   * No trace-detail visualisation (out of scope, not a placeholder gap).
   */
  import { invalidateAll } from "$app/navigation";
  import SignInNotice from "$lib/components/connect/SignInNotice.svelte";
  import BrutalErrorBanner from "$lib/components/brutalist/BrutalErrorBanner.svelte";
  import type { TraceRow, TracesPageData } from "./+page.server";

  let retrying = false;
  async function retry() {
    retrying = true;
    try {
      await invalidateAll();
    } finally {
      retrying = false;
    }
  }

  export let data: TracesPageData;

  function formatDate(ts: number): string {
    return new Date(ts).toLocaleString();
  }

  function statusLabel(status: TraceRow["status"]): string {
    if (status === "ok") return "Complete";
    if (status === "error") return "Error";
    return "Partial";
  }

  function statusClass(status: TraceRow["status"]): string {
    if (status === "ok") return "status-ok";
    if (status === "error") return "status-error";
    return "status-partial";
  }
</script>

<svelte:head>
  <title>Prove — Traces – Restormel Dashboard</title>
  <meta name="robots" content="noindex, nofollow" />
</svelte:head>

<h1 class="page-title">Traces</h1>
<p class="page-desc">
  Ingest provenance traces — a record of each pipeline stage run: what was processed, which models were used, and whether each stage completed cleanly.
  Use this to understand what happened during an ingest run and export records for external audit.
</p>

{#if !data.signedIn}
  <SignInNotice message="Sign in to view ingest traces." />
{:else if data.endpointStatus === "error"}
  <BrutalErrorBanner
    title="Traces unavailable"
    message="Could not load traces. This is a load failure — your data is unaffected."
  >
    {#snippet actions()}
      <button type="button" class="btn btn-primary btn-sm" disabled={retrying} on:click={retry}>
        {retrying ? "Retrying…" : "Try again"}
      </button>
    {/snippet}
  </BrutalErrorBanner>
{:else if data.endpointStatus === "absent" || data.traces.length === 0}
  <div class="absent-state" role="status">
    <p class="absent-title">Trace list not yet available</p>
    <p class="absent-body">
      The <code class="inline-code">GET /connect/v1/traces</code> endpoint that backs this view is not yet shipped.
      Traces are recorded in the provenance store during ingest runs — this tab will list them newest-first
      with per-trace export once the endpoint is available. No data is missing; it is simply not yet surfaced here.
    </p>
    <p class="absent-body">
      To inspect traces today: run an ingest and check the <a href="/keys/dashboard/runs" class="btn-link">Runs</a> view
      for status, or query the <code class="inline-code">connect_provenance_traces</code> table directly if you have database access.
    </p>
  </div>
{:else}
  <table class="traces-table">
    <thead>
      <tr>
        <th scope="col">Started</th>
        <th scope="col">Stage</th>
        <th scope="col">Duration</th>
        <th scope="col">Status</th>
        <th scope="col">Export</th>
      </tr>
    </thead>
    <tbody>
      {#each data.traces as trace (trace.id)}
        <tr>
          <td class="trace-time">{formatDate(trace.startedAt)}</td>
          <td class="trace-stage">{trace.stage}</td>
          <td class="trace-dur">{trace.durationMs != null ? `${trace.durationMs} ms` : "—"}</td>
          <td>
            <span class="trace-status {statusClass(trace.status)}">{statusLabel(trace.status)}</span>
          </td>
          <td>
            {#if trace.exportHref}
              <a href={trace.exportHref} class="btn-link" download>Export</a>
            {:else}
              <span class="muted">—</span>
            {/if}
          </td>
        </tr>
      {/each}
    </tbody>
  </table>
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
    margin: 0 0 var(--space-5);
    max-width: 46rem;
  }
  .absent-state {
    border: var(--border);
    padding: var(--space-5);
    max-width: 46rem;
  }
  .absent-title {
    font-family: var(--font-mono);
    font-size: var(--text-mono-lg);
    font-weight: 700;
    color: var(--color-ink);
    margin: 0 0 var(--space-3);
  }
  .absent-body {
    font-size: var(--text-sm);
    color: var(--rm-muted);
    margin: 0 0 var(--space-3);
    line-height: 1.6;
  }
  .absent-body:last-child {
    margin-bottom: 0;
  }
  .inline-code {
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    background: var(--rm-surface);
    padding: 0.1rem 0.35rem;
    border: var(--border-thin);
    color: var(--rm-text);
  }
  .btn-link {
    font-size: var(--text-sm);
    color: var(--rm-sage);
    text-decoration: none;
    font-weight: 500;
  }
  .btn-link:hover {
    text-decoration: underline;
  }
  .traces-table {
    width: 100%;
    border-collapse: collapse;
    font-size: var(--text-sm);
  }
  .traces-table th {
    text-align: left;
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    font-weight: 700;
    color: var(--color-ink);
    padding: var(--space-2) var(--space-3);
    border-bottom: var(--border);
    white-space: nowrap;
  }
  .traces-table td {
    padding: var(--space-2) var(--space-3);
    border-bottom: var(--border-thin);
    color: var(--rm-muted);
    vertical-align: middle;
  }
  .trace-time {
    white-space: nowrap;
    font-size: var(--text-xs);
    color: var(--rm-dim);
  }
  .trace-stage {
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    color: var(--color-ink);
  }
  .trace-dur {
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
  }
  .trace-status {
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    padding: 0.1rem 0.4rem;
    border: var(--border-thin);
  }
  .status-ok {
    color: var(--signal-teal);
    border-color: color-mix(in oklab, var(--signal-teal) 55%, var(--rm-border));
  }
  .status-error {
    color: var(--coral-alert);
    border-color: color-mix(in oklab, var(--coral-alert) 55%, var(--rm-border));
  }
  .status-partial {
    color: var(--amber-insight);
    border-color: color-mix(in oklab, var(--amber-insight) 55%, var(--rm-border));
  }
  .muted {
    color: var(--rm-dim);
  }
</style>
