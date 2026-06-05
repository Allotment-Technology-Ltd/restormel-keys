/**
 * Connect ingest quality threshold evaluation (admin manual loop).
 */
import {
  insertIngestQualityRun,
  listReviewSignalsForEval,
  type ReviewSignalEvalRow,
} from "$lib/server/neon";

export type FiredThreshold = {
  archetype: string;
  threshold: string;
  rate: number;
  count: number;
  total: number;
  action: string;
};

export type ArchetypeAggregate = {
  archetype: string;
  total: number;
  deltas: Record<string, number>;
  themeOverrides: Record<string, number>;
};

const THRESHOLDS = [
  { key: "weak_to_ok", rate: 0.25, minN: 30, action: "relax_validation_template" },
  { key: "unsupported_to_ok", rate: 0.15, minN: 20, action: "tune_extract_conservatism" },
  { key: "ok_to_weak", rate: 0.1, minN: 20, action: "tighten_validation_template" },
  { key: "removed_after_weak", rate: 0.2, minN: 20, action: "shift_remediation_toward_drop" },
] as const;

const THEME_OVERRIDE_RATE = 0.4;
const THEME_OVERRIDE_MIN_N = 15;

const AGREE_DELTAS = new Set(["agree_ok", "agree_weak", "agree_unsupported"]);

export function buildArchetypeAggregates(rows: ReviewSignalEvalRow[]): ArchetypeAggregate[] {
  const byArchetype = new Map<string, ArchetypeAggregate>();
  for (const row of rows) {
    const archetype = row.pack_archetype ?? "generic";
    if (!byArchetype.has(archetype)) {
      byArchetype.set(archetype, { archetype, total: 0, deltas: {}, themeOverrides: {} });
    }
    const bucket = byArchetype.get(archetype)!;
    bucket.total += 1;
    const delta = row.verdict_delta ?? "unknown";
    bucket.deltas[delta] = (bucket.deltas[delta] ?? 0) + 1;

    const isOverride =
      row.action_type === "override" ||
      (!AGREE_DELTAS.has(delta) && delta !== "removed" && !delta.startsWith("removed_after"));
    if (isOverride && row.ai_flag_theme && row.ai_flag_theme !== "other") {
      const theme = row.ai_flag_theme;
      bucket.themeOverrides[theme] = (bucket.themeOverrides[theme] ?? 0) + 1;
    }
  }
  return [...byArchetype.values()].sort((a, b) => b.total - a.total);
}

export function evaluateThresholds(rows: ReviewSignalEvalRow[]): FiredThreshold[] {
  const fired: FiredThreshold[] = [];
  for (const bucket of buildArchetypeAggregates(rows)) {
    for (const t of THRESHOLDS) {
      const count = bucket.deltas[t.key] ?? 0;
      if (bucket.total < t.minN) continue;
      const rate = count / bucket.total;
      if (rate > t.rate) {
        fired.push({
          archetype: bucket.archetype,
          threshold: t.key,
          rate: Math.round(rate * 100),
          count,
          total: bucket.total,
          action: t.action,
        });
      }
    }

    for (const [theme, count] of Object.entries(bucket.themeOverrides)) {
      if (bucket.total < THEME_OVERRIDE_MIN_N) continue;
      const rate = count / bucket.total;
      if (rate > THEME_OVERRIDE_RATE) {
        fired.push({
          archetype: bucket.archetype,
          threshold: `ai_flag_theme:${theme}`,
          rate: Math.round(rate * 100),
          count,
          total: bucket.total,
          action: "add_archetype_guardrail",
        });
      }
    }
  }
  return fired;
}

export function buildThresholdBriefMarkdown(fired: FiredThreshold[], windowDays: number): string {
  const date = new Date().toISOString().slice(0, 10);
  const lines = [
    `# Ingest quality threshold brief — ${date}`,
    "",
    `Window: last ${windowDays} days. Aggregates only; no user graph content.`,
    "",
  ];
  if (fired.length === 0) {
    lines.push("No thresholds fired.");
  } else {
    for (const f of fired) {
      lines.push(
        `- **${f.archetype}** — \`${f.threshold}\` at ${f.rate}% (${f.count}/${f.total}) → ${f.action}`,
      );
    }
  }
  lines.push("", "Apply from Restormel Admin → Ingest quality after G2 gate passes.");
  return lines.join("\n");
}

export type IngestQualitySummary = {
  windowDays: number;
  signalCount: number;
  agreementPct: number;
  topOverrides: { delta: string; count: number }[];
  aggregatesByArchetype: ArchetypeAggregate[];
};

export function summarizeReviewSignals(rows: ReviewSignalEvalRow[], windowDays: number): IngestQualitySummary {
  const aggregates = buildArchetypeAggregates(rows);
  let agree = 0;
  const overrideCounts = new Map<string, number>();
  for (const row of rows) {
    const delta = row.verdict_delta ?? "unknown";
    if (AGREE_DELTAS.has(delta)) agree += 1;
    else if (delta !== "removed" && !delta.startsWith("removed_after")) {
      overrideCounts.set(delta, (overrideCounts.get(delta) ?? 0) + 1);
    }
  }
  const signalCount = rows.length;
  const agreementPct = signalCount > 0 ? Math.round((agree / signalCount) * 100) : 0;
  const topOverrides = [...overrideCounts.entries()]
    .map(([delta, count]) => ({ delta, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
  return { windowDays, signalCount, agreementPct, topOverrides, aggregatesByArchetype: aggregates };
}

export async function runIngestQualityEvaluation(params: {
  days: number;
  createdByUserId: string | null;
}): Promise<{
  runId: string;
  fired: FiredThreshold[];
  briefMarkdown: string;
  summary: IngestQualitySummary;
}> {
  const rows = await listReviewSignalsForEval({ days: params.days });
  const fired = evaluateThresholds(rows);
  const briefMarkdown = buildThresholdBriefMarkdown(fired, params.days);
  const summary = summarizeReviewSignals(rows, params.days);
  const runId = await insertIngestQualityRun({
    windowDays: params.days,
    status: "evaluated",
    fired,
    briefMarkdown,
    createdByUserId: params.createdByUserId,
  });
  return { runId, fired, briefMarkdown, summary };
}
