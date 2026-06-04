/**
 * Hosted Knowledge Ingest worker — bookkeeping stub (Phase 10 / 5d).
 *
 * Full LLM + graph store execution remains in SOPHIA until adapter wiring lands.
 * This module validates sources and advances stage rows for dequeue smoke tests.
 */
import type { ConnectIngestStage } from "@restormel/contracts/connect";
import { CONNECT_INGEST_PIPELINE_STAGES } from "./job-record.js";

export type ConnectIngestStageProgressMetrics = {
  percent: number;
  processed: number;
  total: number;
  eta_seconds?: number;
};

export type ConnectIngestStageProgress = {
  stage: ConnectIngestStage;
  status: "pending" | "running" | "completed" | "failed" | "skipped";
  started_at?: string;
  completed_at?: string;
  error?: string;
  progress?: ConnectIngestStageProgressMetrics;
};

const STAGE_SET = new Set<string>(CONNECT_INGEST_PIPELINE_STAGES);

function parseStageRow(raw: unknown): ConnectIngestStageProgress | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const rec = raw as Record<string, unknown>;
  const stage = String(rec.stage ?? "");
  if (!STAGE_SET.has(stage)) return null;
  const statusRaw = String(rec.status ?? "pending");
  const status =
    statusRaw === "running" ||
    statusRaw === "completed" ||
    statusRaw === "failed" ||
    statusRaw === "skipped"
      ? statusRaw
      : "pending";
  let progress: ConnectIngestStageProgressMetrics | undefined;
  const progressRaw = rec.progress;
  if (progressRaw && typeof progressRaw === "object" && !Array.isArray(progressRaw)) {
    const p = progressRaw as Record<string, unknown>;
    const percent = Number(p.percent);
    const processed = Number(p.processed);
    const total = Number(p.total);
    if (Number.isFinite(percent) && Number.isFinite(processed) && Number.isFinite(total)) {
      progress = {
        percent: Math.min(100, Math.max(0, Math.round(percent))),
        processed: Math.max(0, Math.round(processed)),
        total: Math.max(1, Math.round(total)),
        ...(p.eta_seconds != null
          ? { eta_seconds: Math.max(0, Math.round(Number(p.eta_seconds))) }
          : {}),
      };
    }
  }
  return {
    stage: stage as ConnectIngestStage,
    status,
    ...(typeof rec.started_at === "string" ? { started_at: rec.started_at } : {}),
    ...(typeof rec.completed_at === "string" ? { completed_at: rec.completed_at } : {}),
    ...(typeof rec.error === "string" ? { error: rec.error } : {}),
    ...(progress ? { progress } : {}),
  };
}

/** Merge persisted stage rows onto the canonical 7-stage pipeline order. */
export function normalizeConnectIngestStages(raw: unknown): ConnectIngestStageProgress[] {
  let parsed: unknown = raw;
  if (typeof raw === "string") {
    try {
      parsed = JSON.parse(raw) as unknown;
    } catch {
      parsed = null;
    }
  }

  const byStage = new Map<ConnectIngestStage, ConnectIngestStageProgress>();
  if (Array.isArray(parsed)) {
    for (const row of parsed) {
      const normalized = parseStageRow(row);
      if (normalized) byStage.set(normalized.stage, normalized);
    }
  }

  return CONNECT_INGEST_PIPELINE_STAGES.map(
    (stage) => byStage.get(stage) ?? { stage, status: "pending" as const },
  );
}

export type ConnectIngestSourceInput = {
  url?: string;
  text?: string;
  title?: string;
};

export function validateConnectIngestSources(sources: unknown): ConnectIngestSourceInput[] {
  if (!Array.isArray(sources) || sources.length === 0) {
    throw new Error("ingest_sources_required");
  }
  const out: ConnectIngestSourceInput[] = [];
  for (const raw of sources) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      throw new Error("ingest_source_invalid");
    }
    const rec = raw as Record<string, unknown>;
    const url = typeof rec.url === "string" ? rec.url.trim() : "";
    const text = typeof rec.text === "string" ? rec.text.trim() : "";
    if (!url && !text) {
      throw new Error("ingest_source_empty");
    }
    out.push({
      ...(url ? { url } : {}),
      ...(text ? { text } : {}),
      ...(typeof rec.title === "string" && rec.title.trim() ? { title: rec.title.trim() } : {}),
    });
  }
  return out;
}

export function advanceConnectIngestStagesBookkeeping(args: {
  stages: ConnectIngestStageProgress[];
  mode: "stub_complete";
  now?: Date;
}): {
  stages: ConnectIngestStageProgress[];
  status: "completed";
  current_stage: ConnectIngestStage;
} {
  const nowIso = (args.now ?? new Date()).toISOString();
  const order = CONNECT_INGEST_PIPELINE_STAGES;
  const byStage = new Map(args.stages.map((s) => [s.stage, { ...s }]));

  for (const stage of order) {
    const row = byStage.get(stage) ?? { stage, status: "pending" as const };
    row.status = "completed";
    row.started_at = row.started_at ?? nowIso;
    row.completed_at = nowIso;
    byStage.set(stage, row);
  }

  const stages = order.map((stage) => byStage.get(stage)!);
  return {
    stages,
    status: "completed",
    current_stage: order[order.length - 1]!,
  };
}
