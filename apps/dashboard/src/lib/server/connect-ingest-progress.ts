/**
 * Incremental telemetry for Connect ingest runs: bracket logs, stage rows, progress %, ETA.
 * Pipeline focus semantics mirror SOPHIA `applyPipelineFocusFromLog` (single running stage).
 */
import type { ConnectIngestStage } from "@restormel/contracts/connect";
import {
  CONNECT_INGEST_PIPELINE_STAGES,
  applyConnectPipelineFocus,
  normalizeConnectIngestStages,
} from "@restormel/connect-core";
import type {
  ConnectIngestStageProgress,
  ConnectIngestStageProgressMetrics,
} from "@restormel/connect-core";
import { formatBracketLogLine } from "$lib/connect/bracket-log-timeline";
import {
  appendConnectIngestJobLog,
  updateConnectIngestJobById,
  type ConnectIngestJobRecord,
  type ConnectIngestJobResumeCheckpoint,
} from "$lib/server/connect-ingest-jobs";
import {
  mergeStageAttribution,
  type ConnectModelStage,
  type ConnectRunAttribution,
  type ConnectStageAttribution,
} from "$lib/server/connect/stage-attribution";

export type GraphRepairProgress = {
  job_kind: "graph_revalidate";
  mode: "validate" | "validate_and_remediate";
  phase: "loading" | "validating" | "remediating" | "storing" | "done";
  units_total: number;
  units_processed: number;
  sources_total: number;
  sources_done: number;
  batches_total?: number;
  batches_done?: number;
  /** Remediation work model (weak/unsupported units the run attempts to repair). */
  remediation_units_total?: number;
  remediation_units_done?: number;
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

export type ConnectIngestProgressSnapshot = {
  percent: number;
  processed: number;
  total: number;
  execution_mode?: "stub" | "full";
  graph_repair?: GraphRepairProgress;
  /** Stage 1.6 durable runs — completed-stage checkpoint (survives every persist). */
  resume?: ConnectIngestJobResumeCheckpoint;
  /** K5 run attribution — which route/step/provider/model served each stage. */
  attribution?: ConnectRunAttribution;
};

const STAGE_TAGS: Record<ConnectIngestStage, string> = {
  extracting: "EXTRACT",
  relating: "RELATE",
  grouping: "GROUP",
  embedding: "EMBED",
  validating: "VALIDATE",
  remediating: "REMEDIATE",
  storing: "STORE",
};

const STAGE_LABELS: Record<ConnectIngestStage, string> = {
  extracting: "Extracting graph units",
  relating: "Relating units",
  grouping: "Grouping units",
  embedding: "Embedding vectors",
  validating: "Validating units",
  remediating: "Remediating weak units",
  storing: "Storing to graph",
};

export function stageBracketTag(stage: ConnectIngestStage | string): string {
  return STAGE_TAGS[stage as ConnectIngestStage] ?? String(stage).toUpperCase();
}

export function stageHumanLabel(stage: ConnectIngestStage | string): string {
  return STAGE_LABELS[stage as ConnectIngestStage] ?? String(stage);
}

export function computeConnectIngestEtaSeconds(args: {
  runStartedAtMs: number;
  processed: number;
  total: number;
  nowMs?: number;
}): number | undefined {
  const now = args.nowMs ?? Date.now();
  const elapsedMs = now - args.runStartedAtMs;
  if (elapsedMs < 1500 || args.processed <= 0 || args.total <= 0 || args.processed >= args.total) {
    return undefined;
  }
  const rate = args.processed / elapsedMs;
  if (rate <= 0) return undefined;
  const remaining = args.total - args.processed;
  return Math.max(1, Math.round(remaining / rate / 1000));
}

export function buildStageProgressMetrics(args: {
  processed: number;
  total: number;
  startedAtMs: number;
  nowMs?: number;
}): ConnectIngestStageProgressMetrics {
  const total = Math.max(1, args.total);
  const processed = Math.min(total, Math.max(0, args.processed));
  const percent = Math.min(100, Math.round((processed / total) * 100));
  const eta_seconds = computeConnectIngestEtaSeconds({
    runStartedAtMs: args.startedAtMs,
    processed,
    total,
    nowMs: args.nowMs,
  });
  return {
    percent,
    processed,
    total,
    ...(eta_seconds != null ? { eta_seconds } : {}),
  };
}

export function mergeStageProgress(
  stages: ConnectIngestStageProgress[],
  stage: ConnectIngestStage,
  patch: Partial<ConnectIngestStageProgress>,
): ConnectIngestStageProgress[] {
  return stages.map((row) => (row.stage === stage ? { ...row, ...patch } : row));
}

export function percentFromStageIndex(stageIndex: number, stageCount: number, intra = 0): number {
  if (stageCount <= 0) return 0;
  const base = (stageIndex / stageCount) * 100;
  const slice = 100 / stageCount;
  return Math.min(100, Math.max(0, Math.round(base + slice * Math.min(1, Math.max(0, intra)))));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class ConnectIngestProgressReporter {
  private activeStage: ConnectIngestStage | null = null;
  private stageStartedAtMs = Date.now();
  private stageProcessed = 0;
  private stageTotal = 1;
  private stages: ConnectIngestStageProgress[];
  private currentAction = "";
  private currentStage: ConnectIngestStage | null = null;
  private graphRepair: GraphRepairProgress | null = null;
  private resumeCheckpoint: ConnectIngestJobResumeCheckpoint | null;
  /** K5 run attribution accumulated across stages (restart-safe — see constructor). */
  private attribution: ConnectRunAttribution | null;

  constructor(private job: ConnectIngestJobRecord) {
    this.stages = parseStages(job.stages);
    // Preserve a prior attempt's checkpoint across every persist — a reclaimed run's
    // restart relies on it to skip already-completed (and already-paid-for) stages.
    this.resumeCheckpoint = job.progress?.resume ?? null;
    // K5: carry forward attribution captured before a stall so a reclaimed run that
    // skips checkpointed stages keeps their "Served by" entries (append, not clobber).
    this.attribution =
      (job.progress as { attribution?: ConnectRunAttribution } | null)?.attribution ?? null;
  }

  /**
   * K5: record which route/step/provider/model served a stage (last successful
   * attempt + attempt count). Merges into the prior map (bounded to the five known
   * stages) and persists so the run console can render the "Served by" block live.
   */
  async recordStageAttribution(
    stage: ConnectModelStage,
    entry: ConnectStageAttribution,
  ): Promise<void> {
    this.attribution = mergeStageAttribution(this.attribution, stage, entry);
    await this.persist("running");
  }

  /**
   * K5: replace the in-memory attribution map (used to flush the collector's full
   * snapshot before complete(), so the completed row is deterministic even when the
   * per-stage recordStageAttribution persists were fired-and-forgotten). Does not
   * persist on its own — complete()/the next persist picks it up.
   */
  setAttribution(attribution: ConnectRunAttribution | null): void {
    if (attribution && Object.keys(attribution).length > 0) {
      this.attribution = attribution;
    }
  }

  getAttribution(): ConnectRunAttribution | null {
    return this.attribution;
  }

  /**
   * Persist the durable resume checkpoint (Stage 1.6). Written by the full runner
   * after each completed source / pipeline tail so a reclaimed run resumes here.
   */
  async setResumeCheckpoint(checkpoint: ConnectIngestJobResumeCheckpoint): Promise<void> {
    this.resumeCheckpoint = checkpoint;
    await this.persist("running");
  }

  getResumeCheckpoint(): ConnectIngestJobResumeCheckpoint | null {
    return this.resumeCheckpoint;
  }

  /** Initialize graph re-validation / auto-remediation unit progress overlay. */
  initGraphRepair(args: {
    mode: GraphRepairProgress["mode"];
    units_total: number;
    sources_total: number;
    quarantine_before?: number;
  }): void {
    const now = new Date().toISOString();
    this.graphRepair = {
      job_kind: "graph_revalidate",
      mode: args.mode,
      phase: "loading",
      units_total: Math.max(0, args.units_total),
      units_processed: 0,
      sources_total: Math.max(1, args.sources_total),
      sources_done: 0,
      repaired: 0,
      dropped: 0,
      skipped_no_source: 0,
      preview_only_sources: 0,
      sources_remediation_failed: 0,
      ...(args.quarantine_before != null ? { quarantine_before: args.quarantine_before } : {}),
      last_activity_at: now,
    };
  }

  /** Merge graph repair counters; bumps last_activity_at on every call. */
  async setGraphRepair(patch: Partial<GraphRepairProgress>): Promise<void> {
    if (!this.graphRepair) return;
    const now = new Date().toISOString();
    this.graphRepair = {
      ...this.graphRepair,
      ...patch,
      last_activity_at: now,
      ...(patch.last_error ? { last_error_at: now } : {}),
    };
    await this.persist("running");
  }

  getGraphRepair(): GraphRepairProgress | null {
    return this.graphRepair;
  }

  private snapshotForGraphRepair(nowMs?: number): ConnectIngestProgressSnapshot {
    const gr = this.graphRepair!;
    const unitsTotal = Math.max(1, gr.units_total);
    const unitsProcessed = Math.min(unitsTotal, Math.max(0, gr.units_processed));

    // Two-pass work model. When a run also remediates, validation can't own the
    // whole bar — otherwise a single-source graph hits 100% the moment validation
    // ends and then sits frozen (with a collapsing ETA) all through remediation.
    // Once remediation begins (remediation_units_total > 0) validation owns 0–80%
    // and remediation fills 80–98%; the final 2% is the storing/finalise step.
    const remTotal = Math.max(0, gr.remediation_units_total ?? 0);
    const remDone = Math.min(remTotal, Math.max(0, gr.remediation_units_done ?? 0));
    const valFraction = unitsProcessed / unitsTotal;
    const percent =
      remTotal > 0
        ? Math.min(98, Math.round(valFraction * 80 + (remDone / remTotal) * 18))
        : Math.min(100, Math.round(valFraction * 100));

    // The currently-running stage gets an honest per-stage progress row. Validation
    // is unit-paced (units_processed/total). Remediation is paced by its own stage
    // counters (set via beginStage + per-batch ticks) so its ETA reflects the slow
    // LLM passes, not the instant apply loop.
    if (this.activeStage === "validating") {
      const eta_seconds = computeConnectIngestEtaSeconds({
        runStartedAtMs: this.stageStartedAtMs,
        processed: unitsProcessed,
        total: unitsTotal,
        nowMs,
      });
      const valPercent = Math.min(100, Math.round(valFraction * 100));
      this.stages = mergeStageProgress(this.stages, "validating", {
        progress: {
          percent: valPercent,
          processed: unitsProcessed,
          total: unitsTotal,
          ...(eta_seconds != null ? { eta_seconds } : {}),
        },
      });
    } else if (this.activeStage === "remediating") {
      this.stages = mergeStageProgress(this.stages, "remediating", {
        progress: this.currentStageMetrics(nowMs),
      });
    }
    return {
      percent,
      processed: unitsProcessed,
      total: unitsTotal,
      graph_repair: { ...gr },
    };
  }

  private currentStageMetrics(nowMs?: number): ConnectIngestStageProgressMetrics {
    return buildStageProgressMetrics({
      processed: this.stageProcessed,
      total: this.stageTotal,
      startedAtMs: this.stageStartedAtMs,
      nowMs,
    });
  }

  private snapshot(nowMs?: number): ConnectIngestProgressSnapshot {
    if (this.graphRepair) return this.snapshotForGraphRepair(nowMs);
    const stageIdx = this.activeStage ? stageIndex(this.activeStage) : stageIndex(this.currentStage ?? "extracting");
    const intra = this.stageTotal > 0 ? this.stageProcessed / this.stageTotal : 0;
    const completedStages = this.stages.filter(
      (row) => row.status === "completed" || row.status === "skipped",
    ).length;
    return {
      percent: percentFromStageIndex(stageIdx, CONNECT_INGEST_PIPELINE_STAGES.length, intra),
      processed: completedStages,
      total: CONNECT_INGEST_PIPELINE_STAGES.length,
      ...(this.resumeCheckpoint ? { resume: this.resumeCheckpoint } : {}),
      ...(this.attribution ? { attribution: this.attribution } : {}),
    };
  }

  /** SOPHIA-style single-writer: sync stage map + current action in one update. */
  private applyFocus(stage: ConnectIngestStage, summaryLine: string): void {
    const focused = applyConnectPipelineFocus(this.stages, stage, summaryLine);
    this.stages = focused.stages;
    this.currentStage = focused.currentStage;
    this.currentAction = focused.currentAction;
    if (this.activeStage === stage || this.activeStage == null) {
      this.stages = mergeStageProgress(this.stages, stage, {
        progress: this.currentStageMetrics(),
      });
    }
  }

  private async persist(status: string, patch?: { error?: string | null; clearStage?: boolean }): Promise<void> {
    await updateConnectIngestJobById({
      id: this.job.id,
      status,
      ...(patch?.clearStage ? { currentStage: null } : this.currentStage ? { currentStage: this.currentStage } : {}),
      currentAction: this.currentAction,
      stages: this.stages,
      progress: this.snapshot(),
      ...(patch?.error !== undefined ? { error: patch.error } : {}),
      // Worker fencing: a zombie reporter (instance resumed after its job was
      // reclaimed) must not resurrect or scribble over the job row.
      workerId: this.job.workerId ?? null,
    });
  }

  async log(tag: string, body: string): Promise<void> {
    if (this.graphRepair) {
      this.graphRepair = {
        ...this.graphRepair,
        last_activity_at: new Date().toISOString(),
      };
      await appendConnectIngestJobLog({
        jobId: this.job.id,
        line: formatBracketLogLine(tag, body),
      });
      // Keep unit-progress overlay in sync with log lines (heartbeats, standalone messages).
      await this.persist("running");
      return;
    }
    await appendConnectIngestJobLog({
      jobId: this.job.id,
      line: formatBracketLogLine(tag, body),
    });
  }

  /**
   * Re-persist progress mid-stage so a slow stage (e.g. a multi-minute LLM batch)
   * keeps the UI alive — the ETA recomputes from elapsed time and an optional
   * message lands in the activity log. Safe to call from a timer.
   */
  async heartbeat(message?: string): Promise<void> {
    if (message) {
      if (this.activeStage) this.applyFocus(this.activeStage, message);
      await this.log(this.activeStage ? stageBracketTag(this.activeStage) : "INGEST", message);
    }
    await this.persist("running");
  }

  async setAction(action: string): Promise<void> {
    this.currentAction = action;
    if (this.activeStage) {
      this.applyFocus(this.activeStage, action);
    }
    await this.persist("running");
  }

  async beginRun(message = "Worker claimed run"): Promise<void> {
    this.stageStartedAtMs = Date.now();
    await this.log("INGEST", message);
    this.currentAction = "Starting pipeline…";
    await this.persist("running");
  }

  async beginStage(
    stage: ConnectIngestStage,
    action?: string,
    totalSteps = 1,
  ): Promise<void> {
    this.activeStage = stage;
    this.stageStartedAtMs = Date.now();
    this.stageProcessed = 0;
    this.stageTotal = Math.max(1, Math.round(totalSteps));
    const label = action ?? stageHumanLabel(stage);
    this.applyFocus(stage, label);
    await this.log(stageBracketTag(stage), label);
    await this.persist("running");
  }

  async tick(
    stage: ConnectIngestStage,
    message: string,
    bump = 1,
    graphRepairPatch?: Partial<GraphRepairProgress>,
  ): Promise<void> {
    if (this.activeStage === stage) {
      this.stageProcessed = Math.min(this.stageTotal, this.stageProcessed + bump);
    }
    if (this.graphRepair && graphRepairPatch) {
      const now = new Date().toISOString();
      this.graphRepair = {
        ...this.graphRepair,
        ...graphRepairPatch,
        last_activity_at: now,
        ...(graphRepairPatch.last_error ? { last_error_at: now } : {}),
      };
    }
    this.applyFocus(stage, message);
    if (this.graphRepair) {
      await appendConnectIngestJobLog({
        jobId: this.job.id,
        line: formatBracketLogLine(stageBracketTag(stage), message),
      });
      await this.persist("running");
      return;
    }
    await this.log(stageBracketTag(stage), message);
    await this.persist("running");
  }

  async completeStage(stage: ConnectIngestStage, summary?: string): Promise<void> {
    const nowIso = new Date().toISOString();
    this.stageProcessed = this.stageTotal;
    const summaryLine = summary ?? `${stageHumanLabel(stage)} complete`;
    this.stages = mergeStageProgress(this.stages, stage, {
      status: "completed",
      completed_at: nowIso,
      progress: {
        percent: 100,
        processed: this.stageTotal,
        total: this.stageTotal,
        eta_seconds: 0,
      },
    });
    if (summary) await this.log(stageBracketTag(stage), summary);
    this.currentAction = summaryLine;
    this.currentStage = stage;
    if (this.activeStage === stage) this.activeStage = null;
    await this.persist("running");
  }

  async skipStage(stage: ConnectIngestStage, reason: string): Promise<void> {
    const nowIso = new Date().toISOString();
    this.stages = mergeStageProgress(this.stages, stage, {
      status: "skipped",
      completed_at: nowIso,
      progress: {
        percent: 100,
        processed: 1,
        total: 1,
        eta_seconds: 0,
      },
    });
    const line = `Skipped — ${reason}`;
    await this.log(stageBracketTag(stage), line);
    this.currentAction = line;
    this.currentStage = stage;
    if (this.activeStage === stage) this.activeStage = null;
    await this.persist("running");
  }

  async fail(stage: ConnectIngestStage | null, error: string): Promise<void> {
    const nowIso = new Date().toISOString();
    if (stage) {
      this.stages = mergeStageProgress(this.stages, stage, {
        status: "failed",
        completed_at: nowIso,
        error,
        progress: this.activeStage === stage ? this.currentStageMetrics() : undefined,
      });
      this.currentStage = stage;
    }
    this.currentAction = error;
    await this.log("FATAL", error);
    await this.persist("failed", { error });
  }

  async complete(
    summary: string,
    executionMode: "stub" | "full" = "stub",
    extraProgress?: Record<string, unknown>,
  ): Promise<void> {
    const nowIso = new Date().toISOString();
    this.stages = this.stages.map((row) =>
      row.status === "completed" || row.status === "skipped" || row.status === "failed"
        ? row
        : {
            ...row,
            status: "completed" as const,
            completed_at: nowIso,
            progress: { percent: 100, processed: 1, total: 1, eta_seconds: 0 },
          },
    );
    this.currentAction = summary;
    await this.log("INGEST", summary);
    if (executionMode === "stub") {
      await this.log(
        "INGEST",
        "Preview mode — no records written to your graph store. Connect Surreal in the pipeline wizard and restart the run.",
      );
    }
    const doneRepair = this.graphRepair
      ? {
          ...this.graphRepair,
          phase: "done" as const,
          units_processed: this.graphRepair.units_total,
          last_activity_at: new Date().toISOString(),
        }
      : undefined;
    await updateConnectIngestJobById({
      id: this.job.id,
      status: "completed",
      currentStage: null,
      currentAction: summary,
      stages: this.stages,
      workerId: this.job.workerId ?? null,
      progress: doneRepair
        ? {
            percent: 100,
            processed: doneRepair.units_total,
            total: doneRepair.units_total,
            execution_mode: executionMode,
            graph_repair: doneRepair,
            ...(extraProgress ?? {}),
          }
        : {
            percent: 100,
            processed: CONNECT_INGEST_PIPELINE_STAGES.length,
            total: CONNECT_INGEST_PIPELINE_STAGES.length,
            execution_mode: executionMode,
            // K5: persist final attribution on the completed row so the console
            // renders "Served by" after the run ends (extraProgress wins if it
            // explicitly carries its own attribution).
            ...(this.attribution ? { attribution: this.attribution } : {}),
            ...(extraProgress ?? {}),
          },
    });
  }

  getStages(): ConnectIngestStageProgress[] {
    return this.stages;
  }

  setTotalSteps(_total: number): void {
    // Overall totals are derived from pipeline stage count; per-stage totals use beginStage().
  }
}

function stageIndex(stage: ConnectIngestStage): number {
  return CONNECT_INGEST_PIPELINE_STAGES.indexOf(stage);
}

function parseStages(raw: unknown): ConnectIngestStageProgress[] {
  return normalizeConnectIngestStages(raw);
}

/** Stub worker: staged delays + logs so the operator UI shows live progress without LLM calls. */
export async function runStubIngestWithProgress(
  job: ConnectIngestJobRecord,
  _stages: ConnectIngestStageProgress[],
): Promise<{ stages: ConnectIngestStageProgress[]; status: "completed" }> {
  const reporter = new ConnectIngestProgressReporter(job);
  await reporter.beginRun("Stub worker — simulating pipeline for operator preview");
  const order = CONNECT_INGEST_PIPELINE_STAGES;
  const pauseRaw = Number(process.env.CONNECT_INGEST_STUB_PAUSE_MS ?? 450);
  const pauseMs = Math.max(
    0,
    Math.min(Number.isFinite(pauseRaw) ? pauseRaw : 450, 2000),
  );
  const stubTicks = 3;

  for (const stage of order) {
    await reporter.beginStage(stage, undefined, stubTicks);
    for (let i = 0; i < stubTicks; i++) {
      await sleep(Math.floor(pauseMs / stubTicks));
      await reporter.tick(stage, `${stageHumanLabel(stage)} — step ${i + 1}/${stubTicks}`);
    }
    await reporter.completeStage(stage, `${stageHumanLabel(stage)} OK`);
  }

  await reporter.complete("Run complete (stub bookkeeping)", "stub");
  return { stages: reporter.getStages(), status: "completed" };
}

export { formatIngestEta as formatEta } from "$lib/connect/ingest-progress-ui";
