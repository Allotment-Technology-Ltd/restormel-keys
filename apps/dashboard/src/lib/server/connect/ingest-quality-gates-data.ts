import {
  assertG2Targets,
  G2_OK_PCT_TARGET,
  G2_UNSUPPORTED_PCT_MAX,
} from "@restormel/connect-core/ingest/golden-eval";
import { G3_TRUST_SCORE_TARGET } from "$lib/connect/ingest-quality-gate-defs";

export type StoredProductionQualityReport = {
  preset: string;
  executionMode: "stub" | "full" | null;
  units: number | null;
  okPct: number;
  weakPct: number;
  unsupportedPct: number;
  trustScore: number | null;
  stubWarning: string | null;
};

export type ProductionG2SampleJob = {
  id: string;
  workspaceId: string;
  projectId: string | null;
  label: string | null;
  updatedAt: number;
  report: StoredProductionQualityReport;
  g2Pass: boolean;
  g2Reasons: string[];
};

export type GateLiveStatus = "pass" | "fail" | "awaiting" | "manual";

export type GateStatusRow = {
  gateId: string;
  status: GateLiveStatus;
  /** Short metric line for the at-a-glance table */
  metricLine: string;
};

/** Parse quality_report JSON persisted on ingest job progress. */
export function parseStoredProductionQualityReport(raw: unknown): StoredProductionQualityReport | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const rec = raw as Record<string, unknown>;
  if (rec.preset !== "production") return null;
  if (typeof rec.ok_pct !== "number") return null;

  const executionMode =
    rec.execution_mode === "stub" || rec.execution_mode === "full" ? rec.execution_mode : null;
  const units = typeof rec.units === "number" ? rec.units : null;
  const weakPct = typeof rec.weak_pct === "number" ? rec.weak_pct : 0;
  const unsupportedPct = typeof rec.unsupported_pct === "number" ? rec.unsupported_pct : 0;
  const stubWarning =
    rec.stub_warning === null || typeof rec.stub_warning === "string" ? rec.stub_warning : null;

  let trustScore: number | null = null;
  const kgRaw = rec.kg_audit;
  if (kgRaw && typeof kgRaw === "object" && !Array.isArray(kgRaw)) {
    const trust = (kgRaw as Record<string, unknown>).trust_score;
    if (typeof trust === "number") trustScore = trust;
  }

  return {
    preset: "production",
    executionMode,
    units,
    okPct: rec.ok_pct,
    weakPct,
    unsupportedPct,
    trustScore,
    stubWarning,
  };
}

export function buildProductionG2SampleJob(row: {
  id: string;
  workspaceId: string;
  projectId: string | null;
  label: string | null;
  updatedAt: number;
  report: StoredProductionQualityReport;
}): ProductionG2SampleJob {
  const gate = assertG2Targets({
    ok: 0,
    weak: 0,
    unsupported: 0,
    ok_pct: row.report.okPct,
    unsupported_pct: row.report.unsupportedPct,
  });
  return {
    ...row,
    g2Pass: gate.pass,
    g2Reasons: gate.reasons,
  };
}

export function summarizeG2Aggregate(jobs: ProductionG2SampleJob[]): {
  pass: boolean;
  reasons: string[];
  ok_pct: number;
  unsupported_pct: number;
  sample_jobs: number;
} {
  if (jobs.length === 0) {
    return {
      pass: false,
      reasons: [
        "No recent production ingest runs with quality reports yet — complete a production ingest before applying calibrations.",
      ],
      ok_pct: 0,
      unsupported_pct: 0,
      sample_jobs: 0,
    };
  }
  const ok_pct = Math.round(jobs.reduce((sum, j) => sum + j.report.okPct, 0) / jobs.length);
  const unsupported_pct = Math.round(
    jobs.reduce((sum, j) => sum + j.report.unsupportedPct, 0) / jobs.length,
  );
  const gate = assertG2Targets({
    ok: 0,
    weak: 0,
    unsupported: 0,
    ok_pct,
    unsupported_pct,
  });
  return { pass: gate.pass, reasons: gate.reasons, ok_pct, unsupported_pct, sample_jobs: jobs.length };
}

export function computeGateStatuses(jobs: ProductionG2SampleJob[]): GateStatusRow[] {
  const g2 = summarizeG2Aggregate(jobs);

  const g3Scores = jobs
    .map((j) => j.report.trustScore)
    .filter((score): score is number => typeof score === "number");
  const g3Avg =
    g3Scores.length > 0
      ? Math.round(g3Scores.reduce((a, b) => a + b, 0) / g3Scores.length)
      : null;

  const g6Violations = jobs.filter(
    (j) =>
      j.report.executionMode === "stub" ||
      j.report.units === 0 ||
      (j.report.stubWarning != null && j.report.stubWarning.length > 0),
  );

  return [
    {
      gateId: "g1",
      status: "manual",
      metricLine: "CI + pre-scan before LLM spend",
    },
    {
      gateId: "g2",
      status: jobs.length === 0 ? "awaiting" : g2.pass ? "pass" : "fail",
      metricLine:
        jobs.length === 0
          ? "No production quality reports yet"
          : `Avg ok ${g2.ok_pct}% · unsupported ${g2.unsupported_pct}% · ${g2.sample_jobs} job(s)`,
    },
    {
      gateId: "g3",
      status:
        g3Scores.length === 0 ? "awaiting" : (g3Avg ?? 0) >= G3_TRUST_SCORE_TARGET ? "pass" : "fail",
      metricLine:
        g3Scores.length === 0
          ? "No trust scores on sample jobs"
          : `Avg trust ${g3Avg} · ${g3Scores.length} job(s) with kg_audit`,
    },
    {
      gateId: "g4",
      status: "manual",
      metricLine: "Offline golden-query benchmark",
    },
    {
      gateId: "g5",
      status: "manual",
      metricLine: "PostHog median triage latency",
    },
    {
      gateId: "g6",
      status:
        jobs.length === 0
          ? "awaiting"
          : g6Violations.length === 0
            ? "pass"
            : "fail",
      metricLine:
        jobs.length === 0
          ? "Awaiting production sample"
          : g6Violations.length === 0
            ? `Full pipeline · ${jobs.length} job(s)`
            : `${g6Violations.length} stub/zero-unit job(s)`,
    },
    {
      gateId: "g7",
      status: "manual",
      metricLine: "CI golden eval + Apply audit trail",
    },
  ];
}
