/**
 * Calibrated cascade thresholds and the stage-1 informativeness metric
 * (restormel-verification-engineering §4 "calibrated thresholds only" + "know when a
 * cascade loses"; REC-PLAN-023 §a calibration, §h validation 2).
 *
 * Escalation thresholds are NOT inline constants (that is an anti-pattern, skill §4). They
 * live in a VERSIONED config artifact with a calibration-source reference. The cascade
 * loads a `CalibrationArtifact`; a bare `0.7` in cascade.ts would fail the skill's grep.
 *
 * The artifact also carries the per-corpus stage-1 confidence informativeness metric
 * (AUROC of the pre-filter's confidence against the final post-cascade verdict). A cascade
 * only beats a single strong checker when stage-1 confidence is calibrated and error costs
 * are asymmetric (skill §4 "know when a cascade loses"); an uninformative corpus
 * (AUROC near 0.5) gets a recorded finding + a simplification follow-up — surfaced by
 * `assessStage1Informativeness()` so the harness can print it.
 *
 * `computeAuroc` is a dependency-free rank-based AUROC (Mann-Whitney U) so the harness can
 * derive the metric from labelled runs without pulling in a stats library.
 */

/** Escalation band for one tier: below `acceptSupportedBelow`? accept. Above? escalate. */
export interface TierThresholds {
  /** Tier id these thresholds calibrate (keyed by tier id, not a global constant — skill §3/§4). */
  tierId: string;
  /**
   * Confidence at/above which a "supported" verdict is ACCEPTED without escalation.
   * Derived from isotonic/Platt calibration on held-out labels (skill §4), not hand-picked.
   */
  acceptSupportedAtOrAbove: number;
  /**
   * Confidence at/above which a decisive non-supported verdict ("contradicted") is
   * ACCEPTED without escalation.
   */
  acceptContradictedAtOrAbove: number;
}

export interface CalibrationArtifact {
  /** Bumped whenever thresholds are re-fit; part of the audit trail. */
  version: string;
  /**
   * Provenance of the calibration: what held-out label set + method produced these numbers
   * (skill §4 "calibration provenance"). Free text pointing at the fitting run/record.
   */
  calibrationSource: string;
  /** ISO 8601 date the artifact was fit. */
  calibratedAt: string;
  /** Per-tier accept/escalate bands. */
  thresholds: TierThresholds[];
  /**
   * Per-corpus stage-1 (pre-filter) confidence informativeness — AUROC of the pre-filter
   * confidence vs the final cascade verdict. Recorded per corpus (skill §4). Absent until
   * a labelled run fills it; the harness computes and reports it.
   */
  stage1InformativenessByCorpus?: Record<string, number>;
}

export function getTierThresholds(
  artifact: CalibrationArtifact,
  tierId: string,
): TierThresholds | undefined {
  return artifact.thresholds.find((t) => t.tierId === tierId);
}

/**
 * Dependency-free AUROC (equivalent to the normalized Mann-Whitney U statistic): the
 * probability a random positive scores above a random negative, with ties counted as 0.5.
 * `scores` are the pre-filter confidences; `positives[i]` is true when item i's FINAL
 * cascade verdict was the decisive class the confidence was predicting.
 */
export function computeAuroc(scores: number[], positives: boolean[]): number {
  if (scores.length !== positives.length) {
    throw new Error("computeAuroc: scores and positives length mismatch");
  }
  const pos: number[] = [];
  const neg: number[] = [];
  for (let i = 0; i < scores.length; i++) {
    (positives[i] ? pos : neg).push(scores[i]!);
  }
  if (pos.length === 0 || neg.length === 0) {
    // Undefined without both classes present; 0.5 = "no information", matching the
    // uninformative-corpus interpretation below.
    return 0.5;
  }
  let wins = 0;
  for (const p of pos) {
    for (const n of neg) {
      if (p > n) wins += 1;
      else if (p === n) wins += 0.5;
    }
  }
  return wins / (pos.length * neg.length);
}

/** How far from uninformative (0.5) a corpus's stage-1 AUROC must be to justify a cascade. */
export const STAGE1_INFORMATIVE_MIN_AUROC = 0.6;

export interface Stage1InformativenessFinding {
  corpus: string;
  auroc: number;
  informative: boolean;
  /** A recorded finding + simplification follow-up when uninformative (skill §4). */
  finding: string;
}

/**
 * Assess whether stage-1 confidence is informative enough on a corpus to justify the
 * cascade. An uninformative corpus (AUROC below the min) returns `informative: false` with
 * a finding string the harness prints and the PR links as a simplification follow-up.
 */
export function assessStage1Informativeness(
  corpus: string,
  auroc: number,
): Stage1InformativenessFinding {
  const informative = auroc >= STAGE1_INFORMATIVE_MIN_AUROC;
  const finding = informative
    ? `stage-1 confidence is informative on "${corpus}" (AUROC ${auroc.toFixed(3)} >= ${STAGE1_INFORMATIVE_MIN_AUROC})`
    : `stage-1 confidence is UNINFORMATIVE on "${corpus}" (AUROC ${auroc.toFixed(3)} < ${STAGE1_INFORMATIVE_MIN_AUROC}); ` +
      `a single strong checker may beat the cascade here — record a simplification follow-up (skill §4).`;
  return { corpus, auroc, informative, finding };
}

/**
 * The DEFAULT development calibration artifact. Explicitly marked as fixture-derived, NOT a
 * production calibration — the harness reports numbers computed with these as "fixture",
 * never as a live-fit calibration. Real thresholds are fit on a held-out label set by the
 * host-app calibration job (out of connect-core scope; skill §7 threshold-fitting data is
 * training data).
 */
export const DEV_FIXTURE_CALIBRATION: CalibrationArtifact = {
  version: "dev-fixture-2026-07-02",
  calibrationSource:
    "FIXTURE ONLY — hand-set development bands, not a held-out calibration fit. " +
    "Production thresholds are fit by the host-app calibration job (skill §7).",
  calibratedAt: "2026-07-02",
  thresholds: [
    { tierId: "hhem-2.1-open", acceptSupportedAtOrAbove: 0.85, acceptContradictedAtOrAbove: 0.85 },
    {
      tierId: "granite-guardian-3.3-8b",
      acceptSupportedAtOrAbove: 0.7,
      acceptContradictedAtOrAbove: 0.7,
    },
    { tierId: "frontier-api", acceptSupportedAtOrAbove: 0.6, acceptContradictedAtOrAbove: 0.6 },
  ],
};
