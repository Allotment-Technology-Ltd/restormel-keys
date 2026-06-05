/**
 * Apply ingest quality calibrations to builtin domain packs (DB-only, no git).
 */
import { assertG2Targets } from "@restormel/connect-core/ingest/golden-eval";
import {
  bumpBuiltinPackPromptVersionsByArchetypes,
  getIngestQualityRunById,
  getRecentProductionG2Metrics,
  markIngestQualityRunApplied,
  type IngestQualityRunRecord,
} from "$lib/server/neon";
import type { FiredThreshold } from "$lib/server/connect/ingest-quality-thresholds";

export type G2GateResult = {
  pass: boolean;
  reasons: string[];
  ok_pct: number;
  unsupported_pct: number;
  sample_jobs: number;
};

export async function checkIngestQualityG2Gate(): Promise<G2GateResult> {
  const metrics = await getRecentProductionG2Metrics({ limit: 10 });
  if (metrics.sample_jobs === 0) {
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
  const gate = assertG2Targets({
    ok: 0,
    weak: 0,
    unsupported: 0,
    ok_pct: metrics.ok_pct,
    unsupported_pct: metrics.unsupported_pct,
  });
  return {
    pass: gate.pass,
    reasons: gate.reasons,
    ok_pct: metrics.ok_pct,
    unsupported_pct: metrics.unsupported_pct,
    sample_jobs: metrics.sample_jobs,
  };
}

export type ApplyCalibrationResult = {
  runId: string;
  bumpedPacks: { id: string; slug: string; archetype: string | null; promptTemplateVersion: number }[];
  archetypes: string[];
};

export async function applyIngestQualityCalibration(params: {
  runId: string;
}): Promise<
  | { ok: true; result: ApplyCalibrationResult; g2: G2GateResult }
  | { ok: false; status: number; message: string; g2?: G2GateResult }
> {
  const run = await getIngestQualityRunById(params.runId);
  if (!run) {
    return { ok: false, status: 404, message: "Evaluation run not found." };
  }
  if (run.status === "applied") {
    return { ok: false, status: 409, message: "This evaluation has already been applied." };
  }
  if (run.status === "failed") {
    return { ok: false, status: 409, message: "This evaluation run failed and cannot be applied." };
  }

  const fired = parseFired(run);
  if (fired.length === 0) {
    return { ok: false, status: 400, message: "No thresholds fired — nothing to apply." };
  }

  const g2 = await checkIngestQualityG2Gate();
  if (!g2.pass) {
    return {
      ok: false,
      status: 422,
      message: `G2 gate failed: ${g2.reasons.join("; ")}`,
      g2,
    };
  }

  const archetypes = [...new Set(fired.map((f) => f.archetype))];
  const bumpedPacks = await bumpBuiltinPackPromptVersionsByArchetypes({ archetypes });
  const appliedActions = fired.map((f) => ({
    archetype: f.archetype,
    threshold: f.threshold,
    action: f.action,
    prompt_template_version_bump: true,
  }));

  await markIngestQualityRunApplied({
    runId: params.runId,
    appliedActions,
  });

  return {
    ok: true,
    g2,
    result: {
      runId: params.runId,
      bumpedPacks,
      archetypes,
    },
  };
}

function parseFired(run: IngestQualityRunRecord): FiredThreshold[] {
  if (!Array.isArray(run.fired)) return [];
  return run.fired.filter(
    (row): row is FiredThreshold =>
      row != null &&
      typeof row === "object" &&
      typeof (row as FiredThreshold).archetype === "string" &&
      typeof (row as FiredThreshold).action === "string",
  );
}
