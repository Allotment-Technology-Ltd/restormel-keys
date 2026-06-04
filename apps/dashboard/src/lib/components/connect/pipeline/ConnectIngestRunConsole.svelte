<script lang="ts">
  import { onDestroy } from "svelte";
  import { goto } from "$app/navigation";
  import {
    CONNECT_INGEST_PIPELINE_STAGES,
    type ConnectIngestStageProgress,
  } from "@restormel/connect-core";
  import BrutalCard from "$lib/components/brutalist/BrutalCard.svelte";
  import BrutalBadge from "$lib/components/brutalist/BrutalBadge.svelte";
  import ConnectIngestPipelineTimeline from "$lib/components/connect/pipeline/ConnectIngestPipelineTimeline.svelte";
  import { ingestStatusVariant } from "$lib/connect/ingest-progress-ui";
  import { DASHBOARD_BASE } from "$lib/dashboard-base";
  import { pipelineWizardHref } from "$lib/connect/pipeline-config";

  type JobProgress = {
    percent: number;
    processed: number;
    total: number;
    execution_mode?: "stub" | "full";
  };
  type Job = {
    id: string;
    status: string;
    label?: string;
    current_stage?: string;
    current_action?: string;
    progress?: JobProgress;
    stages?: ConnectIngestStageProgress[];
    error?: string;
  };

  export let jobId: string;
  export let statusApiBase: string;
  export let fromPipeline = false;

  const CONNECT_BASE = DASHBOARD_BASE + "/connect";

  let job: Job | null = null;
  let logLines: string[] = [];
  let logLineTotal = 0;
  let since = 0;
  let loading = true;
  let error: string | null = null;
  let actionMsg: string | null = null;
  let cancelling = false;
  let restarting = false;
  let pollTimer: ReturnType<typeof setTimeout> | null = null;
  let logEl: HTMLPreElement | undefined;

  $: jobsApiBase = statusApiBase.replace(/\/status$/, "");

  $: percent = job?.progress?.percent ?? 0;
  $: statusVariant = ingestStatusVariant(job?.status ?? "pending");
  $: active = job?.status === "pending" || job?.status === "running";
  $: pollMs = active ? 750 : 4000;
  $: canCancel = job?.status === "pending" || job?.status === "running";
  $: isStubPreview =
    job?.progress?.execution_mode === "stub" ||
    logLines.some((line) => line.includes("Preview mode — no records written"));

  $: canRestart =
    job?.status === "failed" ||
    job?.status === "cancelled" ||
    (job?.status === "completed" && (isStubPreview || job?.progress?.execution_mode === "full"));

  $: runAgainLabel =
    job?.status === "completed" && job?.progress?.execution_mode === "full" && !isStubPreview
      ? "Run again"
      : "Restart run";

  $: showCompletedGraphCta =
    job?.status === "completed" && !isStubPreview && job?.progress?.execution_mode === "full";

  async function cancelJob() {
    if (!job || !canCancel) return;
    if (!confirm("Cancel this ingest run? This cannot be undone.")) return;
    cancelling = true;
    actionMsg = null;
    try {
      const res = await fetch(`${jobsApiBase}/cancel`, { method: "POST" });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        actionMsg = d.message ?? `Could not cancel (HTTP ${res.status}).`;
        return;
      }
      actionMsg = d.cancelled ? "Run cancelled." : "Run was not in a cancellable state.";
      if (d.job) job = d.job;
      else await loadLive(true);
    } catch {
      actionMsg = "Network error while cancelling.";
    } finally {
      cancelling = false;
    }
  }

  async function restartJob() {
    if (!job || !canRestart) return;
    restarting = true;
    actionMsg = null;
    try {
      const res = await fetch(`${jobsApiBase}/restart`, { method: "POST" });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        actionMsg = d.message ?? `Could not restart (HTTP ${res.status}).`;
        return;
      }
      const newId = d.job?.id;
      if (!newId) {
        actionMsg = "Restart succeeded but no new run id was returned.";
        return;
      }
      const suffix = fromPipeline ? "?from=pipeline" : "";
      await goto(`${CONNECT_BASE}/ingest/${newId}${suffix}`);
    } catch {
      actionMsg = "Network error while restarting.";
    } finally {
      restarting = false;
    }
  }

  async function loadLive(incremental = false) {
    if (!incremental) loading = true;
    error = null;
    try {
      const url = `${statusApiBase}?since=${since}`;
      const res = await fetch(url);
      if (res.status === 404) {
        error = "Job not found.";
        job = null;
        return;
      }
      if (!res.ok) {
        error = `Could not load run status (HTTP ${res.status}).`;
        return;
      }
      const d = await res.json();
      job = d.job ?? null;
      if (Array.isArray(d.log_lines) && d.log_lines.length > 0) {
        logLines = [...logLines, ...d.log_lines];
        if (logLines.length > 600) logLines = logLines.slice(-600);
      }
      if (typeof d.log_line_total === "number") logLineTotal = d.log_line_total;
      if (typeof d.since === "number") since = d.since;
      schedulePoll();
      queueMicrotask(() => {
        if (logEl) logEl.scrollTop = logEl.scrollHeight;
      });
    } catch {
      error = "Network error while loading run status.";
    } finally {
      loading = false;
    }
  }

  function schedulePoll() {
    if (pollTimer) clearTimeout(pollTimer);
    if (job && (job.status === "pending" || job.status === "running")) {
      pollTimer = setTimeout(() => loadLive(true), pollMs);
    }
  }

  $: if (jobId) {
    since = 0;
    logLines = [];
    void loadLive(false);
  }

  onDestroy(() => {
    if (pollTimer) clearTimeout(pollTimer);
  });
</script>

<section class="run-console" aria-labelledby="run-console-heading">
  {#if loading && !job}
    <p class="run-muted" role="status">Loading run console…</p>
  {:else if error}
    <p class="run-error" role="alert">{error}</p>
  {:else if job}
    <header class="run-head">
      <div>
        <p class="run-kicker">{fromPipeline ? "Pipeline run" : "Ingest run"}</p>
        <h1 id="run-console-heading" class="run-title">{job.label ?? "Ingest run"}</h1>
        <p class="run-meta">
          <BrutalBadge variant={statusVariant} label={job.status} />
          <code class="run-id">{job.id}</code>
        </p>
      </div>
      <div class="run-actions">
        {#if canCancel}
          <button type="button" class="btn btn-danger" on:click={cancelJob} disabled={cancelling}>
            {cancelling ? "Cancelling…" : "Cancel run"}
          </button>
        {/if}
        {#if showCompletedGraphCta}
          <a class="btn btn-primary" href={CONNECT_BASE + "/graph"}>View graph</a>
        {/if}
        {#if canRestart}
          <button type="button" class="btn btn-secondary" on:click={restartJob} disabled={restarting}>
            {restarting ? "Starting…" : runAgainLabel}
          </button>
        {/if}
        <a class="btn btn-secondary" href={pipelineWizardHref("sources")}>Next run setup</a>
      </div>
    </header>

    {#if actionMsg}
      <p class="run-notice" role="status">{actionMsg}</p>
    {/if}

    {#if showCompletedGraphCta}
      <div class="run-success" role="status">
        <strong>Run complete.</strong>
        Your graph store should now have new units and relationships.
        <a href={CONNECT_BASE + "/graph"}>Open the graph explorer</a>
        to review them, or use <strong>Next run setup</strong> to change documents or domain pack before another ingest.
      </div>
    {/if}

    {#if job.status === "completed" && isStubPreview}
      <div class="run-warn" role="status">
        <strong>Preview run — nothing was written to your graph store.</strong>
        This run only simulated pipeline progress. With Surreal connected in the pipeline wizard, new runs
        write to your database automatically. Use <strong>Restart run</strong> or
        <a href={pipelineWizardHref("run")}>start a new run</a>.
      </div>
    {/if}

    {#if job.error}
      <p class="run-error" role="alert">{job.error}</p>
    {/if}

    <div class="run-grid">
      <BrutalCard fill="canvas" title="Progress">
        <div class="progress-panel">
          <div class="progress-readout" aria-live="polite">
            <span class="progress-pct">{percent}<span class="progress-pct-suffix">%</span></span>
            <span class="progress-eta">Run progress</span>
          </div>
          <div
            class="progress-track"
            role="progressbar"
            aria-valuemin="0"
            aria-valuemax="100"
            aria-valuenow={percent}
            aria-label="Ingest progress"
          >
            <div class="progress-fill" style:width="{percent}%"></div>
            <div class="progress-segments" aria-hidden="true">
              {#each CONNECT_INGEST_PIPELINE_STAGES as _}
                <span></span>
              {/each}
            </div>
          </div>
          {#if job.progress}
            <p class="run-muted progress-detail">
              {job.progress.processed} of {job.progress.total} stages complete
            </p>
          {/if}
        </div>
      </BrutalCard>

      <BrutalCard fill="white" title="Pipeline">
        <p class="run-muted pipeline-lede">Stage state from the worker — current stage, ETA, and per-stage progress.</p>
        <ConnectIngestPipelineTimeline
          stages={job.stages ?? []}
          currentStageKey={job.current_stage}
          currentAction={job.current_action}
          jobStatus={job.status}
        />
      </BrutalCard>

      <BrutalCard fill="white" title="Activity log">
        <p class="run-muted log-meta">
          {logLines.length} lines shown · {logLineTotal} total buffered
        </p>
        <pre class="log-screen" bind:this={logEl} tabindex="0" aria-label="Ingest activity log">{logLines.join("\n") || "— awaiting worker output —"}</pre>
      </BrutalCard>
    </div>
  {/if}
</section>

<style>
  .run-console {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }

  .run-head {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: var(--space-4);
    flex-wrap: wrap;
  }

  .run-actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    align-items: center;
  }

  .run-notice {
    margin: 0;
    padding: var(--space-3) var(--space-4);
    border: var(--brut-border-micro) solid var(--brut-ink);
    background: var(--brut-white);
    color: var(--rm-muted);
    font-size: var(--text-sm);
  }

  .run-warn {
    margin: 0 0 var(--space-4);
    padding: var(--space-3) var(--space-4);
    border: var(--brut-border-width) solid var(--brut-coral);
    background: color-mix(in oklab, var(--brut-coral) 18%, var(--brut-white));
    color: var(--rm-text);
    font-size: var(--text-sm);
    line-height: 1.5;
  }

  .run-warn a {
    color: inherit;
    font-weight: 600;
  }

  .run-success {
    margin: 0 0 var(--space-4);
    padding: var(--space-3) var(--space-4);
    border: var(--brut-border-width) solid var(--brut-sage, var(--rm-sage));
    background: color-mix(in oklab, var(--rm-sage) 12%, var(--brut-white));
    color: var(--rm-text);
    font-size: var(--text-sm);
    line-height: 1.5;
  }

  .run-success a {
    color: inherit;
    font-weight: 600;
  }

  .run-kicker {
    margin: 0 0 var(--space-1);
    font-family: var(--rm-font-mono);
    font-size: var(--text-xs);
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--rm-dim);
  }

  .run-title {
    margin: 0 0 var(--space-2);
    font-size: var(--text-2xl);
    color: var(--rm-text);
  }

  .run-meta {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    margin: 0;
    flex-wrap: wrap;
  }

  .run-id {
    font-family: var(--rm-font-mono);
    font-size: var(--text-xs);
    color: var(--rm-muted);
  }

  .run-muted {
    margin: 0;
    color: var(--rm-muted);
    font-size: var(--text-sm);
  }

  .run-error {
    margin: 0;
    color: var(--coral-alert);
  }

  .run-grid {
    display: grid;
    gap: var(--space-4);
    grid-template-columns: 1fr;
  }

  @media (min-width: 960px) {
    .run-grid {
      grid-template-columns: 1fr 1fr;
    }

    .run-grid :global(.brutal-card:last-child) {
      grid-column: 1 / -1;
    }
  }

  .progress-panel {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .progress-readout {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: var(--space-3);
    font-family: var(--rm-font-mono);
  }

  .progress-pct {
    font-size: clamp(2rem, 5vw, 3rem);
    font-weight: 700;
    letter-spacing: -0.04em;
    line-height: 1;
  }

  .progress-pct-suffix {
    font-size: 0.45em;
    opacity: 0.7;
  }

  .progress-eta {
    font-size: var(--text-sm);
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  .progress-track {
    position: relative;
    height: 1.25rem;
    border: var(--brut-border-width) solid var(--brut-ink);
    background: var(--brut-white);
    box-shadow: inset 2px 2px 0 color-mix(in oklab, var(--brut-ink) 12%, transparent);
  }

  .progress-fill {
    position: absolute;
    inset: 0 auto 0 0;
    background: repeating-linear-gradient(
      90deg,
      var(--brut-neon) 0,
      var(--brut-neon) 8px,
      color-mix(in oklab, var(--brut-neon) 70%, var(--brut-blue)) 8px,
      color-mix(in oklab, var(--brut-neon) 70%, var(--brut-blue)) 16px
    );
    transition: width 400ms steps(8, end);
  }

  .progress-segments {
    position: absolute;
    inset: 0;
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    pointer-events: none;
  }

  .progress-segments span {
    border-right: 1px solid color-mix(in oklab, var(--brut-ink) 25%, transparent);
  }

  .progress-segments span:last-child {
    border-right: none;
  }

  .progress-detail {
    font-family: var(--rm-font-mono);
    font-size: var(--text-xs);
  }

  .pipeline-lede {
    margin: 0 0 var(--space-3);
    font-size: var(--text-xs);
  }

  .log-meta {
    margin-bottom: var(--space-2);
  }

  .log-screen {
    margin: 0;
    max-height: 22rem;
    overflow: auto;
    padding: var(--space-3);
    border: var(--brut-border-width) solid var(--brut-ink);
    background: #0a1f0a;
    color: #7dff7d;
    font-family: var(--rm-font-mono);
    font-size: 0.75rem;
    line-height: 1.45;
    white-space: pre-wrap;
    word-break: break-word;
    box-shadow: inset 0 0 0 2px color-mix(in oklab, #7dff7d 15%, transparent);
  }
</style>
