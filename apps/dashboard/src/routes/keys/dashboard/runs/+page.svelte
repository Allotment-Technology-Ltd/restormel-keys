<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { goto } from "$app/navigation";
  import { browser } from "$app/environment";
  import BrutalLoadingState from "$lib/components/brutalist/BrutalLoadingState.svelte";
  import BrutalErrorBanner from "$lib/components/brutalist/BrutalErrorBanner.svelte";
  import SignInNotice from "$lib/components/connect/SignInNotice.svelte";
  import { DASHBOARD_BASE } from "$lib/dashboard-base";
  import { pipelineWizardHref } from "$lib/connect/pipeline-config";
  import { RUNS_HREF } from "$lib/nav-config";
  import { isJobStuck } from "$lib/connect/ingest-runs-safety";
  import DossierRail from "$lib/components/dashboard/DossierRail.svelte";
  import RunQuickPeek from "$lib/components/dashboard/RunQuickPeek.svelte";
  import { liveRunJobs, startLiveRunPoll } from "$lib/stores/live-run-poll";
  import type { LiveRunChipJob } from "$lib/connect/live-run-chip";

  const API = DASHBOARD_BASE + "/api/connect/ingest/jobs";
  const NEW_RUN_HREF = pipelineWizardHref("launch");
  const PAGE_SIZE = 20;

  type Job = {
    id: string;
    status: string;
    label?: string;
    created_at: string;
    updated_at: string;
    current_stage?: string;
    progress?: { percent?: number } | null;
    /** Stage 1.6 durable-run fields */
    worker_heartbeat_at?: number | null;
    lease_expires_at?: number | null;
    reclaim_count?: number;
  };

  // DossierRail quick-peek (R6): the rail's first live consumer.
  let peekJob: Job | null = null;
  let peekOpen = false;
  function openPeek(job: Job) {
    peekJob = job;
    peekOpen = true;
  }

  let loading = true;
  let error: string | null = null;
  let signedOut = false;
  let jobs: Job[] = [];
  let statusFilter = "all";
  let bulkCleaning = false;
  let bulkCleanError: string | null = null;
  let bulkCleanResult: { cancelled: number; deleted: number } | null = null;
  let deletingIds = new Set<string>();

  // W3.1 pagination — honest cursor + total ("showing N of M").
  let nextCursor: string | null = null;
  let totalCount = 0;
  let loadingMore = false;

  // W3.1 live status — MAJOR-5: consume the SAME workspace stream the topbar chip
  // already holds (`liveRunJobs` / `startLiveRunPoll`) instead of opening a second
  // identical SSE channel per viewer. One workspace stream per viewer, shared with
  // the chip; the store transparently handles the SSE→30s-poll fallback, so the
  // list never needs its own degraded note (the chip is the canonical indicator).
  let stopLive: (() => void) | null = null;
  let unsubscribeLive: (() => void) | null = null;

  $: filtered = statusFilter === "all" ? jobs : jobs.filter((j) => j.status === statusFilter);
  $: stuckCount = jobs.filter(isJobStuck).length;
  $: hasMore = nextCursor != null;

  /** Patch one run from the shared live store into the list (in place; never reorders). */
  function patchLiveJob(incoming: LiveRunChipJob) {
    const idx = jobs.findIndex((j) => j.id === incoming.id);
    if (idx === -1) return; // not on the loaded page(s) — Refresh surfaces brand-new runs
    const next = jobs.slice();
    next[idx] = { ...next[idx], ...incoming } as Job;
    jobs = next;
  }

  function startLive() {
    if (!browser || stopLive) return;
    stopLive = startLiveRunPoll();
    // Patch loaded rows whenever the shared workspace stream pushes new state.
    unsubscribeLive = liveRunJobs.subscribe((live) => {
      if (live) for (const j of live) patchLiveJob(j);
    });
  }

  async function load() {
    loading = true;
    error = null;
    signedOut = false;
    bulkCleanResult = null;
    nextCursor = null;
    try {
      const res = await fetch(`${API}?limit=${PAGE_SIZE}`);
      if (res.status === 401) {
        signedOut = true;
        jobs = [];
        return;
      }
      if (!res.ok) {
        error = `Could not load ingest runs (HTTP ${res.status}).`;
        return;
      }
      const data = await res.json();
      jobs = Array.isArray(data.jobs) ? data.jobs : [];
      nextCursor = typeof data.next_cursor === "string" ? data.next_cursor : null;
      totalCount = typeof data.total_count === "number" ? data.total_count : jobs.length;
      startLive();
    } catch {
      error = "Network error while loading ingest runs.";
    } finally {
      loading = false;
    }
  }

  async function loadMore() {
    if (loadingMore || !nextCursor) return;
    loadingMore = true;
    try {
      const res = await fetch(`${API}?limit=${PAGE_SIZE}&cursor=${encodeURIComponent(nextCursor)}`);
      if (!res.ok) {
        error = `Could not load more runs (HTTP ${res.status}).`;
        return;
      }
      const data = await res.json();
      const more: Job[] = Array.isArray(data.jobs) ? data.jobs : [];
      // De-dupe by id in case a run churned between pages (keyset is stable, but be safe).
      const seen = new Set(jobs.map((j) => j.id));
      jobs = [...jobs, ...more.filter((j) => !seen.has(j.id))];
      nextCursor = typeof data.next_cursor === "string" ? data.next_cursor : null;
      if (typeof data.total_count === "number") totalCount = data.total_count;
    } catch {
      error = "Network error while loading more runs.";
    } finally {
      loadingMore = false;
    }
  }

  onMount(load);
  onDestroy(() => {
    unsubscribeLive?.();
    unsubscribeLive = null;
    stopLive?.();
    stopLive = null;
  });

  function statusClass(status: string): string {
    if (status === "completed") return "status-success";
    if (status === "failed") return "status-error";
    if (status === "cancelled") return "status-muted";
    if (status === "running") return "status-warning";
    return "status-muted";
  }

  function canCancel(status: string): boolean {
    return status === "running" || status === "pending";
  }

  function canRestart(status: string): boolean {
    return status === "failed" || status === "cancelled";
  }

  async function cancelJob(jobId: string) {
    try {
      const res = await fetch(`${API}/${jobId}/cancel`, { method: "POST" });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        error = d.message ?? `Could not cancel run (HTTP ${res.status}).`;
        return;
      }
      jobs = jobs.map((j) => (j.id === jobId ? { ...j, status: "cancelled" } : j));
    } catch {
      error = "Network error while cancelling.";
    }
  }

  async function deleteJob(jobId: string) {
    const job = jobs.find((j) => j.id === jobId);
    const label = job?.label ?? "this run";
    if (
      !confirm(
        `Delete "${label}"?\n\nThe run history and any quality reports for it will be permanently removed. This cannot be undone.`,
      )
    )
      return;
    deletingIds = new Set([...deletingIds, jobId]);
    try {
      const res = await fetch(`${API}/${jobId}`, { method: "DELETE" });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        error = d.message ?? `Could not delete run (HTTP ${res.status}).`;
        return;
      }
      jobs = jobs.filter((j) => j.id !== jobId);
    } catch {
      error = "Network error while deleting.";
    } finally {
      const next = new Set(deletingIds);
      next.delete(jobId);
      deletingIds = next;
    }
  }

  async function restartJob(jobId: string) {
    try {
      const res = await fetch(`${API}/${jobId}/restart`, { method: "POST" });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        error = d.message ?? `Could not restart run (HTTP ${res.status}).`;
        return;
      }
      const newId = d.job?.id;
      if (newId) await goto(`${RUNS_HREF}/${newId}`);
    } catch {
      error = "Network error while restarting.";
    }
  }

  async function bulkClean() {
    if (bulkCleaning) return;
    // Build a readable summary of what will be affected so users know the blast radius.
    const runningCount = jobs.filter(
      (j) => isJobStuck(j) && (j.status === "running" || j.status === "pending"),
    ).length;
    const terminalCount = jobs.filter(
      (j) => j.status === "failed" || j.status === "cancelled",
    ).length;
    const parts: string[] = [];
    if (runningCount > 0)
      parts.push(`cancel ${runningCount} stalled run${runningCount === 1 ? "" : "s"}`);
    if (terminalCount > 0)
      parts.push(
        `delete ${terminalCount} finished run${terminalCount === 1 ? "" : "s"} (failed/cancelled)`,
      );
    const summary = parts.length > 0 ? parts.join(" and ") : `clean up ${stuckCount} run${stuckCount === 1 ? "" : "s"}`;
    if (
      !confirm(
        `Clean up stuck and failed runs?\n\nThis will ${summary}. Run history and quality reports for deleted runs are permanently removed.\n\nThis cannot be undone.`,
      )
    )
      return;
    bulkCleaning = true;
    bulkCleanError = null;
    bulkCleanResult = null;
    try {
      const res = await fetch(API, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ delete_statuses: ["running", "cancelled", "failed"] }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        bulkCleanError = d.message ?? `Cleanup failed (HTTP ${res.status}).`;
        return;
      }
      bulkCleanResult = { cancelled: d.cancelled ?? 0, deleted: d.deleted ?? 0 };
      await load();
    } catch {
      bulkCleanError = "Network error during cleanup.";
    } finally {
      bulkCleaning = false;
    }
  }
</script>

<svelte:head>
  <title>Runs – Restormel Dashboard</title>
  <meta name="robots" content="noindex, nofollow" />
</svelte:head>

<section aria-labelledby="ingest-jobs-heading">
  <div class="head">
    <div>
      <h1 id="ingest-jobs-heading" class="h1">Ingest jobs</h1>
      <p class="lede">Durable, workspace-scoped ingestion jobs. Each job turns sources into your knowledge graph.</p>
    </div>
    <a class="btn btn-primary" href={NEW_RUN_HREF}>New run</a>
  </div>

  <div class="toolbar">
    <label class="filter">
      <span>Status</span>
      <select class="input" bind:value={statusFilter}>
        <option value="all">All</option>
        <option value="pending">Pending</option>
        <option value="running">Running</option>
        <option value="completed">Completed</option>
        <option value="failed">Failed</option>
        <option value="cancelled">Cancelled</option>
      </select>
    </label>
    <button type="button" class="btn btn-secondary" on:click={load} disabled={loading}>Refresh</button>
    {#if stuckCount > 0}
      <button
        type="button"
        class="btn btn-danger"
        on:click={bulkClean}
        disabled={bulkCleaning}
        title="Cancel stalled runs (lease expired or heartbeat stale) and delete failed/cancelled runs. Healthy running runs are not affected."
      >
        {bulkCleaning ? "Cleaning…" : `Clean up old runs (${stuckCount})`}
      </button>
    {/if}
  </div>

  {#if bulkCleanResult}
    <p class="clean-result" role="status">
      Cleaned up — {bulkCleanResult.deleted} job{bulkCleanResult.deleted === 1 ? "" : "s"} deleted
      {#if bulkCleanResult.cancelled > 0}, {bulkCleanResult.cancelled} cancelled first{/if}.
    </p>
  {/if}
  {#if bulkCleanError}
    <p class="err" role="alert">{bulkCleanError}</p>
  {/if}

  {#if loading}
    <BrutalLoadingState message="Loading ingest runs — fetching your workspace jobs" rows={5} />
  {:else if signedOut}
    <SignInNotice message="Sign in to view ingest runs." />
  {:else if error}
    <BrutalErrorBanner title="Could not load runs" message={error}>
      {#snippet actions()}
        <button type="button" class="btn btn-primary btn-sm" on:click={load}>Try again</button>
      {/snippet}
    </BrutalErrorBanner>
  {:else if filtered.length === 0}
    <div class="empty">
      <span class="empty-icon" aria-hidden="true">□</span>
      <h2 class="empty-title">No runs yet</h2>
      <p class="muted">
        Start your first ingest run to build your knowledge graph.
      </p>
      <a class="btn btn-primary" href={NEW_RUN_HREF}>Open setup wizard</a>
    </div>
  {:else}
    <ul class="jobs">
      {#each filtered as job (job.id)}
        <li class="job">
          <a class="job-main" href={RUNS_HREF + "/" + job.id}>
            <span class="job-label">{job.label ?? "Untitled job"}</span>
            <span class="job-meta">
              <span class="badge {statusClass(job.status)}">{job.status}</span>
              {#if job.current_stage}<span class="job-stage">{job.current_stage}</span>{/if}
              <span class="job-date">{new Date(job.created_at).toLocaleString()}</span>
            </span>
          </a>
          <code class="job-id">{job.id.slice(0, 8)}</code>
          <div class="job-actions">
            <button
              type="button"
              class="btn btn-secondary btn-sm"
              on:click|stopPropagation={() => openPeek(job)}
              aria-label="Quick-peek this run"
            >
              Peek
            </button>
            {#if canCancel(job.status)}
              <button
                type="button"
                class="btn btn-secondary btn-sm"
                on:click|stopPropagation={() => cancelJob(job.id)}
              >
                Cancel
              </button>
            {/if}
            {#if canRestart(job.status)}
              <button
                type="button"
                class="btn btn-secondary btn-sm"
                on:click|stopPropagation={() => restartJob(job.id)}
              >
                Restart
              </button>
            {/if}
            <button
              type="button"
              class="btn btn-danger btn-sm"
              disabled={deletingIds.has(job.id)}
              on:click|stopPropagation={() => deleteJob(job.id)}
              aria-label="Delete this job"
            >
              {deletingIds.has(job.id) ? "…" : "Delete"}
            </button>
          </div>
        </li>
      {/each}
    </ul>

    <div class="page-footer">
      <p class="showing" role="status" aria-live="polite">
        {#if statusFilter === "all"}
          Showing {jobs.length} of {totalCount} run{totalCount === 1 ? "" : "s"}
        {:else}
          Showing {filtered.length} {statusFilter} of {jobs.length} loaded ({totalCount} total)
        {/if}
      </p>
      {#if hasMore}
        <button type="button" class="btn btn-secondary" on:click={loadMore} disabled={loadingMore}>
          {loadingMore ? "Loading…" : "Load more"}
        </button>
      {/if}
    </div>
  {/if}
</section>

<DossierRail bind:open={peekOpen} title="Run quick-peek">
  {#snippet body()}
    {#if peekJob}
      <RunQuickPeek job={peekJob} />
    {/if}
  {/snippet}
</DossierRail>

<style>
  .head {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: var(--space-4);
    flex-wrap: wrap;
    margin-bottom: var(--space-4);
  }
  .h1 {
    margin: 0 0 var(--space-1);
    font-size: var(--text-2xl);
    color: var(--rm-text);
  }
  .lede {
    margin: 0;
    color: var(--rm-muted);
    max-width: 42rem;
  }
  .toolbar {
    display: flex;
    align-items: flex-end;
    gap: var(--space-3);
    margin-bottom: var(--space-4);
    flex-wrap: wrap;
  }
  .filter {
    display: inline-flex;
    flex-direction: column;
    gap: var(--space-1);
    font-size: var(--text-xs);
    color: var(--rm-muted);
  }
  .filter .input {
    width: auto;
    min-width: 8rem;
  }
  .btn-danger {
    background: transparent;
    color: var(--coral-alert, #c0392b);
    border: 1px solid var(--coral-alert, #c0392b);
  }
  .btn-danger:hover:not(:disabled) {
    background: var(--coral-alert, #c0392b);
    color: #fff;
  }
  .btn-danger:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .clean-result {
    margin: 0 0 var(--space-3);
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--rm-border);
    border-radius: var(--rm-radius);
    background: var(--rm-surface);
    font-size: var(--text-sm);
    color: var(--rm-muted);
  }
  .page-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    margin-top: var(--space-4);
    flex-wrap: wrap;
  }
  .showing {
    margin: 0;
    font-family: var(--font-mono, monospace);
    font-size: var(--text-xs);
    color: var(--rm-muted);
  }
  .muted {
    color: var(--rm-muted);
  }
  .err {
    color: var(--coral-alert);
  }
  .empty {
    border: 1px solid var(--rm-border);
    border-radius: var(--rm-radius);
    background: var(--rm-surface);
    padding: var(--space-5);
    text-align: center;
  }
  .empty p {
    margin: 0 0 var(--space-2);
  }
  .jobs {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
  .job {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    border: 1px solid var(--rm-border);
    border-radius: var(--rm-radius);
    background: var(--rm-surface);
    padding: var(--space-3) var(--space-4);
  }
  .job-actions {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    flex-shrink: 0;
  }
  .job .btn-sm {
    font-size: var(--text-xs);
    padding: var(--space-1) var(--space-2);
    flex-shrink: 0;
  }
  .job-main {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    color: inherit;
  }
  .job-main:hover {
    text-decoration: none;
  }
  .job-label {
    color: var(--rm-text);
    font-weight: 500;
  }
  .job-meta {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    flex-wrap: wrap;
    font-size: var(--text-xs);
    color: var(--rm-muted);
  }
  .badge {
    border: 1px solid var(--rm-border);
    border-radius: var(--rm-radius);
    padding: 0 var(--space-2);
    text-transform: capitalize;
  }
  .job-id {
    color: var(--rm-dim);
    font-size: var(--text-xs);
  }
  .status-success { border-color: var(--neon-accent, #2ecc71); color: var(--neon-accent, #2ecc71); }
  .status-error   { border-color: var(--coral-alert, #c0392b); color: var(--coral-alert, #c0392b); }
  .status-warning { border-color: var(--gold-accent, #f1c40f); color: var(--rm-text); }
  .status-muted   { border-color: var(--rm-border); color: var(--rm-muted); }
</style>
