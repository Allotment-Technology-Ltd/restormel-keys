<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import { goto, invalidate } from "$app/navigation";
  import { CONNECT_INGEST_PIPELINE_STAGES } from "@restormel/connect-core/ingest/job-record";
  import type { ConnectIngestStageProgress } from "@restormel/connect-core/ingest/worker-stub";
  import type { ConnectModelStage } from "@restormel/contracts/connect";
  import {
    attributionRecordedFrom,
    buildAttributionRows,
  } from "$lib/connect/run-attribution-display";
  import BrutalCard from "$lib/components/brutalist/BrutalCard.svelte";
  import ConnectIngestPipelineTimeline from "$lib/components/connect/pipeline/ConnectIngestPipelineTimeline.svelte";
  import ConnectGraphRepairProgress from "$lib/components/connect/pipeline/ConnectGraphRepairProgress.svelte";
  import {
    formatRunDuration,
    ingestStatusLabel,
  } from "$lib/connect/ingest-quality-display";
  import { DASHBOARD_BASE } from "$lib/dashboard-base";
  import { AGENTS_HREF, CLAIMS_HREF, HOME_HREF, RUNS_HREF } from "$lib/nav-config";
  import { pipelineWizardHref } from "$lib/connect/pipeline-config";
  import { STALL_NOTICE_MS } from "$lib/connect/run-stall";
  import { LiveRunEventClient } from "$lib/connect/live-run-event-client";
  import type { LiveRunStreamEvent } from "$lib/connect/live-run-events";
  import {
    buildHeartbeatStrip,
    buildStageOdometers,
    buildCompletionLedger,
  } from "$lib/connect/machine-room-display";
  import {
    failingPreflightRows,
    mapConnectRunFailure,
    preflightIssueCopy,
    type ConnectRunPreflightResult,
  } from "$lib/connect/run-preflight";

  type GraphRepairProgress = {
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

  /** K5 run attribution — which route/step/provider/model served each stage. */
  type StageAttribution = {
    routeId: string | null;
    routeName: string | null;
    projectId: string | null;
    stepId: string | null;
    stepOrderIndex: number | null;
    provider: string | null;
    modelId: string | null;
    attempts: number;
    recordedAt: string;
  };
  type RunAttribution = Partial<Record<ConnectModelStage, StageAttribution>>;

  type JobProgress = {
    percent: number;
    processed: number;
    total: number;
    execution_mode?: "stub" | "full";
    graph_repair?: GraphRepairProgress;
    /** K5: per-stage served-by attribution (absent for runs that predate capture). */
    attribution?: RunAttribution;
    quality_report?: {
      preset?: string;
      ok_pct?: number;
      quarantine_count?: number;
      quarantine_pct?: number;
      weak_pct?: number;
      unsupported_pct?: number;
      stub_warning?: string | null;
      kg_audit?: { trust_score?: number; total_issues?: number } | null;
      /**
       * Real captured unit count for this run (persisted by `buildRunQualityReport`).
       * This — NOT job-level `progress.processed`, which is the completed-STAGE count
       * (= pipeline stage length) — is the honest "N units captured" headline.
       */
      units?: number;
      /** Validation breakdown; its sum is the fallback unit count when `units` is absent. */
      validation?: { ok: number; weak: number; unsupported: number; unvalidated: number };
      /** K4/K-P1-7: validating-family disclosure; absent until K5 persists attribution. */
      validation_family?: {
        validation_provider?: string;
        extraction_provider?: string | null;
        cross_family?: boolean | null;
      } | null;
      next_actions?: string[];
    };
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
    created_at?: string;
    updated_at?: string;
    /** Stage 1.6 durable-run signals. */
    worker_heartbeat_at?: number | null;
    lease_expires_at?: number | null;
    reclaim_count?: number;
  };

  export let jobId: string;
  export let statusApiBase: string;
  export let fromPipeline = false;
  /** Set when opened from graph tools (refreshes graph data when the run completes). */
  export let fromGraph = false;
  /** Set when opened from Home (`?from=hub`, pre-R2 name) — back link returns to /home. */
  export let fromHub = false;
  /** Distinguishes graph repair jobs started from the explorer Tools panel. */
  export let graphTask: "link-sources" | "revalidate" | "auto-remediate" | "embed-backfill" | null =
    null;


  let job: Job | null = null;
  let logLines: string[] = [];
  let logLineTotal = 0;
  let since = 0;
  let loading = true;
  let error: string | null = null;
  let actionMsg: string | null = null;
  let cancelling = false;
  let restarting = false;
  /** K3: failing preflight returned by a blocked restart (422 preflight_blocked). */
  let restartPreflight: ConnectRunPreflightResult | null = null;
  let pollTimer: ReturnType<typeof setTimeout> | null = null;
  let clockTimer: ReturnType<typeof setInterval> | null = null;
  let nowMs = Date.now();
  // W4.1 Machine Room: monotonic count of applied live frames (snapshot/delta) +
  // fallback fetches. The heartbeat strip walks one filled cell per frame so the
  // tick-line visibly "breathes" with each worker signal. Pure UI state — it rides
  // the EXISTING SSE frames, adds no fetch (the 2-mutation-fetch invariant stands).
  let frameTick = 0;
  // MINOR-2: when the viewer prefers reduced motion, the heartbeat tick-line must hold
  // STILL — the static "Last worker signal Xs ago" text carries the signal instead (the
  // claim the ux-contracts §3 / X9 row already makes). The CSS reduced-motion block
  // kills the CSS animations/transitions, but the bar's filled-cell walk is JS-driven
  // off `frameTick`, so it has to be frozen here too. Detected once on mount.
  let prefersReducedMotion = false;
  // W3.1 live transport. SSE is the primary channel; the 2.5s jittered poll below
  // is the documented F8 fallback, engaged only when SSE is judged unhealthy.
  let liveClient: LiveRunEventClient | null = null;
  let liveDegraded = false;
  let logEl: HTMLDivElement | undefined;
  /** User-controlled collapse — never one-way `open={expr}` or polling resets the panel. */
  let logOpen = true;
  let graphDataInvalidated = false;
  let graphWorkspaceId: string | null = null;
  let refreshingGraph = false;

  $: jobsApiBase = statusApiBase.replace(/\/status$/, "");
  // The workspace SSE channel, focused on this run (streams its log tail too).
  const EVENTS_API = DASHBOARD_BASE + "/api/connect/ingest/events";

  $: percent = job?.progress?.percent ?? 0;
  $: active = job?.status === "pending" || job?.status === "running";
  $: isGraphRepairTask = graphTask === "auto-remediate" || graphTask === "revalidate";
  $: isEmbedBackfill = graphTask === "embed-backfill";
  // F8: each poll is a full server round-trip (hooks + 3 queries). 2.5s with jitter
  // keeps the console live while roughly halving steady-state poll load vs 1.5s;
  // polling pauses entirely while the tab is hidden (see handleVisibilityChange).
  $: pollMs = active ? 2500 : 4000;
  $: canCancel = job?.status === "pending" || job?.status === "running";
  $: isStubPreview =
    job?.progress?.execution_mode === "stub" ||
    logLines.some((line) => line.includes("Preview mode — no records written"));

  $: runAgainLabel =
    job?.status === "completed" && job?.progress?.execution_mode === "full" && !isStubPreview
      ? "Run again"
      : "Restart run";

  $: showCompletedGraphCta =
    job?.status === "completed" && !isStubPreview && job?.progress?.execution_mode === "full";

  $: showCompletedLinkSourcesBanner =
    graphTask === "link-sources" && showCompletedGraphCta;

  // MAJOR-1: render the "Run complete" success banner ONLY for graph-tool tasks whose
  // copy is distinct from the completion ledger (repair / embed-backfill / revalidate
  // handoffs). A plain full run (no graphTask, not fromGraph) gets the ledger alone —
  // the duplicate default banner is deleted, so `.run-success` is absent there.
  $: showCompletedTaskBanner =
    showCompletedGraphCta &&
    (graphTask === "auto-remediate" ||
      graphTask === "embed-backfill" ||
      graphTask === "revalidate" ||
      (fromGraph && graphTask == null));

  $: isCompleted = job?.status === "completed";
  $: isInProgress = job?.status === "pending" || job?.status === "running";
  $: startingRun = isInProgress && loading && logLines.length === 0;
  $: graphRepair = job?.progress?.graph_repair ?? null;
  $: stagesComplete = job?.progress?.processed ?? 0;
  $: stagesTotal = job?.progress?.total ?? CONNECT_INGEST_PIPELINE_STAGES.length;
  $: showGraphRepairPanel = Boolean(graphRepair && isGraphRepairTask);
  $: trustScore = job?.progress?.quality_report?.kg_audit?.trust_score;
  $: okPct = job?.progress?.quality_report?.ok_pct;
  // The REAL captured unit count for the completion cap. Job-level `progress.processed`
  // is the completed-STAGE count (the reporter persists CONNECT_INGEST_PIPELINE_STAGES
  // .length there), so it must NOT be quoted as units. The quality report carries the
  // true count as `units` (mirrors neon.ts `total_count`: `report.units ??` the
  // validation breakdown sum). Null → honest "—" in the cap (absence, not a stage count).
  $: runUnitCount = (() => {
    const qr = job?.progress?.quality_report;
    if (!qr) return null;
    if (typeof qr.units === "number" && Number.isFinite(qr.units)) return qr.units;
    const v = qr.validation;
    if (v) {
      const sum = (v.ok ?? 0) + (v.weak ?? 0) + (v.unsupported ?? 0) + (v.unvalidated ?? 0);
      if (Number.isFinite(sum)) return sum;
    }
    return null;
  })();

  // ── K5 run attribution: which route/model served each stage ────────────────
  // Display-only (read-only): no fetch added → the mobile-readonly contract's
  // 2-mutation-fetch invariant for this console is unchanged. Row-building lives in
  // $lib/connect/run-attribution-display so the with/without-attribution + legacy
  // cases are unit-testable.
  $: attribution = job?.progress?.attribution ?? null;
  $: attributionRows = buildAttributionRows(attribution, DASHBOARD_BASE);
  $: attributionRecordedFromDate = attributionRecordedFrom(attribution);
  $: attributionRecordedFromLabel = attributionRecordedFromDate
    ? attributionRecordedFromDate.toLocaleString()
    : null;
  /** True once the run is settled and we still have no attribution → honest absent-state. */
  $: showAttributionAbsent =
    isCompleted && attributionRows.length === 0 && job?.progress?.execution_mode === "full";
  $: runDurationLabel =
    isCompleted && job?.created_at && job?.updated_at
      ? formatRunDuration(new Date(job.updated_at).getTime() - new Date(job.created_at).getTime())
      : "";

  // ── Stall / reclaim visibility (Stage 1.6 durable-runs) ──────────────────
  // Threshold after which a running job with no new heartbeat is considered stalled.
  // Imported from `$lib/connect/run-stall` so the console and the topbar live-run
  // chip share ONE 90s definition (matches the graph-repair panel convention).
  const WORKER_LOST_PREFIX = "worker_lost";

  /**
   * True when the job is running but the worker heartbeat has gone stale.
   * Only fires for in-progress jobs; never for healthy healthy runs.
   */
  $: isStalled =
    isInProgress &&
    job != null &&
    (() => {
      const hb = job!.worker_heartbeat_at;
      const lease = job!.lease_expires_at;
      if (hb == null && lease == null) return false; // legacy row — can't tell
      if (lease != null && lease < nowMs) return true; // lease expired
      if (hb != null && nowMs - hb > STALL_NOTICE_MS) return true; // heartbeat stale
      return false;
    })();

  /** True when the most-recent run was reclaimed (worker_lost) and later re-queued. */
  $: isReclaimedRun =
    job?.status === "running" || job?.status === "pending"
      ? (job?.reclaim_count ?? 0) > 0
      : false;

  /**
   * W4.1 §3.2: when stalled, surface the lease countdown in plain words. Derived
   * from the W1.4 `lease_expires_at` already on the row (no new data). Null when no
   * lease is known (legacy rows) so the stamp falls back to generic stall copy.
   */
  $: leaseCountdownLabel = (() => {
    const lease = job?.lease_expires_at;
    if (lease == null || !Number.isFinite(lease)) return null;
    const remainMs = lease - nowMs;
    if (remainMs > 0) {
      const sec = Math.max(1, Math.round(remainMs / 1000));
      return sec < 60
        ? `Lease expires in ${sec}s.`
        : `Lease expires in ${Math.round(sec / 60)}m.`;
    }
    return "Lease has expired — reclaim is in progress.";
  })();

  // ── W4.1 Machine Room derivations (all from EXISTING SSE/loaded state) ─────
  // Heartbeat strip — the `▮▮▮▮▯` tick-line + "LAST WORKER SIGNAL Xs AGO" above the
  // CRT log. `frameTick` (bumped per applied live frame) walks the filled cell so it
  // breathes with each worker signal; the static signal-age label is the
  // reduced-motion fallback (always informs even with animation off).
  $: heartbeat = buildHeartbeatStrip({
    workerHeartbeatAt: job?.worker_heartbeat_at,
    updatedAtIso: job?.updated_at,
    nowMs,
    // Reduced motion → freeze the walk at a constant tick so the bar holds still; the
    // static signal-age label still informs. Otherwise the live frame counter advances it.
    tick: prefersReducedMotion ? 0 : frameTick,
    stalled: isStalled,
  });
  // Per-stage odometers — extracted / validated / … counting up live from the real
  // streamed `progress.processed` per stage. Shown while in progress; honest 0 when a
  // stage has no metrics yet, never a guessed number.
  $: stageOdometers = isInProgress ? buildStageOdometers(job?.stages, job?.current_stage) : [];
  // Single completion ledger (B-P1-1) — QUOTES the same quality-report numbers the
  // scorecard surfaced (W2.3 single-source rule); this only formats the verdict cap.
  $: completionLedger = isCompleted
    ? buildCompletionLedger({
        trustScore: trustScore ?? null,
        okPct: okPct ?? null,
        // Real captured unit count from the quality report — NOT the completed-stage
        // count (`progress.processed`), which would headline "7 units captured".
        totalUnits: runUnitCount,
      })
    : null;

  /** True for a job that failed with a worker_lost error. */
  $: isWorkerLost =
    job?.status === "failed" && (job?.error?.startsWith(WORKER_LOST_PREFIX) ?? false);
  // K3 (K-P2-1): known worker failure codes render as plain-language copy + fix link.
  $: failureHelp = isWorkerLost ? null : mapConnectRunFailure(job?.error, DASHBOARD_BASE);
  $: restartBlockedRows = failingPreflightRows(restartPreflight);

  /**
   * A worker_lost failure is a recoverable reclaim — offer Restart prominently
   * alongside normal failed-run handling.
   */
  $: canRestart =
    isWorkerLost ||
    job?.status === "failed" ||
    job?.status === "cancelled" ||
    (job?.status === "completed" && (isStubPreview || job?.progress?.execution_mode === "full"));

  function handleVisibilityChange() {
    if (document.hidden) {
      // Stop polling while the tab is hidden — background tabs were a steady
      // 0.7 req/s/viewer multiplier on the shared function + Neon compute.
      // (The live SSE client binds its own visibility pause.)
      if (pollTimer) {
        clearTimeout(pollTimer);
        pollTimer = null;
      }
    } else if (liveDegraded && job && (job.status === "pending" || job.status === "running")) {
      // Fallback-poll path only: catch up immediately on return; loadLive reschedules.
      void loadLive(true);
    }
  }

  let reducedMotionQuery: MediaQueryList | null = null;
  function syncReducedMotion() {
    prefersReducedMotion = reducedMotionQuery?.matches ?? false;
  }

  onMount(() => {
    clockTimer = setInterval(() => {
      nowMs = Date.now();
    }, 1000);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    // MINOR-2: freeze the heartbeat walk when reduced motion is preferred; react live
    // if the OS setting flips while the console is open.
    if (typeof window !== "undefined" && typeof window.matchMedia === "function") {
      reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
      syncReducedMotion();
      reducedMotionQuery.addEventListener?.("change", syncReducedMotion);
    }
  });

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
        // K3: blocked restarts carry the preflight — render per-provider repair links.
        if (res.status === 422 && d.error === "preflight_blocked" && d.preflight) {
          restartPreflight = d.preflight as ConnectRunPreflightResult;
        }
        actionMsg = d.message ?? `Could not restart (HTTP ${res.status}).`;
        return;
      }
      restartPreflight = null;
      const newId = d.job?.id;
      if (!newId) {
        actionMsg = "Restart succeeded but no new run id was returned.";
        return;
      }
      const suffix = fromPipeline
        ? "?from=pipeline"
        : fromGraph
          ? `?from=graph${graphTask ? `&task=${graphTask}` : ""}`
          : fromHub
            ? "?from=hub"
            : "";
      await goto(`${RUNS_HREF}/${newId}${suffix}`);
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
      if (incremental) frameTick += 1; // W4.1: fallback poll also advances the strip.
      if (typeof d.workspace_id === "string") {
        graphWorkspaceId = d.workspace_id;
      }
      maybeInvalidateGraphOnComplete();
      appendLogLines(Array.isArray(d.log_lines) ? d.log_lines : []);
      if (typeof d.log_line_total === "number") logLineTotal = d.log_line_total;
      if (typeof d.since === "number") since = d.since;
      // Only the fallback path keeps polling; under live SSE we don't reschedule.
      if (liveDegraded) schedulePoll();
    } catch {
      error = "Network error while loading run status.";
    } finally {
      loading = false;
    }
  }

  /**
   * When a graph-tool run completes, refresh the graph/hub caches once. Shared by
   * the initial/fallback fetch and the live SSE path so the behaviour survives the
   * transport swap (a fromGraph run that completes over SSE still invalidates).
   */
  function maybeInvalidateGraphOnComplete() {
    if (
      fromGraph &&
      !graphDataInvalidated &&
      job?.status === "completed" &&
      job?.progress?.execution_mode === "full"
    ) {
      graphDataInvalidated = true;
      const wsId = graphWorkspaceId;
      if (wsId) {
        void invalidate(`app:connect-graph:${wsId}`);
        void invalidate(`app:connect-hub:${wsId}`);
      }
    }
  }

  /** Append new log lines (capped) and keep the screen scrolled to the tail. */
  function appendLogLines(lines: string[]) {
    if (lines.length === 0) return;
    logLines = [...logLines, ...lines];
    if (logLines.length > 600) logLines = logLines.slice(-600);
    queueMicrotask(() => {
      if (logEl) logEl.scrollTop = logEl.scrollHeight;
    });
  }

  /** Apply one live SSE frame to the console state. */
  function onLiveEvent(event: LiveRunStreamEvent) {
    if (event.type === "snapshot") {
      const match = event.jobs.find((j) => j.id === jobId);
      if (match) {
        job = { ...(job ?? {}), ...match } as Job;
        frameTick += 1; // W4.1: advance the heartbeat strip on each applied frame.
      }
      // Catch-up tail carried on focused (re)connect snapshots — append the gap
      // and ADVANCE `since` so the next reconnect / fallback resumes here without
      // loss or duplication (MAJOR-1/2). Workspace snapshots omit these fields.
      if (event.logLines) appendLogLines(event.logLines);
      if (typeof event.logLineTotal === "number") logLineTotal = event.logLineTotal;
      if (typeof event.since === "number") since = event.since;
      // A completion can arrive via the reconnect snapshot (tab hidden during the
      // run, returned after it finished) — invalidate graph/hub here too (MAJOR-3).
      maybeInvalidateGraphOnComplete();
      loading = false;
      return;
    }
    if (event.type === "delta" && event.job.id === jobId) {
      job = { ...(job ?? {}), ...event.job } as Job;
      frameTick += 1; // W4.1: advance the heartbeat strip on each applied frame.
      if (event.logLines) appendLogLines(event.logLines);
      if (typeof event.logLineTotal === "number") logLineTotal = event.logLineTotal;
      // Advance the log cursor from the delta so engageFallback()/reconnect picks
      // up exactly where SSE left off — never re-appending delivered lines (MAJOR-2).
      if (typeof event.since === "number") since = event.since;
      maybeInvalidateGraphOnComplete();
      loading = false;
    }
    // heartbeat: the clock timer already advances nowMs; nothing to apply.
  }

  function startLive() {
    if (typeof window === "undefined" || liveClient) return;
    liveClient = new LiveRunEventClient({
      // URL PROVIDER — rebuilt per (re)connect so the CURRENT log `since` is sent
      // each time. This is the resume mechanism: the first snapshot after connect
      // replays everything after `since`, so a 50s reconnect or hidden-tab gap
      // drops no log lines (MAJOR-1).
      urlProvider: () => `${EVENTS_API}?job=${encodeURIComponent(jobId)}&since=${since}`,
      onEvent: onLiveEvent,
      onFallback: engageFallback,
      onLive: () => {
        liveDegraded = false;
        if (pollTimer) {
          clearTimeout(pollTimer);
          pollTimer = null;
        }
      },
    });
    liveClient.start();
  }

  function stopLive() {
    liveClient?.stop();
    liveClient = null;
  }

  /** SSE judged unhealthy → fall back to the F8-diet poll with a visible note. */
  function engageFallback() {
    liveDegraded = true;
    schedulePoll();
    // Pull once immediately so the fallback isn't a poll-interval behind.
    void loadLive(true);
  }

  function schedulePoll() {
    if (!liveDegraded) return; // live SSE owns updates; never double-poll
    if (pollTimer) clearTimeout(pollTimer);
    // Hidden tab: skip scheduling — handleVisibilityChange resumes on return.
    if (typeof document !== "undefined" && document.hidden) return;
    if (job && (job.status === "pending" || job.status === "running")) {
      // ±20% jitter de-synchronizes multiple consoles/tabs polling in lockstep.
      const delay = Math.round(pollMs * (0.8 + Math.random() * 0.4));
      pollTimer = setTimeout(() => loadLive(true), delay);
    }
  }

  // Re-initialise ONLY when the run id actually changes. The block reads
  // `pollTimer`/`since`/etc., so without this guard any reassignment of those
  // reactive vars elsewhere (e.g. engageFallback advancing the cursor / scheduling
  // a poll) would re-fire it — resetting `since` to 0 and re-fetching from the
  // start, which is exactly the log-loss + duplication MAJOR-1/2 guard against.
  let loadedJobId: string | null = null;
  $: if (jobId && jobId !== loadedJobId) {
    loadedJobId = jobId;
    since = 0;
    logLines = [];
    logOpen = true;
    frameTick = 0;
    liveDegraded = false;
    stopLive();
    if (pollTimer) {
      clearTimeout(pollTimer);
      pollTimer = null;
    }
    void loadLive(false).then(() => {
      // After the initial snapshot is on screen, open the live channel.
      startLive();
    });
  }

  async function refreshGraphReview() {
    if (refreshingGraph) return;
    refreshingGraph = true;
    try {
      if (graphWorkspaceId) {
        await invalidate(`app:connect-graph:${graphWorkspaceId}`);
        await invalidate(`app:connect-hub:${graphWorkspaceId}`);
      }
      await goto(CLAIMS_HREF);
    } finally {
      refreshingGraph = false;
    }
  }

  onDestroy(() => {
    stopLive();
    if (pollTimer) clearTimeout(pollTimer);
    if (clockTimer) clearInterval(clockTimer);
    if (typeof document !== "undefined") {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    }
    reducedMotionQuery?.removeEventListener?.("change", syncReducedMotion);
  });
</script>

<section class="run-console" aria-labelledby="run-console-heading">
  {#if loading && !job}
    <p class="run-muted" role="status">Loading run console…</p>
  {:else if error}
    <p class="run-error" role="alert">{error}</p>
  {:else if job}
    <header class="run-head" class:run-head-active={isInProgress}>
      <div>
        <h1 id="run-console-heading" class="run-title">{job.label ?? "Ingest run"}</h1>
        <p class="run-meta">
          <span class="run-status-badge" class:run-status-badge-active={isInProgress} class:run-status-badge-done={isCompleted} class:run-status-badge-stalled={isStalled}>
            {#if isInProgress && !isStalled}
              <span class="run-status-pulse" aria-hidden="true"></span>
            {/if}
            {#if isStalled}
              <span class="run-status-stall-icon" aria-hidden="true">⚠</span>
            {/if}
            {ingestStatusLabel(job.status)}{#if isStalled} — Stalled{/if}
          </span>
          <code class="run-id">{job.id}</code>
          {#if (job.reclaim_count ?? 0) > 0}
            <span class="run-reclaim-badge">reclaimed ×{job.reclaim_count}</span>
          {/if}
        </p>
        {#if runDurationLabel}
          <p class="run-duration">{runDurationLabel}</p>
        {/if}
      </div>
      {#if canRestart}
        <div class="run-actions">
          <button
            type="button"
            class="btn btn-primary run-restart-btn"
            on:click={restartJob}
            disabled={restarting}
          >
            {restarting ? "Restarting…" : runAgainLabel}
          </button>
          <a
            class="btn btn-outline run-view-runs-btn"
            href={RUNS_HREF}
          >View all runs</a>
        </div>
      {/if}
    </header>

    {#if isEmbedBackfill && !isCompleted}
      <div class="run-context-banner" role="note">
        <strong>Re-embed — graph maintenance, not a new ingest.</strong>
        This fills in missing embedding vectors for ideas already in your graph so semantic search and
        agent retrieval can use them. It does <em>not</em> re-extract or re-ingest your documents, and only
        the embedding stage runs — the other pipeline stages are skipped.
      </div>
    {/if}

    {#if startingRun}
      <p class="run-starting" role="status">{isEmbedBackfill ? "Starting re-embed…" : "Starting your run…"}</p>
    {/if}

    {#if liveDegraded && isInProgress}
      <p class="run-live-degraded" role="status">
        Live updates degraded to polling — refreshing every ~2.5s instead. The run is unaffected.
      </p>
    {/if}

    {#if actionMsg}
      <p class="run-notice" role="status">{actionMsg}</p>
    {/if}

    {#if showCompletedLinkSourcesBanner}
      <div class="run-success" role="status">
        <strong>Source linking complete.</strong>
        Matched ideas now have source titles and links in your graph store.
        <button
          type="button"
          class="btn btn-primary run-refresh-btn"
          on:click={refreshGraphReview}
          disabled={refreshingGraph}
        >
          {refreshingGraph ? "Refreshing…" : "Refresh graph review"}
        </button>
        to reload the idea list with updated provenance. Counts on this page already refreshed in the background.
      </div>
    {/if}

    <!-- W4.1 B-P1-1 (MAJOR-1): the default-case "Run complete" banner is DELETED, not
         hidden — its CTAs (Open the graph explorer / connect your agent) duplicated the
         completion ledger body that now stacks below on every full run. Only the
         task-specific banners survive, where their content is distinct from the ledger
         (graph-repair / embed-backfill / revalidate handoffs). `showCompletedTaskBanner`
         gates strictly on those tasks, so a plain full run renders the ledger ALONE. -->
    {#if showCompletedTaskBanner}
      <div class="run-success" role="status">
        <strong>Run complete.</strong>
        {#if graphTask === "auto-remediate"}
          Auto-remediation finished — repaired ideas were re-validated and re-embedded when routes allowed.
          Items still in quarantine need human review.
          <a href={CLAIMS_HREF + "?filter=review"}>Return to quarantine queue</a>
          (this page already reloaded graph data). Check the log for repaired, dropped, and skipped counts.
        {:else if graphTask === "embed-backfill"}
          Embed backfill finished — missing ideas were vectorized when the embedding route succeeded.
          <a href={CLAIMS_HREF + "?workspace=tools&focus=embed"}>Return to graph review</a>
          to confirm the embedded count (this page already reloaded graph data). Check the log for batch errors.
        {:else}
          Validation statuses were written to your graph store when source text was available.
          <a href={CLAIMS_HREF}>Return to graph review</a>
          to refresh the Supported / Unchecked counts (this page already reloaded graph data).
          If counts are unchanged, open the log below for “Skipped … no source text” lines.
        {/if}
      </div>
    {/if}

    {#if job.status === "completed" && isStubPreview}
      <div class="run-warn" role="status">
        <strong>Preview run — nothing was written to your graph store.</strong>
        This run only simulated pipeline progress. With Surreal connected in the pipeline wizard, new runs
        write to your database automatically. Use <strong>Restart run</strong> or
        <a href={pipelineWizardHref("launch")}>start a new run</a>.
      </div>
    {/if}

    <!-- W4.1 B-P1-1: ONE completion ledger replaces the old stacked
         success-banner + scorecard + "What to do next" blocks. Verdict cap (trust
         numeral + supported %) above a single next-actions body. The numbers QUOTE
         the run's quality report (W2.3 single-source rule), labelled "this run's
         audit". The duplicate blocks are deleted, not hidden. -->
    {#if job.progress?.quality_report && isCompleted && completionLedger}
      <section class="completion-ledger" aria-labelledby="completion-ledger-heading">
        {#if job.progress.quality_report.stub_warning}
          <p class="run-warn" role="status">{job.progress.quality_report.stub_warning}</p>
        {/if}
        <!-- Verdict cap -->
        <div class="ledger-cap ledger-cap--{completionLedger.trustTint}">
          <p class="ledger-cap-kicker">This run's audit</p>
          <h2 id="completion-ledger-heading" class="ledger-cap-verdict">
            <span class="ledger-cap-numeral">{completionLedger.trustScore}</span>
            <span class="ledger-cap-word">{completionLedger.verdict}</span>
          </h2>
          <p class="ledger-cap-stats">
            <!-- Honest absence (MINOR-3): no okPct reported → "— supported", muted, never
                 a fabricated 0% in red. -->
            <span class="ledger-cap-stat ledger-cap-stat--{completionLedger.supportedTint}">
              {#if completionLedger.supportedPct === "—"}— supported{:else}{completionLedger.supportedPct}% supported{/if}
            </span>
            <!-- Real captured unit count (quality report's `units`), never the
                 completed-stage count. Dropped entirely when the run didn't report it,
                 so the cap never headlines a stage tally as units. -->
            {#if completionLedger.totalUnits !== "—"}
              <span class="ledger-cap-sep" aria-hidden="true">·</span>
              <span class="ledger-cap-stat">{completionLedger.totalUnits} units captured</span>
            {/if}
          </p>
          <!-- K4/K-P1-7: validating-family disclosure (graceful absent-state until K5) -->
          {#if job.progress.quality_report.validation_family?.validation_provider}
            {@const vf = job.progress.quality_report.validation_family}
            <p class="run-family-disclosure" role="status">
              Validated by <strong>{vf.validation_provider}</strong>{#if vf.extraction_provider}
                — {vf.cross_family ? "different family than" : "same family as"} extraction
                ({vf.extraction_provider}){/if}{#if vf.cross_family === true}
                · cross-model validation ✓{:else if vf.cross_family === false}
                · add a second provider family for cross-model validation{/if}
            </p>
          {:else}
            <p class="run-family-disclosure run-family-disclosure--absent">
              Validating model family: not recorded for this run.
            </p>
          {/if}
        </div>

        <!-- Single next-actions body -->
        <div class="ledger-body">
        <h3 class="run-next-actions-title">What to do next</h3>
        <ol class="run-next-list">
          {#if (trustScore ?? 0) < 80}
            <li class="run-next-item run-next-item-primary">
              <span class="run-next-num">1</span>
              <span class="run-next-text">Review weak units in the graph explorer</span>
              <a class="btn btn-primary btn-sm" href={CLAIMS_HREF + "?filter=review"}>Open quarantine queue →</a>
            </li>
            <li class="run-next-item">
              <span class="run-next-num">2</span>
              <span class="run-next-text">Explore what was captured</span>
              <a class="btn btn-outline btn-sm" href={CLAIMS_HREF}>View graph →</a>
            </li>
            <li class="run-next-item">
              <span class="run-next-num">3</span>
              <span class="run-next-text">Connect an agent to start querying</span>
              <a class="btn btn-outline btn-sm" href={AGENTS_HREF}>Set up agent →</a>
            </li>
          {:else}
            <li class="run-next-item run-next-item-primary">
              <span class="run-next-num">1</span>
              <span class="run-next-text">Explore what was captured</span>
              <a class="btn btn-primary btn-sm" href={CLAIMS_HREF}>View graph →</a>
            </li>
            <li class="run-next-item">
              <span class="run-next-num">2</span>
              <span class="run-next-text">Connect an agent to start querying</span>
              <a class="btn btn-outline btn-sm" href={AGENTS_HREF}>Set up agent →</a>
            </li>
            <li class="run-next-item">
              <span class="run-next-num">3</span>
              <span class="run-next-text">Run again with more documents</span>
              <a class="btn btn-outline btn-sm" href={pipelineWizardHref("launch")}>New run →</a>
            </li>
          {/if}
        </ol>
        <!-- W3.4 cross-link: run console → workspace trust scorecard. Every trust
             number on the cap is its own receipt — the standing scorecard. -->
        <p class="run-cross-links">
          <a class="run-cross-link" href={HOME_HREF + "#trust-ledger"}>View workspace trust scorecard →</a>
          <span class="run-cross-sep" aria-hidden="true">·</span>
          <a class="run-cross-link" href={RUNS_HREF}>All ingest runs →</a>
        </p>
        </div>
      </section>
    {/if}

    {#if job.error}
      <div class="run-error-banner" role="alert">
        <p class="run-error-banner-title">
          {#if isWorkerLost}
            <strong>Worker lost — run stalled</strong>
          {:else}
            <strong>Run failed</strong>
          {/if}
        </p>
        <p class="run-error-banner-body">
          {#if isWorkerLost}
            The worker stopped responding before the lease expired and the run was reclaimed
            automatically. Nothing in your graph store was corrupted — the run can be restarted
            from the last checkpoint.
          {:else if failureHelp}
            <strong>{failureHelp.title}.</strong>
            {failureHelp.body}
          {:else}
            {job.error}
          {/if}
        </p>
        {#if failureHelp}
          <details class="run-error-raw">
            <summary>Raw error (for support)</summary>
            <code>{job.error}</code>
          </details>
        {/if}
        {#if restartBlockedRows.length > 0}
          <ul class="run-error-preflight-list">
            {#each restartBlockedRows as row (row.provider)}
              <li>
                {preflightIssueCopy(row)}
                <a class="run-error-fix-link" href={row.fixHref}>{row.fixLabel} →</a>
              </li>
            {/each}
          </ul>
        {/if}
        {#if canRestart}
          <div class="run-error-banner-actions">
            {#if failureHelp}
              <a class="btn btn-primary btn-sm" href={failureHelp.fixHref}>{failureHelp.fixLabel} →</a>
              <!-- K4: failure codes map back to the standing readiness ledger (§3),
                   relocated onto /home with the dissolved Connect hub (R2). -->
              <a class="btn btn-outline btn-sm" href={HOME_HREF + "#readiness"}>Check readiness</a>
            {/if}
            <button
              type="button"
              class="btn {failureHelp ? 'btn-outline' : 'btn-primary'} btn-sm"
              on:click={restartJob}
              disabled={restarting}
            >
              {restarting ? "Restarting…" : isWorkerLost ? "Restart from checkpoint" : runAgainLabel}
            </button>
            <a class="btn btn-outline btn-sm" href={RUNS_HREF}>View all runs</a>
          </div>
        {/if}
      </div>
    {/if}

    <div class="run-grid" class:run-grid-active={isInProgress}>
      <BrutalCard fill="canvas" title={showGraphRepairPanel ? "Unit progress" : "Progress"}>
        {#if showGraphRepairPanel && graphRepair}
          <ConnectGraphRepairProgress
            graphRepair={graphRepair}
            jobStatus={job.status}
            jobUpdatedAt={job.updated_at}
            percent={percent}
          />
        {:else}
          <div class="progress-panel">
            <div class="progress-readout" aria-live="polite">
              <span class="progress-pct">{percent}<span class="progress-pct-suffix">%</span></span>
              <span class="progress-eta">{isInProgress ? (isStalled ? "Stalled" : "Running") : "Run progress"}</span>
            </div>
            <div
              class="progress-track"
              role="progressbar"
              aria-valuemin="0"
              aria-valuemax="100"
              aria-valuenow={percent}
              aria-label="Ingest progress"
            >
              <div class="progress-fill progress-fill-yellow" style:width="{percent}%"></div>
              <div class="progress-segments" aria-hidden="true">
                {#each CONNECT_INGEST_PIPELINE_STAGES as _}
                  <span></span>
                {/each}
              </div>
            </div>
            {#if job.progress}
              <p class="run-muted progress-detail">
                {#if isEmbedBackfill}
                  Embedding stage only — other pipeline stages are skipped for re-embed.
                {:else}
                  {stagesComplete} of {stagesTotal} stages complete
                {/if}
              </p>
            {/if}
            <!-- The live "Last worker signal Xs ago" readout lives once, in the
                 Machine Room heartbeat strip below (W4.1) — it breathes with the
                 SSE frames and carries the STALLED stamp. The static duplicate that
                 used to sit here was removed in W4.4 (filed #296: duplicate
                 "Last worker signal" readouts). -->
            {#if isStalled}
              <!-- W4.1 §3.2: STALLED as a designed amber moment — the stamp prints
                   the durable-runs contract in plain words (true to Stage 1.6). -->
              <div class="progress-stall-notice" role="status">
                <span class="progress-stall-stamp">⚠ STALLED</span>
                <p class="progress-stall-body">
                  {#if leaseCountdownLabel}
                    {leaseCountdownLabel} A stalled run is reclaimed and resumes from the last
                    checkpoint — nothing is lost.
                  {:else}
                    No worker heartbeat detected. A stalled run is reclaimed automatically and
                    resumes from the last checkpoint — nothing is lost.
                  {/if}
                </p>
              </div>
            {/if}
            {#if isReclaimedRun && !isStalled}
              <!-- W4.1 §3.2: RECLAIMED as a green ledger line. `isReclaimedRun`
                   already guarantees reclaim_count > 0, so the count renders
                   unconditionally — the redundant inner guard was removed in W4.4
                   (filed #296: redundant reclaim guard). -->
              <p class="progress-reclaim-ledger" role="status">
                <span class="reclaim-tag">RECLAIMED</span>
                · resumed from checkpoint after a stall (×{job.reclaim_count})
              </p>
            {/if}
          </div>
        {/if}
        {#if showGraphRepairPanel}
          <div
            class="progress-track progress-track-compact"
            role="progressbar"
            aria-valuemin="0"
            aria-valuemax="100"
            aria-valuenow={percent}
            aria-label="Graph repair progress"
          >
            <div class="progress-fill progress-fill-yellow" style:width="{percent}%"></div>
          </div>
        {/if}
      </BrutalCard>

      {#if isCompleted}
        <details class="run-collapsible">
          <summary>Show pipeline details ↓</summary>
          <BrutalCard fill="white" title="Pipeline">
            <ConnectIngestPipelineTimeline
              stages={job.stages ?? []}
              currentStageKey={job.current_stage}
              currentAction={job.current_action}
              jobStatus={job.status}
            />
          </BrutalCard>
        </details>
      {:else}
        <BrutalCard fill="white" title="Pipeline">
          <ConnectIngestPipelineTimeline
            stages={job.stages ?? []}
            currentStageKey={job.current_stage}
            currentAction={job.current_action}
            jobStatus={job.status}
          />
        </BrutalCard>
      {/if}
    </div>

    <!-- K5: run attribution — which route/model served each stage. Read-only;
         route name links to the builder (X4 grammar: route → builder). -->
    {#if attributionRows.length > 0}
      <section class="run-attribution" aria-labelledby="run-attribution-heading">
        <h2 id="run-attribution-heading" class="run-attribution-heading">Served by</h2>
        <ul class="run-attribution-list">
          {#each attributionRows as row (row.stage)}
            <li class="run-attribution-row">
              <span class="run-attribution-stage">{row.label}</span>
              <span class="run-attribution-line">
                <strong>{row.modelId}</strong>
                <span class="run-attribution-sep" aria-hidden="true">·</span>
                {row.provider}
                {#if row.routeName}
                  <span class="run-attribution-sep" aria-hidden="true">·</span>
                  {#if row.builderHref}
                    <a class="run-attribution-route" href={row.builderHref}
                      >route {row.routeName}{#if row.stepDisplay} ({row.stepDisplay}){/if} →</a
                    >
                  {:else}
                    <span class="run-attribution-route-plain"
                      >route {row.routeName}{#if row.stepDisplay} ({row.stepDisplay}){/if}</span
                    >
                  {/if}
                {/if}
                <span class="run-attribution-sep" aria-hidden="true">·</span>
                {row.attempts}
                {row.attempts === 1 ? "attempt" : "attempts"}
                {#if row.crossFamilyVsExtraction === true}
                  <span class="run-attribution-cross run-attribution-cross--ok"
                    >· cross-model ✓</span
                  >
                {:else if row.crossFamilyVsExtraction === false}
                  <span class="run-attribution-cross run-attribution-cross--same"
                    >· same family as extraction</span
                  >
                {/if}
              </span>
            </li>
          {/each}
        </ul>
        {#if attributionRecordedFromLabel}
          <p class="run-attribution-note">Attribution recorded from {attributionRecordedFromLabel}.</p>
        {/if}
      </section>
    {:else if showAttributionAbsent}
      <section class="run-attribution" aria-labelledby="run-attribution-heading">
        <h2 id="run-attribution-heading" class="run-attribution-heading">Served by</h2>
        <p class="run-attribution-note run-attribution-note--absent" role="status">
          Route/model attribution was not recorded for this run — it predates attribution
          capture. New runs record which route and model served each stage.
        </p>
      </section>
    {/if}

    {#if !startingRun && isInProgress && !showGraphRepairPanel}
      <!-- W4.1 Machine Room: heartbeat strip + per-stage odometers ride the live
           SSE frames (no new fetch). Both have static reduced-motion fallbacks. -->
      <section
        class="machine-room"
        class:machine-room--stalled={isStalled}
        aria-label="Live run instrumentation"
      >
        <div class="heartbeat-strip" class:heartbeat-strip--stalled={heartbeat.stalled}>
          <span class="heartbeat-bar" aria-hidden="true">{heartbeat.bar}</span>
          <span class="heartbeat-label">
            {#if heartbeat.stalled}
              <span class="heartbeat-stalled-stamp">STALLED</span>
            {:else}
              Last worker signal {heartbeat.signalAgeLabel}
            {/if}
          </span>
        </div>

        {#if stageOdometers.length > 0}
          <ol class="odometers" aria-label="Per-stage progress">
            {#each stageOdometers as od (od.stage)}
              <li
                class="odometer"
                class:odometer--running={od.running}
                class:odometer--done={od.status === "completed"}
              >
                <span class="odometer-label">{od.label}</span>
                <span class="odometer-count">
                  <span class="odometer-value">{od.count.toLocaleString()}</span>
                  {#if od.total}
                    <span class="odometer-total">/ {od.total.toLocaleString()}</span>
                  {/if}
                </span>
              </li>
            {/each}
          </ol>
        {/if}
      </section>
    {/if}

    {#if !startingRun}
      {#if isInProgress}
        <section class="run-log-panel" aria-labelledby="run-log-heading">
          <h2 id="run-log-heading" class="run-log-heading">
            Activity log
            <span class="run-log-count">({logLines.length} lines)</span>
          </h2>
          <div
            id="run-log-screen"
            class="log-screen"
            role="log"
            aria-live="polite"
            aria-relevant="additions"
            aria-labelledby="run-log-heading"
            bind:this={logEl}
          >
            <pre class="log-screen-pre">{logLines.join("\n") || "— awaiting worker output —"}</pre>
          </div>
        </section>
      {:else if logOpen}
        <section class="run-log-panel" aria-labelledby="run-log-heading">
          <div class="run-log-panel-head">
            <h2 id="run-log-heading" class="run-log-heading">
              Activity log
              <span class="run-log-count">({logLines.length} lines)</span>
            </h2>
            <button
              type="button"
              class="run-log-collapse-btn brut-focus"
              aria-expanded="true"
              aria-controls="run-log-screen"
              on:click={() => (logOpen = false)}
            >
              Collapse log
            </button>
          </div>
          <div
            id="run-log-screen"
            class="log-screen"
            role="log"
            aria-labelledby="run-log-heading"
            bind:this={logEl}
          >
            <pre class="log-screen-pre">{logLines.join("\n") || "— awaiting worker output —"}</pre>
          </div>
        </section>
      {:else}
        <div class="run-log-collapsed">
          <button
            type="button"
            class="run-log-expand-btn brut-focus"
            aria-expanded="false"
            aria-controls="run-log-screen"
            on:click={() => (logOpen = true)}
          >
            Activity log ({logLines.length} lines) — expand
          </button>
        </div>
      {/if}
    {/if}

    {#if canCancel}
      <p class="run-cancel-wrap">
        <button type="button" class="run-cancel-link" on:click={cancelJob} disabled={cancelling}>
          {cancelling ? "Cancelling…" : "Cancel run"}
        </button>
      </p>
    {/if}
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
    padding-top: var(--space-1);
  }

  .run-restart-btn {
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    font-weight: 700;
    letter-spacing: var(--text-mono-tracking);
    text-transform: uppercase;
  }

  .run-view-runs-btn {
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
  }

  .run-status-badge-stalled {
    background: color-mix(in oklab, var(--brut-amber) 20%, var(--brut-white));
    border-color: var(--brut-amber);
    color: var(--rm-text);
  }

  .run-status-stall-icon {
    font-size: 0.85em;
  }

  .run-reclaim-badge {
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    font-weight: 700;
    letter-spacing: 0.04em;
    padding: 0 var(--space-2);
    border: var(--border-thin, 1px solid) var(--brut-amber);
    color: var(--rm-text);
    background: color-mix(in oklab, var(--brut-amber) 12%, var(--brut-white));
  }

  .run-error-banner {
    margin: 0 0 var(--space-4);
    padding: var(--space-3) var(--space-4);
    border: var(--brut-border-width) solid var(--brut-coral);
    background: color-mix(in oklab, var(--brut-coral) 14%, var(--brut-white));
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .run-error-banner-title {
    margin: 0;
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    text-transform: uppercase;
    letter-spacing: var(--text-mono-tracking);
    color: var(--rm-text);
  }

  .run-error-banner-body {
    margin: 0;
    font-size: var(--text-sm);
    color: var(--rm-text);
    line-height: 1.5;
  }

  .run-error-banner-actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    align-items: center;
  }

  /* K3 (K-P2-1): human failure copy keeps the raw code reachable for support. */
  .run-error-raw {
    margin: 0;
    font-size: var(--text-xs);
    color: var(--rm-muted);
  }

  .run-error-raw summary {
    cursor: pointer;
  }

  .run-error-raw code {
    display: block;
    margin-top: var(--space-1);
    word-break: break-word;
  }

  .run-error-preflight-list {
    margin: 0;
    padding-left: var(--space-4);
    font-size: var(--text-sm);
    color: var(--rm-text);
    display: grid;
    gap: var(--space-1);
  }

  .run-error-fix-link {
    font-weight: 600;
    margin-left: var(--space-1);
  }

  .run-notice {
    margin: 0;
    padding: var(--space-3) var(--space-4);
    border: var(--brut-border-micro) solid var(--brut-ink);
    background: var(--brut-white);
    color: var(--rm-muted);
    font-size: var(--text-sm);
  }

  /* W3.1: SSE → poll degraded note (transport honesty, not an error). */
  .run-live-degraded {
    margin: 0;
    padding: var(--space-2) var(--space-3);
    border: var(--brut-border-micro) solid var(--brut-amber);
    background: color-mix(in oklab, var(--brut-amber) 12%, var(--brut-white));
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    color: var(--rm-text);
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

  .run-success .run-refresh-btn {
    margin: var(--space-2) var(--space-2) 0 0;
    vertical-align: baseline;
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

  .run-context-banner {
    margin: 0 0 var(--space-4);
    padding: var(--space-3) var(--space-4);
    border: var(--brut-border-width) solid var(--rm-border);
    background: color-mix(in oklab, var(--color-blue, #1b3b6f) 8%, var(--brut-white));
    color: var(--rm-text);
    font-size: var(--text-sm);
    line-height: 1.5;
  }
  .run-context-banner strong {
    display: block;
    margin-bottom: var(--space-1);
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
    font-family: var(--font-display);
    font-size: var(--text-display-metric);
    font-weight: 900;
    line-height: var(--text-display-line-height);
    letter-spacing: var(--text-display-tracking);
    text-transform: uppercase;
    color: var(--rm-text);
  }

  .run-status-badge {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    font-weight: 700;
    letter-spacing: var(--text-mono-tracking);
    text-transform: uppercase;
    border: var(--border);
    padding: var(--space-1) var(--space-2);
  }

  .run-status-badge-active {
    background: var(--color-ink);
    color: var(--color-yellow);
  }

  .run-status-badge-done {
    background: transparent;
    color: var(--color-ink);
  }

  .run-status-pulse {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--color-ink);
    animation: run-pulse 1.2s ease-in-out infinite;
  }

  @keyframes run-pulse {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.35;
    }
  }

  .run-duration {
    margin: var(--space-1) 0 0;
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    color: var(--rm-muted);
  }

  .run-starting {
    margin: 0;
    font-size: var(--text-sm);
    color: var(--rm-muted);
    animation: run-pulse 1.5s ease-in-out infinite;
  }

  .progress-fill-yellow {
    background: var(--color-ink) !important;
  }

  /* ── W4.1 Machine Room: heartbeat strip + per-stage odometers ───────────── */
  .machine-room {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    padding: var(--space-3) var(--space-4);
    border: var(--brut-border-width) solid var(--brut-ink);
    background: var(--brut-crt-bg);
    box-shadow: inset 0 0 0 2px color-mix(in oklab, var(--brut-crt-fg) 12%, transparent);
  }

  .machine-room--stalled {
    border-color: var(--brut-amber);
    box-shadow: inset 0 0 0 2px color-mix(in oklab, var(--brut-amber) 30%, transparent);
  }

  .heartbeat-strip {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    font-family: var(--rm-font-mono);
  }

  .heartbeat-bar {
    font-family: var(--rm-font-mono);
    font-size: var(--text-mono-md);
    letter-spacing: 0.25em;
    color: var(--brut-crt-fg);
    /* The bar text itself changes per frame; this soft fade smooths the step. */
    transition: opacity 200ms ease;
  }

  .heartbeat-strip--stalled .heartbeat-bar {
    color: var(--brut-amber);
  }

  .heartbeat-label {
    font-family: var(--rm-font-mono);
    font-size: var(--text-mono-sm);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: color-mix(in oklab, var(--brut-crt-fg) 80%, var(--brut-white));
  }

  .heartbeat-stalled-stamp {
    color: var(--brut-amber);
    font-weight: 700;
    border: var(--brut-border-micro) solid var(--brut-amber);
    padding: 0 var(--space-2);
    animation: machine-blink 1s steps(2, end) infinite;
  }

  @keyframes machine-blink {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.4;
    }
  }

  .odometers {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(6.5rem, 1fr));
    gap: var(--space-2);
  }

  .odometer {
    display: flex;
    flex-direction: column;
    gap: 0.1rem;
    padding: var(--space-2);
    border: var(--brut-border-micro) solid color-mix(in oklab, var(--brut-crt-fg) 35%, transparent);
    background: color-mix(in oklab, var(--brut-crt-fg) 5%, transparent);
  }

  .odometer--running {
    border-color: var(--brut-crt-fg);
    box-shadow: 0 0 0 1px var(--brut-crt-fg);
    animation: machine-pulse 1.4s ease-in-out infinite;
  }

  .odometer--done {
    opacity: 0.7;
  }

  @keyframes machine-pulse {
    0%,
    100% {
      box-shadow: 0 0 0 1px var(--brut-crt-fg);
    }
    50% {
      box-shadow: 0 0 0 2px color-mix(in oklab, var(--brut-crt-fg) 60%, transparent);
    }
  }

  .odometer-label {
    font-family: var(--rm-font-mono);
    font-size: 0.625rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: color-mix(in oklab, var(--brut-crt-fg) 75%, var(--brut-white));
  }

  .odometer-count {
    display: flex;
    align-items: baseline;
    gap: 0.25rem;
  }

  .odometer-value {
    font-family: var(--rm-font-mono);
    font-size: var(--text-mono-lg);
    font-weight: 700;
    color: var(--brut-crt-fg);
    font-variant-numeric: tabular-nums;
  }

  .odometer-total {
    font-family: var(--rm-font-mono);
    font-size: var(--text-mono-sm);
    color: color-mix(in oklab, var(--brut-crt-fg) 60%, var(--brut-white));
    font-variant-numeric: tabular-nums;
  }

  /* K4/K-P1-7: validating-family disclosure line */
  .run-family-disclosure {
    margin: var(--space-2) 0 0;
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    color: var(--rm-muted);
    line-height: 1.45;
  }

  .run-family-disclosure--absent {
    color: var(--rm-dim, var(--rm-muted));
  }

  /* K5: per-stage "Served by" attribution block. Brutal: hard border, flat fill,
     mono evidence lines, route name as the only link (route → builder). */
  .run-attribution {
    border: var(--border);
    background: var(--color-surface);
    box-shadow: var(--shadow-sm);
    padding: var(--space-4);
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .run-attribution-heading {
    margin: 0;
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: var(--text-mono-tracking);
  }

  .run-attribution-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .run-attribution-row {
    display: grid;
    grid-template-columns: minmax(6rem, max-content) 1fr;
    gap: var(--space-2) var(--space-3);
    align-items: baseline;
    min-height: 28px;
    padding: var(--space-1) 0;
    border-top: var(--brut-border-micro) solid color-mix(in oklab, var(--brut-ink) 14%, transparent);
  }

  .run-attribution-row:first-child {
    border-top: none;
  }

  .run-attribution-stage {
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--color-ink-faint);
  }

  .run-attribution-line {
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    color: var(--rm-text);
    line-height: 1.5;
    word-break: break-word;
  }

  .run-attribution-sep {
    color: var(--rm-muted);
    user-select: none;
  }

  .run-attribution-route {
    color: var(--rm-sage);
    text-decoration: underline;
  }

  .run-attribution-route:hover {
    color: var(--brut-ink);
  }

  .run-attribution-route-plain {
    color: var(--rm-muted);
  }

  .run-attribution-cross--ok {
    color: var(--rm-sage);
    font-weight: 700;
  }

  .run-attribution-cross--same {
    color: var(--rm-muted);
  }

  .run-attribution-note {
    margin: 0;
    font-size: var(--text-xs);
    color: var(--rm-muted);
  }

  .run-attribution-note--absent {
    color: var(--rm-dim, var(--rm-muted));
    line-height: 1.45;
  }

  /* ── W4.1 B-P1-1: one completion ledger (verdict cap + single next body) ── */
  .completion-ledger {
    border: var(--border);
    background: var(--color-surface);
    box-shadow: var(--shadow-md);
    display: flex;
    flex-direction: column;
  }

  .ledger-cap {
    padding: var(--space-5) var(--space-4) var(--space-4);
    border-bottom: var(--brut-border-width) solid var(--brut-ink);
    background: var(--brut-neon);
  }

  .ledger-cap--red {
    background: color-mix(in oklab, var(--brut-coral) 45%, var(--brut-white));
  }

  .ledger-cap--yellow {
    background: color-mix(in oklab, var(--brut-amber) 40%, var(--brut-white));
  }

  .ledger-cap--green {
    background: var(--brut-neon);
  }

  .ledger-cap--muted {
    background: color-mix(in oklab, var(--brut-ink) 8%, var(--brut-white));
  }

  .ledger-cap-kicker {
    margin: 0 0 var(--space-1);
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--rm-text);
  }

  .ledger-cap-verdict {
    margin: 0;
    display: flex;
    align-items: baseline;
    flex-wrap: wrap;
    gap: var(--space-2) var(--space-3);
  }

  .ledger-cap-numeral {
    font-family: var(--font-display);
    font-size: var(--text-display-metric);
    font-weight: 900;
    line-height: var(--text-display-line-height);
    letter-spacing: var(--text-display-tracking);
    color: var(--rm-text);
  }

  .ledger-cap-word {
    font-family: var(--font-mono);
    font-size: var(--text-mono-lg);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: var(--text-mono-tracking);
    color: var(--rm-text);
  }

  .ledger-cap-stats {
    margin: var(--space-2) 0 0;
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: var(--space-1) var(--space-2);
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    color: var(--rm-text);
  }

  .ledger-cap-stat {
    font-weight: 700;
  }

  .ledger-cap-stat--red {
    color: var(--coral-alert, var(--brut-coral));
  }

  /* Honest-absence supported stat (no okPct reported): dimmed, not alarming red. */
  .ledger-cap-stat--muted {
    color: var(--rm-muted);
    font-weight: 400;
  }

  .ledger-cap-sep {
    user-select: none;
    opacity: 0.6;
  }

  .ledger-body {
    padding: var(--space-4);
  }

  .run-next-actions-title {
    margin: 0 0 var(--space-3);
    font-family: var(--font-mono);
    font-size: var(--text-mono-lg);
    font-weight: 700;
    letter-spacing: var(--text-mono-tracking);
    text-transform: uppercase;
  }

  .run-next-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .run-next-item {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2) var(--space-3);
  }

  .run-next-num {
    font-family: var(--font-mono);
    font-weight: 700;
    min-width: 1.25rem;
  }

  .run-next-text {
    flex: 1;
    min-width: 12rem;
  }

  /* W3.4 cross-links */
  .run-cross-links {
    margin-top: var(--space-4);
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-1) var(--space-3);
    font-size: var(--text-xs);
  }

  .run-cross-link {
    color: var(--rm-muted);
    text-decoration: underline;
    font-family: var(--font-mono);
    font-size: var(--text-xs);
  }

  .run-cross-link:hover {
    color: var(--brut-ink);
  }

  .run-cross-sep {
    color: var(--rm-muted);
    user-select: none;
  }

  .run-collapsible summary {
    cursor: pointer;
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    font-weight: 700;
    margin-bottom: var(--space-2);
    min-height: 44px;
    display: flex;
    align-items: center;
  }

  .run-log-panel {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .run-log-panel-head {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
  }

  .run-log-heading {
    margin: 0;
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  .run-log-count {
    font-weight: 400;
    text-transform: none;
    letter-spacing: normal;
    color: var(--rm-muted);
  }

  .run-log-collapse-btn,
  .run-log-expand-btn {
    min-height: 44px;
    padding: 0.5rem 0.75rem;
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    font-weight: 700;
    border: var(--brut-border-micro) solid var(--brut-ink);
    background: var(--brut-white);
    cursor: pointer;
  }

  .run-log-expand-btn {
    width: 100%;
    text-align: left;
  }

  .run-log-collapsed {
    margin: 0;
  }

  .run-cancel-wrap {
    margin: var(--space-4) 0 0;
    text-align: center;
  }

  .run-cancel-link {
    background: none;
    border: none;
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    color: var(--color-ink-faint);
    cursor: pointer;
    text-decoration: underline;
    min-height: 44px;
  }

  @media (min-width: 960px) {
    .run-grid-active {
      grid-template-columns: 1fr 1fr;
    }
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
    padding: var(--space-6) var(--space-5);
    border: var(--border);
    box-shadow: var(--shadow-md);
    background: var(--color-surface);
  }

  .progress-readout {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: var(--space-3);
    font-family: var(--rm-font-mono);
  }

  .progress-pct {
    font-family: var(--font-display);
    font-size: var(--text-display-metric);
    font-weight: 900;
    letter-spacing: var(--text-display-tracking);
    line-height: var(--text-display-line-height);
  }

  .progress-pct-suffix {
    font-size: 0.45em;
    opacity: 0.7;
  }

  .progress-eta {
    font-size: var(--text-mono-md);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: var(--text-mono-tracking);
  }

  .progress-track {
    position: relative;
    height: 1.25rem;
    border: var(--brut-border-width) solid var(--brut-ink);
    background: var(--brut-white);
    box-shadow: inset 2px 2px 0 color-mix(in oklab, var(--brut-ink) 12%, transparent);
  }

  .progress-track-compact {
    margin-top: var(--space-3);
    height: 0.75rem;
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

  /* W4.1 §3.2: STALLED as a designed amber stamp + plain-words contract body. */
  .progress-stall-notice {
    margin: 0;
    padding: var(--space-2) var(--space-3);
    border: var(--brut-border-width) solid var(--brut-amber);
    background: color-mix(in oklab, var(--brut-amber) 14%, var(--brut-white));
    color: var(--rm-text);
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .progress-stall-stamp {
    align-self: flex-start;
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: var(--text-mono-tracking);
    color: var(--rm-text);
    border: var(--brut-border-micro) solid var(--brut-amber);
    background: color-mix(in oklab, var(--brut-amber) 30%, var(--brut-white));
    padding: 0 var(--space-2);
    transform: rotate(-1.5deg);
  }

  .progress-stall-body {
    margin: 0;
    font-size: var(--text-sm);
    line-height: 1.45;
  }

  /* W4.1 §3.2: RECLAIMED as a green mono ledger line. */
  .progress-reclaim-ledger {
    margin: 0;
    padding: var(--space-2) var(--space-3);
    border: var(--brut-border-micro) solid var(--brut-sage, var(--rm-sage));
    background: color-mix(in oklab, var(--rm-sage) 12%, var(--brut-white));
    font-family: var(--font-mono);
    font-size: var(--text-mono-sm);
    color: var(--rm-text);
    line-height: 1.45;
  }

  .reclaim-tag {
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: var(--text-mono-tracking);
    color: var(--rm-sage);
  }

  .pipeline-lede {
    margin: 0 0 var(--space-3);
    font-size: var(--text-xs);
  }

  .log-meta {
    margin-bottom: var(--space-2);
  }

  .log-screen {
    max-height: 22rem;
    overflow: auto;
    padding: var(--space-2);
    border: var(--brut-border-width) solid var(--brut-ink);
    background: var(--brut-crt-bg);
    color: var(--brut-crt-fg);
    font-family: var(--rm-font-mono);
    font-size: 0.6875rem;
    line-height: 1.35;
    box-shadow: inset 0 0 0 2px color-mix(in oklab, var(--brut-crt-fg) 15%, transparent);
  }
  .log-screen-pre {
    margin: 0;
    font: inherit;
    color: inherit;
    white-space: pre-wrap;
    word-break: break-word;
  }

  /* X9: reduced-motion kill-switch. The Machine Room is animation-heavy by design;
     with motion off, every moving part holds still while the STATIC instrumentation
     still informs — the heartbeat tick-line + "last signal Xs ago" text, the live
     odometer numbers, the STALLED stamp, the verdict cap. Covers the pre-existing
     status pulse + starting text too. */
  @media (prefers-reduced-motion: reduce) {
    .run-status-pulse,
    .run-starting,
    .heartbeat-stalled-stamp,
    .odometer--running {
      animation: none !important;
    }
    .heartbeat-bar {
      transition: none !important;
    }
  }
</style>
