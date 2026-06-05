<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import BrutalLoadingState from "$lib/components/brutalist/BrutalLoadingState.svelte";
  import { DASHBOARD_BASE } from "$lib/dashboard-base";
  import { pipelineWizardHref } from "$lib/connect/pipeline-config";

  const API = DASHBOARD_BASE + "/api/connect/ingest/jobs";
  const CONNECT_BASE = DASHBOARD_BASE + "/connect";
  const NEW_RUN_HREF = pipelineWizardHref("launch");

  type Job = {
    id: string;
    status: string;
    label?: string;
    created_at: string;
    updated_at: string;
    current_stage?: string;
  };

  let loading = true;
  let error: string | null = null;
  let jobs: Job[] = [];
  let statusFilter = "all";

  $: filtered = statusFilter === "all" ? jobs : jobs.filter((j) => j.status === statusFilter);

  async function load() {
    loading = true;
    error = null;
    try {
      const res = await fetch(API);
      if (res.status === 401) {
        error = "Sign in to view ingest jobs.";
        jobs = [];
        return;
      }
      if (!res.ok) {
        error = `Could not load jobs (HTTP ${res.status}).`;
        return;
      }
      const data = await res.json();
      jobs = Array.isArray(data.jobs) ? data.jobs : [];
    } catch {
      error = "Network error while loading jobs.";
    } finally {
      loading = false;
    }
  }

  onMount(load);

  function statusClass(status: string): string {
    if (status === "completed") return "status-success";
    if (status === "failed") return "status-error";
    if (status === "cancelled") return "status-muted";
    if (status === "running") return "status-warning";
    return "status-muted";
  }

  function canRestart(status: string): boolean {
    return status === "failed" || status === "cancelled";
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
      if (newId) await goto(`${CONNECT_BASE}/ingest/${newId}`);
    } catch {
      error = "Network error while restarting.";
    }
  }
</script>

<svelte:head>
  <title>Knowledge ingest jobs – Restormel Dashboard</title>
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
  </div>

  {#if loading}
    <BrutalLoadingState message="Loading ingest runs — fetching your workspace jobs" rows={5} />
  {:else if error}
    <p class="err" role="alert">{error}</p>
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
          <a class="job-main" href={CONNECT_BASE + "/ingest/" + job.id}>
            <span class="job-label">{job.label ?? "Untitled job"}</span>
            <span class="job-meta">
              <span class="badge {statusClass(job.status)}">{job.status}</span>
              {#if job.current_stage}<span class="job-stage">{job.current_stage}</span>{/if}
              <span class="job-date">{new Date(job.created_at).toLocaleString()}</span>
            </span>
          </a>
          <code class="job-id">{job.id.slice(0, 8)}</code>
          {#if canRestart(job.status)}
            <button
              type="button"
              class="btn btn-secondary btn-sm"
              on:click|stopPropagation={() => restartJob(job.id)}
            >
              Restart
            </button>
          {/if}
        </li>
      {/each}
    </ul>
  {/if}
</section>

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
</style>
