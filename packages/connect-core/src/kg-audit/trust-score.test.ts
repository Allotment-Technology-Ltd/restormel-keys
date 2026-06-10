import { describe, it, expect } from "vitest";
import {
  buildAuditSummary,
  computeTrustScore,
  computeTrustScoreBreakdown,
  type KgAuditMetrics,
} from "./trust-score.js";

const healthyMetrics: KgAuditMetrics = {
  accepted_claims: 100,
  accepted_unverified: 0,
  accepted_missing_embedding: 0,
  orphan_claims: 0,
  vector_index: { ok: true },
  relation_totals: { supports: 60, contradicts: 20 },
};

describe("computeTrustScoreBreakdown", () => {
  it("returns the exact same score as computeTrustScore (single source of truth)", () => {
    const cases: [KgAuditMetrics, Parameters<typeof computeTrustScore>[1]][] = [
      [healthyMetrics, []],
      [{ accepted_claims: 50, accepted_unverified: 25, accepted_missing_embedding: 10 }, []],
      [
        { accepted_claims: 10, vector_index: { ok: false } },
        [{ kind: "missing_embeddings", severity: "high", message: "x" }],
      ],
      [{}, []],
    ];
    for (const [metrics, issues] of cases) {
      expect(computeTrustScoreBreakdown(metrics, issues).score).toBe(
        computeTrustScore(metrics, issues),
      );
    }
  });

  it("factor points sum to the (unclamped) raw score and never exceed max_points", () => {
    const { score, factors } = computeTrustScoreBreakdown(healthyMetrics, []);
    const sum = factors.reduce((s, f) => s + f.points, 0);
    expect(Math.round(sum)).toBe(score);
    for (const f of factors) {
      expect(f.points).toBeGreaterThanOrEqual(0);
      expect(f.points).toBeLessThanOrEqual(f.max_points);
    }
    expect(factors.map((f) => f.id)).toEqual([
      "embedding_coverage",
      "verification_coverage",
      "orphan_rate",
      "vector_index",
      "relation_health",
      "issue_penalty",
    ]);
  });

  it("attributes lost points to the right factor (what lowered this score)", () => {
    const { factors } = computeTrustScoreBreakdown(
      { ...healthyMetrics, accepted_missing_embedding: 50 },
      [],
    );
    const embedding = factors.find((f) => f.id === "embedding_coverage")!;
    const verification = factors.find((f) => f.id === "verification_coverage")!;
    expect(embedding.points).toBeCloseTo(12.5, 5); // 25 × 0.5 coverage
    expect(verification.points).toBe(25); // untouched
  });

  it("keeps buildAuditSummary trust_score consistent with the breakdown", () => {
    const issues = [{ kind: "missing_embeddings", severity: "high" as const, message: "x" }];
    const summary = buildAuditSummary(healthyMetrics, issues, 3);
    expect(summary.trust_score).toBe(computeTrustScoreBreakdown(healthyMetrics, issues).score);
  });
});
