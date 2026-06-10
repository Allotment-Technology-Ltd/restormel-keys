/** KG audit trust score v1 — ported from SOPHIA kgAudit/trustScore.ts */

export type KgAuditIssueSeverity = "info" | "low" | "medium" | "high";

export type KgAuditIssueDraft = {
  kind: string;
  severity: KgAuditIssueSeverity;
  message: string;
};

export type KgAuditMetrics = {
  accepted_claims?: number;
  accepted_unverified?: number;
  accepted_missing_embedding?: number;
  orphan_claims?: number;
  vector_index?: { ok?: boolean };
  relation_totals?: { supports?: number; contradicts?: number };
};

export type KgAuditSummary = {
  trust_score: number;
  trust_formula: string;
  issue_counts_by_severity: Record<KgAuditIssueSeverity, number>;
  issue_counts_by_kind: Record<string, number>;
  total_issues: number;
  checks_run: number;
};

const WEIGHTS = {
  embedding_coverage: 25,
  verification_coverage: 25,
  orphan_penalty: 15,
  vector_index: 15,
  relation_health: 10,
  issue_penalty: 10,
} as const;

export const TRUST_SCORE_FORMULA =
  "100 × weighted sum: embedding coverage (25%), verification coverage (25%), low orphan rate (15%), vector index OK (15%), relation balance (10%), minus high-severity issue density (10%)";

function pct(numerator: number, denominator: number): number {
  if (denominator <= 0) return denominator === 0 && numerator === 0 ? 1 : 0;
  return Math.max(0, Math.min(1, numerator / denominator));
}

/** One weighted component of the trust score — supports "what lowered this score" surfaces. */
export type TrustScoreFactor = {
  id:
    | "embedding_coverage"
    | "verification_coverage"
    | "orphan_rate"
    | "vector_index"
    | "relation_health"
    | "issue_penalty";
  label: string;
  /** Weight of the factor (maximum points it can contribute to the 0–100 score). */
  max_points: number;
  /** Points attained (0 ≤ points ≤ max_points). */
  points: number;
};

export type TrustScoreBreakdown = {
  /** The score, identical to computeTrustScore (rounded clamp of the factor sum). */
  score: number;
  factors: TrustScoreFactor[];
};

/**
 * Factor-level trust score: the same v1 formula as computeTrustScore, with the
 * per-factor attainment exposed so a scorecard can explain what lowered the score.
 * Single source of truth — computeTrustScore delegates here.
 */
export function computeTrustScoreBreakdown(
  metrics: KgAuditMetrics,
  issues: KgAuditIssueDraft[],
): TrustScoreBreakdown {
  const accepted = metrics.accepted_claims ?? 0;
  const unverified = metrics.accepted_unverified ?? 0;
  const missingEmb = metrics.accepted_missing_embedding ?? 0;
  const orphans = metrics.orphan_claims ?? 0;

  const embeddingCoverage = accepted > 0 ? pct(accepted - missingEmb, accepted) : 0;
  const verificationCoverage = accepted > 0 ? pct(accepted - unverified, accepted) : 0;
  const orphanRate = accepted > 0 ? 1 - pct(orphans, accepted) : 1;

  const vectorOk =
    metrics.vector_index && typeof metrics.vector_index === "object"
      ? metrics.vector_index.ok !== false
      : false;

  const supports = metrics.relation_totals?.supports ?? 0;
  const contradicts = metrics.relation_totals?.contradicts ?? 0;
  const totalRel = supports + contradicts;
  let relationHealth = 0.5;
  if (totalRel > 0) {
    const contFrac = contradicts / totalRel;
    const supFrac = supports / totalRel;
    relationHealth =
      contFrac >= 0.05 && contFrac <= 0.6 && supFrac <= 0.85 ? 1 : contFrac < 0.05 ? 0.4 : 0.7;
  }

  const highIssues = issues.filter((i) => i.severity === "high").length;
  const issuePenalty = Math.max(0, 1 - highIssues / 20);

  const factors: TrustScoreFactor[] = [
    {
      id: "embedding_coverage",
      label: "Embedding coverage",
      max_points: WEIGHTS.embedding_coverage,
      points: WEIGHTS.embedding_coverage * embeddingCoverage,
    },
    {
      id: "verification_coverage",
      label: "Verification coverage",
      max_points: WEIGHTS.verification_coverage,
      points: WEIGHTS.verification_coverage * verificationCoverage,
    },
    {
      id: "orphan_rate",
      label: "Low orphan rate",
      max_points: WEIGHTS.orphan_penalty,
      points: WEIGHTS.orphan_penalty * orphanRate,
    },
    {
      id: "vector_index",
      label: "Vector index",
      max_points: WEIGHTS.vector_index,
      points: WEIGHTS.vector_index * (vectorOk ? 1 : 0),
    },
    {
      id: "relation_health",
      label: "Relation balance",
      max_points: WEIGHTS.relation_health,
      points: WEIGHTS.relation_health * relationHealth,
    },
    {
      id: "issue_penalty",
      label: "High-severity issue density",
      max_points: WEIGHTS.issue_penalty,
      points: WEIGHTS.issue_penalty * issuePenalty,
    },
  ];

  const raw = factors.reduce((sum, f) => sum + f.points, 0);
  return { score: Math.round(Math.max(0, Math.min(100, raw))), factors };
}

export function computeTrustScore(metrics: KgAuditMetrics, issues: KgAuditIssueDraft[]): number {
  return computeTrustScoreBreakdown(metrics, issues).score;
}

export function buildAuditSummary(
  metrics: KgAuditMetrics,
  issues: KgAuditIssueDraft[],
  checksRun: number,
): KgAuditSummary {
  const issue_counts_by_severity = { info: 0, low: 0, medium: 0, high: 0 };
  const issue_counts_by_kind: KgAuditSummary["issue_counts_by_kind"] = {};
  for (const issue of issues) {
    issue_counts_by_severity[issue.severity] += 1;
    issue_counts_by_kind[issue.kind] = (issue_counts_by_kind[issue.kind] ?? 0) + 1;
  }
  return {
    trust_score: computeTrustScore(metrics, issues),
    trust_formula: TRUST_SCORE_FORMULA,
    issue_counts_by_severity,
    issue_counts_by_kind,
    total_issues: issues.length,
    checks_run: checksRun,
  };
}
