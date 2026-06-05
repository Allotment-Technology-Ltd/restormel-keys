<script lang="ts" context="module">
  export type GraphRepairProgressView = {
    job_kind: "graph_revalidate";
    mode: "validate" | "validate_and_remediate";
    phase: "loading" | "validating" | "remediating" | "storing" | "done";
    units_total: number;
    units_processed: number;
    sources_total: number;
    sources_done: number;
    batches_total?: number;
    batches_done?: number;
    repaired?: number;
    dropped?: number;
    skipped_no_source?: number;
    quarantine_before?: number;
    quarantine_after?: number;
    preview_only_sources?: number;
    sources_remediation_failed?: number;
    last_error?: string;
    last_error_at?: string;
    last_activity_at: string;
  };
</script>

<script lang="ts">
  import { onDestroy, onMount } from "svelte";

  export let graphRepair: GraphRepairProgressView;
  export let jobStatus: string;
  export let jobUpdatedAt: string | undefined = undefined;
  export let percent: number = 0;

  const STALE_MS = 90_000;
  const LIVE_MS = 8_000;

  let nowMs = Date.now();
  let clockTimer: ReturnType<typeof setInterval> | null = null;

  onMount(() => {
    clockTimer = setInterval(() => {
      nowMs = Date.now();
    }, 1000);
  });

  onDestroy(() => {
    if (clockTimer) clearInterval(clockTimer);
  });

  function relativeTime(iso: string | undefined, referenceMs = Date.now()): string {
    if (!iso) return "—";
    const ms = referenceMs - new Date(iso).getTime();
    if (!Number.isFinite(ms) || ms < 0) return "just now";
    if (ms < 60_000) return `${Math.max(1, Math.round(ms / 1000))}s ago`;
    if (ms < 3_600_000) return `${Math.round(ms / 60_000)}m ago`;
    return `${Math.round(ms / 3_600_000)}h ago`;
  }

  $: isRunning = jobStatus === "pending" || jobStatus === "running";
  $: lastActivityIso = graphRepair.last_activity_at || jobUpdatedAt;
  $: staleMs = lastActivityIso ? nowMs - new Date(lastActivityIso).getTime() : 0;
  $: isStale = isRunning && staleMs > STALE_MS;
  $: isLive = isRunning && staleMs <= LIVE_MS;
  $: countersDuringValidation =
    graphRepair.mode === "validate_and_remediate" &&
    graphRepair.phase === "validating" &&
    (graphRepair.repaired ?? 0) === 0 &&
    (graphRepair.dropped ?? 0) === 0;

  $: phaseLabel =
    graphRepair.phase === "loading"
      ? "Loading units"
      : graphRepair.phase === "validating"
        ? "Validating"
        : graphRepair.phase === "remediating"
          ? "Remediating"
          : graphRepair.phase === "storing"
            ? "Finalizing"
            : "Complete";

  $: batchLine =
    graphRepair.batches_total != null && graphRepair.batches_total > 0
      ? ` · ${phaseLabel} batch ${graphRepair.batches_done ?? 0} of ${graphRepair.batches_total}`
      : "";

  $: activeSource =
    isRunning && graphRepair.phase !== "done" && graphRepair.phase !== "loading"
      ? Math.max(1, Math.min(graphRepair.sources_done, graphRepair.sources_total))
      : graphRepair.sources_done;
  $: secondaryLine = `Source ${activeSource} of ${graphRepair.sources_total}${batchLine}`;
</script>

<div class="graph-repair" role="region" aria-label="Graph repair unit progress">
  <div class="graph-repair-primary">
    <span class="graph-repair-label">Ideas processed</span>
    <span class="graph-repair-count" aria-live="polite">
      {graphRepair.units_processed}
      <span class="graph-repair-count-total">/ {graphRepair.units_total}</span>
    </span>
    <span class="graph-repair-pct">{percent}%</span>
  </div>

  <p class="graph-repair-secondary">{secondaryLine}</p>

  {#if graphRepair.mode === "validate_and_remediate"}
    {#if countersDuringValidation}
      <p class="graph-repair-counters graph-repair-counters-hint">
        Repaired and dropped counts update after each source is remediated.
      </p>
    {/if}
    <p class="graph-repair-counters">
      Repaired {graphRepair.repaired ?? 0}
      · Dropped {graphRepair.dropped ?? 0}
      {#if (graphRepair.skipped_no_source ?? 0) > 0}
        · Skipped (no source) {graphRepair.skipped_no_source}
      {/if}
      {#if (graphRepair.preview_only_sources ?? 0) > 0}
        · Preview-only sources {graphRepair.preview_only_sources}
      {/if}
      {#if (graphRepair.sources_remediation_failed ?? 0) > 0}
        · Remediation failed (sources) {graphRepair.sources_remediation_failed}
      {/if}
    </p>
  {/if}

  {#if graphRepair.quarantine_before != null && graphRepair.quarantine_after != null}
    <p class="graph-repair-quarantine">
      Quarantine: {graphRepair.quarantine_before} → {graphRepair.quarantine_after}
    </p>
  {:else if graphRepair.quarantine_before != null}
    <p class="graph-repair-quarantine">Quarantine before: {graphRepair.quarantine_before}</p>
  {/if}

  <p class="graph-repair-activity">
    {#if isLive}
      <span class="graph-repair-live" aria-hidden="true">●</span> Progress updating — last sync {relativeTime(lastActivityIso, nowMs)}
    {:else}
      Progress updated {relativeTime(lastActivityIso, nowMs)}
    {/if}
  </p>

  {#if isStale}
    <p class="graph-repair-stale" role="status">
      Still working — large LLM batches can take several minutes. Last update {relativeTime(lastActivityIso)}.
      Check the activity log below.
    </p>
  {/if}

  {#if graphRepair.last_error}
    <p class="graph-repair-error" role="alert">
      <strong>Remediation error</strong>
      {graphRepair.last_error}
    </p>
  {/if}
</div>

<style>
  .graph-repair {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .graph-repair-primary {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: var(--space-2) var(--space-4);
  }

  .graph-repair-label {
    font-family: var(--rm-font-mono);
    font-size: var(--text-xs);
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--rm-dim);
  }

  .graph-repair-count {
    font-family: var(--font-display, var(--font-sans));
    font-size: clamp(1.5rem, 4vw, 2rem);
    font-weight: 900;
    color: var(--rm-text);
  }

  .graph-repair-count-total {
    font-size: 0.55em;
    font-weight: 700;
    color: var(--rm-muted);
  }

  .graph-repair-pct {
    font-family: var(--rm-font-mono);
    font-size: var(--text-sm);
    color: var(--rm-muted);
  }

  .graph-repair-secondary,
  .graph-repair-counters,
  .graph-repair-quarantine,
  .graph-repair-activity {
    margin: 0;
    font-size: var(--text-sm);
    color: var(--rm-muted);
    line-height: 1.45;
  }

  .graph-repair-stale {
    margin: 0;
    padding: var(--space-2) var(--space-3);
    border: var(--brut-border-micro) solid var(--brut-amber, #e6a700);
    background: color-mix(in oklab, var(--brut-amber, #e6a700) 14%, var(--brut-white));
    font-size: var(--text-sm);
    color: var(--rm-text);
    line-height: 1.45;
  }

  .graph-repair-error {
    margin: 0;
    padding: var(--space-2) var(--space-3);
    border: var(--brut-border-micro) solid var(--brut-coral);
    background: color-mix(in oklab, var(--brut-coral) 14%, var(--brut-white));
    font-size: var(--text-sm);
    color: var(--rm-text);
    line-height: 1.45;
  }

  .graph-repair-error strong {
    display: block;
    margin-bottom: var(--space-1);
  }

  .graph-repair-counters-hint {
    font-style: italic;
  }

  .graph-repair-live {
    color: var(--brut-neon, #c8f000);
    margin-right: 0.25rem;
  }
</style>
