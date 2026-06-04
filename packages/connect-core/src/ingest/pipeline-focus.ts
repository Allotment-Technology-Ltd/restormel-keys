/**
 * SOPHIA-aligned pipeline focus: one running stage, prior stages completed, later pending.
 * Keeps `current_stage`, `current_action`, and stage rows in sync for operator UIs.
 */
import type { ConnectIngestStage } from "@restormel/contracts/connect";
import { CONNECT_INGEST_PIPELINE_STAGES } from "./job-record.js";
import type { ConnectIngestStageProgress } from "./worker-stub.js";

const BRACKET_TAG = /^\s*\[([A-Z_]+)\]/;
const STAGE_HEADER = /STAGE\s+\d+:\s*([A-Z ]+)/i;

const TAG_TO_STAGE: Record<string, ConnectIngestStage> = {
  EXTRACT: "extracting",
  RELATE: "relating",
  GROUP: "grouping",
  EMBED: "embedding",
  VALIDATE: "validating",
  REMEDIATE: "remediating",
  STORE: "storing",
  INGEST: "extracting",
};

/** Map bracket tag or stage alias (SOPHIA `stageAliasToKey`) to Connect stage key. */
export function connectStageFromBracketTag(tag: string | null | undefined): ConnectIngestStage | null {
  const t = (tag ?? "").trim().toUpperCase();
  if (!t) return null;
  if (TAG_TO_STAGE[t]) return TAG_TO_STAGE[t]!;
  return connectStageAliasToKey(t);
}

export function connectStageAliasToKey(value: string | null | undefined): ConnectIngestStage | null {
  const low = (value ?? "").trim().toLowerCase();
  if (!low) return null;
  if (low.startsWith("extract")) return "extracting";
  if (low.startsWith("relat")) return "relating";
  if (low.startsWith("group")) return "grouping";
  if (low.startsWith("embed")) return "embedding";
  if (low.startsWith("validat")) return "validating";
  if (low.startsWith("remediat")) return "remediating";
  if (low.startsWith("stor")) return "storing";
  return null;
}

function mergeStage(
  stages: ConnectIngestStageProgress[],
  stage: ConnectIngestStage,
  patch: Partial<ConnectIngestStageProgress>,
): ConnectIngestStageProgress[] {
  return stages.map((row) => (row.stage === stage ? { ...row, ...patch } : row));
}

function doneProgress(): ConnectIngestStageProgress["progress"] {
  return { percent: 100, processed: 1, total: 1, eta_seconds: 0 };
}

/**
 * Single-writer focus update (mirrors SOPHIA `applyPipelineFocusFromLog`).
 * Ensures at most one `running` stage and aligns prior/later stage statuses.
 */
export function applyConnectPipelineFocus(
  stages: ConnectIngestStageProgress[],
  activeKey: ConnectIngestStage,
  summaryLine: string,
  nowIso = new Date().toISOString(),
): {
  stages: ConnectIngestStageProgress[];
  currentStage: ConnectIngestStage;
  currentAction: string;
} {
  const order = CONNECT_INGEST_PIPELINE_STAGES;
  const idx = order.indexOf(activeKey);
  if (idx < 0) {
    return { stages, currentStage: activeKey, currentAction: summaryLine };
  }

  let next = stages;

  for (let i = 0; i < idx; i++) {
    const k = order[i]!;
    const row = next.find((r) => r.stage === k);
    if (row?.status === "skipped") continue;
    if (row?.status === "completed" || row?.status === "failed") continue;
    next = mergeStage(next, k, {
      status: "completed",
      completed_at: nowIso,
      progress: doneProgress(),
    });
  }

  const activeRow = next.find((r) => r.stage === activeKey);
  if (activeRow?.status !== "skipped") {
    next = mergeStage(next, activeKey, {
      status: "running",
      started_at: activeRow?.started_at ?? nowIso,
    });
  }

  for (let i = idx + 1; i < order.length; i++) {
    const k = order[i]!;
    const row = next.find((r) => r.stage === k);
    if (row?.status === "skipped" || row?.status === "completed" || row?.status === "failed") {
      continue;
    }
    next = mergeStage(next, k, { status: "pending" });
  }

  return {
    stages: next,
    currentStage: activeKey,
    currentAction: summaryLine,
  };
}

/** Parse a worker log line for stage focus (SOPHIA `ingestProgressFromLogLine`, Connect bracket tags). */
export function connectIngestProgressFromLogLine(
  rawLine: string,
): { stage: ConnectIngestStage; summaryLine: string } | null {
  const line = rawLine.trim();
  if (!line) return null;

  const bracket = line.match(BRACKET_TAG);
  if (bracket?.[1]) {
    const stage = connectStageFromBracketTag(bracket[1]);
    if (stage && bracket[1].toUpperCase() !== "INGEST" && bracket[1].toUpperCase() !== "FATAL") {
      return { stage, summaryLine: line };
    }
  }

  const stageHeader = line.match(STAGE_HEADER);
  const stage = connectStageAliasToKey(stageHeader?.[1] ?? null);
  if (stage) return { stage, summaryLine: line };

  return null;
}

export type ConnectPipelineStageRow = {
  key: ConnectIngestStage;
  label: string;
  status: string;
  summary?: string;
  isCurrent: boolean;
  progress?: ConnectIngestStageProgress["progress"];
};

export const CONNECT_PIPELINE_STAGE_LABELS: Record<ConnectIngestStage, string> = {
  extracting: "Extract",
  relating: "Relate",
  grouping: "Group",
  embedding: "Embed",
  validating: "Validate",
  remediating: "Remediate",
  storing: "Store",
};

/** Vertical pipeline rows for UI (SOPHIA `buildPipelineStageRows`). */
export function buildConnectPipelineStageRows(
  stages: ConnectIngestStageProgress[],
  currentStageKey: string | null | undefined,
): ConnectPipelineStageRow[] {
  const cur = (currentStageKey ?? "").trim();
  const byStage = new Map(stages.map((s) => [s.stage, s]));
  return CONNECT_INGEST_PIPELINE_STAGES.filter((key) => {
    const row = byStage.get(key);
    return row && row.status !== "skipped";
  }).map((key) => {
    const row = byStage.get(key)!;
    return {
      key,
      label: CONNECT_PIPELINE_STAGE_LABELS[key],
      status: row.status,
      isCurrent: Boolean(cur && cur === key),
      ...(row.progress ? { progress: row.progress } : {}),
    };
  });
}
