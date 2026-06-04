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
} from "$lib/server/connect-ingest-jobs";

export type ConnectIngestProgressSnapshot = {
  percent: number;
  processed: number;
  total: number;
  execution_mode?: "stub" | "full";
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

  constructor(private job: ConnectIngestJobRecord) {
    this.stages = parseStages(job.stages);
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
    const stageIdx = this.activeStage ? stageIndex(this.activeStage) : stageIndex(this.currentStage ?? "extracting");
    const intra = this.stageTotal > 0 ? this.stageProcessed / this.stageTotal : 0;
    const completedStages = this.stages.filter(
      (row) => row.status === "completed" || row.status === "skipped",
    ).length;
    return {
      percent: percentFromStageIndex(stageIdx, CONNECT_INGEST_PIPELINE_STAGES.length, intra),
      processed: completedStages,
      total: CONNECT_INGEST_PIPELINE_STAGES.length,
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
    });
  }

  async log(tag: string, body: string): Promise<void> {
    await appendConnectIngestJobLog({
      jobId: this.job.id,
      line: formatBracketLogLine(tag, body),
    });
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

  async tick(stage: ConnectIngestStage, message: string, bump = 1): Promise<void> {
    if (this.activeStage === stage) {
      this.stageProcessed = Math.min(this.stageTotal, this.stageProcessed + bump);
    }
    this.applyFocus(stage, message);
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

  async complete(summary: string, executionMode: "stub" | "full" = "stub"): Promise<void> {
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
    await updateConnectIngestJobById({
      id: this.job.id,
      status: "completed",
      currentStage: null,
      currentAction: summary,
      stages: this.stages,
      progress: {
        percent: 100,
        processed: CONNECT_INGEST_PIPELINE_STAGES.length,
        total: CONNECT_INGEST_PIPELINE_STAGES.length,
        execution_mode: executionMode,
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
