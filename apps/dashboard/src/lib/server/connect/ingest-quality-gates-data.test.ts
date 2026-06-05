import { describe, expect, it } from "vitest";
import {
  buildProductionG2SampleJob,
  computeGateStatuses,
  parseStoredProductionQualityReport,
  summarizeG2Aggregate,
} from "./ingest-quality-gates-data";

describe("ingest-quality-gates-data", () => {
  it("parses production quality reports with extended fields", () => {
    const report = parseStoredProductionQualityReport({
      preset: "production",
      ok_pct: 43,
      weak_pct: 40,
      unsupported_pct: 17,
      units: 120,
      execution_mode: "full",
      kg_audit: { trust_score: 72 },
    });
    expect(report?.okPct).toBe(43);
    expect(report?.units).toBe(120);
    expect(report?.trustScore).toBe(72);
  });

  it("ignores starter preset jobs", () => {
    expect(
      parseStoredProductionQualityReport({ preset: "starter", ok_pct: 100 }),
    ).toBeNull();
  });

  it("computes aggregate G2 matching assertG2Targets", () => {
    const jobs = [
      buildProductionG2SampleJob({
        id: "a",
        workspaceId: "w",
        projectId: null,
        label: null,
        updatedAt: 1,
        report: {
          preset: "production",
          executionMode: "full",
          units: 10,
          okPct: 43,
          weakPct: 40,
          unsupportedPct: 17,
          trustScore: 70,
          stubWarning: null,
        },
      }),
    ];
    const agg = summarizeG2Aggregate(jobs);
    expect(agg.pass).toBe(false);
    expect(agg.sample_jobs).toBe(1);
    const statuses = computeGateStatuses(jobs);
    expect(statuses.find((s) => s.gateId === "g2")?.status).toBe("fail");
    expect(statuses.find((s) => s.gateId === "g3")?.status).toBe("fail");
  });
});
