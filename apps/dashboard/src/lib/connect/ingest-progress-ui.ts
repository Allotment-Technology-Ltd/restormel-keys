/** Client-safe ingest progress formatting + SOPHIA-aligned stage row presentation. */
import type { ConnectIngestStage } from "@restormel/contracts/connect";
import {
  CONNECT_INGEST_PIPELINE_STAGES,
  applyConnectPipelineFocus,
  buildConnectPipelineStageRows,
  type ConnectIngestStageProgress,
} from "@restormel/connect-core";

export function formatIngestEta(seconds: number | undefined | null): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds <= 0) return "—";
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

export function ingestStatusVariant(
  status: string,
): "neon" | "blue" | "coral" | "canvas" {
  if (status === "completed") return "blue";
  if (status === "failed" || status === "cancelled") return "coral";
  if (status === "running") return "neon";
  return "canvas";
}

type StageRow = { stage: string; status: string };

/** Display status for one pipeline tile (trust persisted row after server reconcile). */
export function resolveIngestStageDisplayStatus(args: {
  stageKey: ConnectIngestStage | string;
  row: StageRow | undefined;
  jobStatus: string;
  currentStage?: string | null;
}): string {
  const persisted = args.row?.status ?? "pending";
  const idx = CONNECT_INGEST_PIPELINE_STAGES.indexOf(args.stageKey as ConnectIngestStage);
  const cur = (args.currentStage ?? "").trim();
  const curIdx = CONNECT_INGEST_PIPELINE_STAGES.indexOf(cur as ConnectIngestStage);

  if (persisted === "running" && curIdx >= 0 && idx >= 0 && idx < curIdx) {
    return "completed";
  }

  if (persisted !== "pending") return persisted;

  if (args.jobStatus === "running" && cur && args.stageKey === cur) {
    return "running";
  }

  if (args.jobStatus === "completed") return "completed";

  return persisted;
}

/** Normalize stage rows on read using current focus (SOPHIA snapshot semantics). */
export function reconcileConnectIngestJobStagesForApi(
  stages: ConnectIngestStageProgress[],
  job: {
    status: string;
    currentStage?: string | null;
    currentAction?: string | null;
  },
): ConnectIngestStageProgress[] {
  const cur = job.currentStage?.trim();
  if (
    job.status === "running" &&
    cur &&
    (CONNECT_INGEST_PIPELINE_STAGES as readonly string[]).includes(cur)
  ) {
    const focused = applyConnectPipelineFocus(
      stages,
      cur as ConnectIngestStage,
      job.currentAction?.trim() || "",
    );
    return focused.stages.map((row) => {
      const orig = stages.find((s) => s.stage === row.stage);
      if (row.stage === cur && orig?.progress) {
        return { ...row, progress: orig.progress };
      }
      return row;
    });
  }

  return stages.map((row) => {
    const status = resolveIngestStageDisplayStatus({
      stageKey: row.stage,
      row,
      jobStatus: job.status,
      currentStage: job.currentStage,
    });
    return status === row.status ? row : { ...row, status: status as ConnectIngestStageProgress["status"] };
  });
}

export { buildConnectPipelineStageRows };
