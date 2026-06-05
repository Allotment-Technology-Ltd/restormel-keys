import { describe, expect, it } from "vitest";
import { graphStatsToHealthSummary } from "./graph-health-summary";

const baseStats = {
  units: 973,
  embedded: 809,
  relations: 743,
  validation: { ok: 433, weak: 56, unsupported: 484, unvalidated: 0 },
};

describe("graphStatsToHealthSummary", () => {
  it("returns null when graph has no units", () => {
    expect(graphStatsToHealthSummary({ ...baseStats, units: 0 })).toBeNull();
  });

  it("reports both audit issues with actionable detail", () => {
    const summary = graphStatsToHealthSummary(baseStats);
    expect(summary?.total_issues).toBe(2);
    expect(summary?.ok_pct).toBe(45);
    expect(summary?.issues).toHaveLength(2);
    expect(summary?.issues[0]).toMatchObject({
      kind: "low_ok_rate",
      title: "Low support rate",
    });
    expect(summary?.issues[0]?.detail).toContain("484 unsupported");
    expect(summary?.issues[0]?.actionHref).toContain("/graph?filter=review");
    expect(summary?.issues[1]).toMatchObject({
      kind: "missing_embeddings",
      title: "Missing embeddings",
    });
    expect(summary?.issues[1]?.detail).toContain("164 of 973");
    expect(summary?.issues[1]?.actionHref).toContain("/graph?workspace=tools&focus=embed");
    expect(summary?.issues[1]?.actionLabel).toBe("Embed missing ideas");
  });

  it("returns no issues when support and embeddings are healthy", () => {
    const summary = graphStatsToHealthSummary({
      units: 100,
      embedded: 100,
      relations: 50,
      validation: { ok: 95, weak: 3, unsupported: 2, unvalidated: 0 },
    });
    expect(summary?.total_issues).toBe(0);
    expect(summary?.issues).toEqual([]);
  });

  it("flags only missing embeddings when support rate is strong", () => {
    const summary = graphStatsToHealthSummary({
      units: 50,
      embedded: 40,
      relations: 10,
      validation: { ok: 48, weak: 1, unsupported: 1, unvalidated: 0 },
    });
    expect(summary?.total_issues).toBe(1);
    expect(summary?.issues[0]?.kind).toBe("missing_embeddings");
  });
});
