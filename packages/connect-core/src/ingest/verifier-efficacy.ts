/**
 * Verifier efficacy benchmark (Verified Context roadmap, Stage 1.0a).
 *
 * Ground-truth measurement of the validation stage ITSELF: labeled fixtures with planted
 * bad claims (fabricated / overstated / misattributed) are run through the real
 * validateUnitsBatch path, and the validator's verdicts are scored against the labels.
 *
 * Measurement rule: an omitted verdict is tracked as "omitted" — NOT folded into the
 * coverage-finalize default (pre-#189 "ok", post-#189 "weak") — so a planted-bad claim
 * the validator merely failed to mention is never counted as a true catch. This keeps the
 * metrics independent of which finalize semantics are merged.
 *
 * Pure scoring/aggregation lives here (keyless unit tests); live model calls are wired by
 * scripts/reviews/verifier-efficacy.ts.
 */
import type { ConnectDomainPack } from "@restormel/contracts/connect";
import type { ExtractionGenerate } from "./extract.js";
import type { ConnectQualityPreset } from "./quality-preset.js";
import {
  buildValidationBatchInputs,
  remapValidationBatchResults,
  validateUnitsBatch,
  type ValidationInput,
} from "./validation.js";

export type EfficacyTier = "fabricated" | "overstated" | "misattributed";
export const EFFICACY_TIERS: EfficacyTier[] = ["fabricated", "overstated", "misattributed"];

export type EfficacySource = {
  id: string;
  title: string;
  text: string;
  license?: string;
};

export type EfficacyClaim = {
  id: string;
  /** The source the claim is CITED against (for misattributed: the wrong one). */
  source_id: string;
  text: string;
  label: "supported" | "unsupported";
  /** Required when label is "unsupported". */
  tier?: EfficacyTier;
  /** For misattributed claims: the corpus source that actually supports the claim. */
  evidence_source_id?: string;
  /**
   * Hard tier (H2 probe): the claim's evidence — or for planted-bad claims, the related
   * content — sits BEYOND the validator's 12k-char source window. A validator that
   * affirms ("ok") what it cannot see is failing open; flagging or abstaining is the safe
   * behavior. Scored separately in window_probe.
   */
  beyond_window?: boolean;
  rationale: string;
};

export type EfficacyFixture = {
  version: number;
  description?: string;
  authored_by?: string;
  sources: EfficacySource[];
  claims: EfficacyClaim[];
};

/** Structural problems with a fixture; empty array means valid. */
export function validateEfficacyFixture(fixture: EfficacyFixture): string[] {
  const problems: string[] = [];
  const sourceIds = new Set(fixture.sources.map((s) => s.id));
  const seen = new Set<string>();
  for (const claim of fixture.claims) {
    if (seen.has(claim.id)) problems.push(`duplicate claim id: ${claim.id}`);
    seen.add(claim.id);
    if (!sourceIds.has(claim.source_id)) {
      problems.push(`claim ${claim.id}: unknown source_id ${claim.source_id}`);
    }
    if (claim.label === "unsupported" && !claim.tier) {
      problems.push(`claim ${claim.id}: unsupported claim missing tier`);
    }
    if (claim.label === "supported" && claim.tier) {
      problems.push(`claim ${claim.id}: supported claim must not carry a tier`);
    }
    if (claim.tier === "misattributed") {
      if (!claim.evidence_source_id) {
        problems.push(`claim ${claim.id}: misattributed claim missing evidence_source_id`);
      } else if (!sourceIds.has(claim.evidence_source_id)) {
        problems.push(`claim ${claim.id}: unknown evidence_source_id ${claim.evidence_source_id}`);
      } else if (claim.evidence_source_id === claim.source_id) {
        problems.push(`claim ${claim.id}: misattributed claim cites its own evidence source`);
      }
    }
    if (!claim.rationale?.trim()) problems.push(`claim ${claim.id}: missing rationale`);
  }
  for (const tier of EFFICACY_TIERS) {
    if (!fixture.claims.some((c) => c.tier === tier)) {
      problems.push(`fixture has no claims in tier: ${tier}`);
    }
  }
  return problems;
}

/** What the validator did with one claim. "omitted" = no verdict returned for its ref. */
export type ClaimVerdict = "ok" | "weak" | "unsupported" | "omitted";

/**
 * Run the real batch validation path for a set of units against one source text and
 * return per-ref verdicts, with omissions tracked explicitly (no coverage finalize).
 */
export async function collectValidationVerdicts(args: {
  units: ValidationInput[];
  sourceText: string;
  pack: ConnectDomainPack;
  generate: ExtractionGenerate;
  qualityPreset?: ConnectQualityPreset;
}): Promise<Map<string, ClaimVerdict>> {
  const verdicts = new Map<string, ClaimVerdict>();
  if (args.units.length === 0) return verdicts;
  const batches = buildValidationBatchInputs(args.units);
  for (const { batchUnits, refToUnitId } of batches) {
    const parsed = await validateUnitsBatch({
      units: batchUnits,
      sourceText: args.sourceText,
      pack: args.pack,
      generate: args.generate,
      qualityPreset: args.qualityPreset,
    });
    for (const result of remapValidationBatchResults(parsed, refToUnitId)) {
      if (!verdicts.has(result.ref)) verdicts.set(result.ref, result.status);
    }
  }
  for (const unit of args.units) {
    if (!verdicts.has(unit.ref)) verdicts.set(unit.ref, "omitted");
  }
  return verdicts;
}

export type TierMetrics = {
  total: number;
  /** Returned verdict of weak|unsupported — the only thing that counts as a true catch. */
  caught_by_verdict: number;
  /** No verdict returned; whatever happens next is the coverage default, not a catch. */
  defaulted_by_coverage: number;
  /** Returned verdict of ok — the validator affirmed a bad claim. */
  missed: number;
  recall_strict: number;
  recall_with_coverage: number;
  /** Calibration: how the caught verdicts split. */
  verdict_weak: number;
  verdict_unsupported: number;
};

export type SupportedMetrics = {
  total: number;
  correct: number;
  false_flag: number;
  omitted: number;
  /** false_flag / (correct + false_flag); omissions excluded from the denominator. */
  false_flag_rate: number;
};

export type WindowProbeMetrics = {
  /** Supported claims whose evidence is beyond the 12k window. */
  supported_late: {
    total: number;
    /** Affirmed "ok" without visible evidence — the FAIL-OPEN indicator. */
    affirmed_unseen: number;
    /** Flagged weak/unsupported — safe behavior under truncation. */
    flagged: number;
    omitted: number;
    affirm_unseen_rate: number;
  };
  /** Planted-bad claims whose related content is beyond the window. */
  bad_late: TierMetrics;
};

export type EfficacyRunResult = {
  supported: SupportedMetrics;
  tiers: Record<EfficacyTier, TierMetrics>;
  all_bad: TierMetrics;
  /** H2 truncation probe over beyond_window claims (empty totals if fixture has none). */
  window_probe: WindowProbeMetrics;
  /** Claims present in the fixture but absent from the verdict map (harness bug guard). */
  unscored: string[];
};

function emptyTier(): TierMetrics {
  return {
    total: 0,
    caught_by_verdict: 0,
    defaulted_by_coverage: 0,
    missed: 0,
    recall_strict: 0,
    recall_with_coverage: 0,
    verdict_weak: 0,
    verdict_unsupported: 0,
  };
}

function finishTier(t: TierMetrics): TierMetrics {
  const recall_strict = t.total > 0 ? t.caught_by_verdict / t.total : 0;
  const recall_with_coverage =
    t.total > 0 ? (t.caught_by_verdict + t.defaulted_by_coverage) / t.total : 0;
  return { ...t, recall_strict, recall_with_coverage };
}

/** Score one run's verdicts against the fixture labels. */
export function scoreOutcomes(
  claims: EfficacyClaim[],
  verdicts: Map<string, ClaimVerdict>,
): EfficacyRunResult {
  const supported: SupportedMetrics = { total: 0, correct: 0, false_flag: 0, omitted: 0, false_flag_rate: 0 };
  const tiers: Record<EfficacyTier, TierMetrics> = {
    fabricated: emptyTier(),
    overstated: emptyTier(),
    misattributed: emptyTier(),
  };
  let allBad = emptyTier();
  let badLate = emptyTier();
  const supportedLate = { total: 0, affirmed_unseen: 0, flagged: 0, omitted: 0, affirm_unseen_rate: 0 };
  const unscored: string[] = [];

  for (const claim of claims) {
    const verdict = verdicts.get(claim.id);
    if (!verdict) {
      unscored.push(claim.id);
      continue;
    }
    if (claim.label === "supported") {
      supported.total += 1;
      if (verdict === "ok") supported.correct += 1;
      else if (verdict === "omitted") supported.omitted += 1;
      else supported.false_flag += 1;
      if (claim.beyond_window) {
        supportedLate.total += 1;
        if (verdict === "ok") supportedLate.affirmed_unseen += 1;
        else if (verdict === "omitted") supportedLate.omitted += 1;
        else supportedLate.flagged += 1;
      }
      continue;
    }
    const tier = tiers[claim.tier!];
    const buckets = claim.beyond_window ? [tier, allBad, badLate] : [tier, allBad];
    for (const bucket of buckets) {
      bucket.total += 1;
      if (verdict === "ok") bucket.missed += 1;
      else if (verdict === "omitted") bucket.defaulted_by_coverage += 1;
      else {
        bucket.caught_by_verdict += 1;
        if (verdict === "weak") bucket.verdict_weak += 1;
        else bucket.verdict_unsupported += 1;
      }
    }
  }

  const judged = supported.correct + supported.false_flag;
  supported.false_flag_rate = judged > 0 ? supported.false_flag / judged : 0;
  const judgedLate = supportedLate.affirmed_unseen + supportedLate.flagged;
  supportedLate.affirm_unseen_rate = judgedLate > 0 ? supportedLate.affirmed_unseen / judgedLate : 0;
  allBad = finishTier(allBad);
  badLate = finishTier(badLate);
  return {
    supported,
    tiers: {
      fabricated: finishTier(tiers.fabricated),
      overstated: finishTier(tiers.overstated),
      misattributed: finishTier(tiers.misattributed),
    },
    all_bad: allBad,
    window_probe: { supported_late: supportedLate, bad_late: badLate },
    unscored,
  };
}

export type MetricStat = { mean: number; stddev: number; min: number; max: number; n: number };

function stat(values: number[]): MetricStat {
  const n = values.length;
  if (n === 0) return { mean: 0, stddev: 0, min: 0, max: 0, n: 0 };
  const mean = values.reduce((a, b) => a + b, 0) / n;
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / n;
  return {
    mean,
    stddev: Math.sqrt(variance),
    min: Math.min(...values),
    max: Math.max(...values),
    n,
  };
}

export type AggregatedEfficacy = {
  runs: number;
  supported_false_flag_rate: MetricStat;
  tiers: Record<EfficacyTier, { recall_strict: MetricStat; recall_with_coverage: MetricStat }>;
  all_bad_recall_strict: MetricStat;
  all_bad_recall_with_coverage: MetricStat;
  /** H2 probe: affirming unseen evidence is failing open. */
  window_affirm_unseen_rate: MetricStat;
  window_bad_late_recall_strict: MetricStat;
};

/** Aggregate repeated runs (judges are stochastic): mean ± stddev per headline metric. */
export function aggregateRuns(runs: EfficacyRunResult[]): AggregatedEfficacy {
  const tierAgg = (tier: EfficacyTier) => ({
    recall_strict: stat(runs.map((r) => r.tiers[tier].recall_strict)),
    recall_with_coverage: stat(runs.map((r) => r.tiers[tier].recall_with_coverage)),
  });
  return {
    runs: runs.length,
    supported_false_flag_rate: stat(runs.map((r) => r.supported.false_flag_rate)),
    tiers: {
      fabricated: tierAgg("fabricated"),
      overstated: tierAgg("overstated"),
      misattributed: tierAgg("misattributed"),
    },
    all_bad_recall_strict: stat(runs.map((r) => r.all_bad.recall_strict)),
    all_bad_recall_with_coverage: stat(runs.map((r) => r.all_bad.recall_with_coverage)),
    window_affirm_unseen_rate: stat(runs.map((r) => r.window_probe.supported_late.affirm_unseen_rate)),
    window_bad_late_recall_strict: stat(runs.map((r) => r.window_probe.bad_late.recall_strict)),
  };
}
