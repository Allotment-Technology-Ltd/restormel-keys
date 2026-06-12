import { ADMIN_BASE } from "$lib/dashboard-base";
import {
  G2_OK_PCT_TARGET,
  G2_UNSUPPORTED_PCT_MAX,
} from "@restormel/connect-core/ingest/golden-eval";

export type IngestQualityCallout = {
  variant: "error" | "warn" | "info" | "success";
  title: string;
  summary: string;
  details: string[];
  nextSteps: string[];
};

export type G2GateView = {
  pass: boolean;
  reasons: string[];
  ok_pct: number;
  unsupported_pct: number;
  sample_jobs: number;
};

export function isG2AwaitingData(g2: G2GateView): boolean {
  return !g2.pass && g2.sample_jobs === 0;
}

/** Human-readable G2 faithfulness gate status for the Apply calibration section. */
export function describeG2Gate(g2: G2GateView): IngestQualityCallout | null {
  if (g2.pass) return null;

  if (isG2AwaitingData(g2)) {
    return {
      variant: "info",
      title: "G2 gate awaiting production data",
      summary:
        "Apply calibration is held until we have recent production ingest runs with quality reports.",
      details: [
        "G2 (faithfulness) measures how many graph units are marked ok vs weak/unsupported after remediation on production-preset ingests.",
        `Targets when data exists: ≥${G2_OK_PCT_TARGET}% ok and ≤${G2_UNSUPPORTED_PCT_MAX}% unsupported, averaged across the latest production jobs.`,
      ],
      nextSteps: [
        "Complete at least one production-quality Connect ingest (not starter/demo preset).",
        `Check ${ADMIN_BASE}/ingest-quality/gates#g2-sample after the run completes.`,
        "Evaluate thresholds can still run — only Apply calibration waits on G2.",
      ],
    };
  }

  const details = [
    `Current sample: ${g2.sample_jobs} recent production job(s) — ok ${g2.ok_pct}% (need ≥${G2_OK_PCT_TARGET}%), unsupported ${g2.unsupported_pct}% (need ≤${G2_UNSUPPORTED_PCT_MAX}%).`,
    "Apply calibration bumps builtin pack prompt_template_version. That is only safe when live extraction quality is already healthy; otherwise prompt tweaks can amplify bad output.",
  ];

  for (const reason of g2.reasons) {
    if (reason.includes("ok_pct")) {
      details.push(
        "Low ok% usually means operators are overriding many weak/unsupported AI verdicts, or remediation is not recovering units before store.",
      );
    }
    if (reason.includes("unsupported_pct")) {
      details.push(
        "High unsupported% means too many units lack adequate source grounding — check extract conservatism and source coverage before relaxing validation.",
      );
    }
  }

  return {
    variant: "error",
    title: "G2 faithfulness gate blocked",
    summary: `Production ingest quality is below the bar (${g2.reasons.join("; ")}). Apply calibration stays disabled until G2 passes.`,
    details,
    nextSteps: [
      `Open the G2 production sample on ${ADMIN_BASE}/ingest-quality/gates#g2-sample — inspect per-job ok% and drill into failing runs.`,
      "Triage recent units in Claims — review signals and overrides feed the Evaluate step above.",
      "Re-run production ingests after fixes; when Summary shows G2 Pass, Apply unlocks for evaluations with fired thresholds.",
    ],
  };
}

export function describeNoReviewSignals(windowDays: number): IngestQualityCallout {
  return {
    variant: "info",
    title: "No review signals in this window",
    summary: `No operator triage events were recorded in the last ${windowDays} days.`,
    details: [
      "Review signals are written when an operator agrees, overrides, or removes a unit in Claims.",
      "Workspaces can opt out of telemetry — opted-out reviews will not appear here or in PostHog.",
    ],
    nextSteps: [
      "Have operators triage ingested units in Claims so override patterns can be measured.",
      "Use Evaluate thresholds once signals exist, or widen the window (days) above.",
    ],
  };
}

export function describeNoThresholdsFired(windowDays: number): IngestQualityCallout {
  return {
    variant: "info",
    title: "No thresholds fired",
    summary: `Override and agreement rates stayed within bounds for the last ${windowDays}-day evaluation window.`,
    details: [
      "Thresholds fire when an archetype shows sustained operator disagreement (e.g. many weak→ok or ok→weak overrides) above configured rates with enough samples.",
      "This is expected when AI verdicts align with operators or sample size is still small.",
    ],
    nextSteps: [
      "Keep collecting review signals; re-run Evaluate after more triage volume.",
      "Watch the PostHog mirror for emerging override themes even when nothing fires here.",
    ],
  };
}

export function describeApplyDisabled(params: {
  canApply: boolean;
  firedCount: number;
  g2Pass: boolean;
  g2AwaitingData: boolean;
  latestRunApplied: boolean;
  hasFreshEval: boolean;
}): IngestQualityCallout | null {
  if (params.canApply) return null;

  if (params.firedCount === 0) {
    return {
      variant: "info",
      title: "Nothing to apply",
      summary: "Apply calibration requires at least one fired threshold from Evaluate.",
      details: [
        "Run Evaluate now (or pick a recent run in history with Fired > 0).",
        "Apply only changes builtin domain packs in the database — custom packs are never modified.",
      ],
      nextSteps: ["Run Evaluate thresholds, then return here when Fired is greater than zero."],
    };
  }

  if (!params.g2Pass) {
    return null;
  }

  if (params.latestRunApplied && !params.hasFreshEval) {
    return {
      variant: "info",
      title: "Latest evaluation already applied",
      summary: "The most recent evaluated run has already bumped prompt versions for its fired archetypes.",
      details: [
        "Run history Status applied means prompt_template_version was incremented for matching builtin packs.",
      ],
      nextSteps: [
        "Run Evaluate again after new review signals accumulate to detect further drift.",
      ],
    };
  }

  return null;
}
