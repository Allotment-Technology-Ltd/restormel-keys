/**
 * Cascade-validation harness tests (restormel-verification-engineering §7 "how to verify").
 * Covers BOTH entry points: (i) first-party corpus bar report — three separate numbers
 * (accuracy / error / abstention), fixture/live label, cache-hit rate alongside accuracy,
 * stage-1 informativeness present; (ii) wrapped-MCP scenario — in-path economics with the
 * mcpWrappingIsStub honesty flag. Plus AUROC correctness and the abstention behaviour on the
 * planted false-premise / absent-evidence fixtures.
 */
import { describe, it, expect } from "vitest";
import { buildDefaultCascade } from "../cascade/default-cascade.js";
import { runFirstPartyCorpus, runWrappedMcpScenario } from "../cascade/harness.js";
import { LEGAL_FIXTURE, PHARMA_FIXTURE, ALL_CORPUS_FIXTURES } from "../cascade/fixtures/corpus-samples.js";
import { REDIS_IRIS_STUB_CLAIMS } from "../cascade/fixtures/mcp-scenario.js";
import { computeAuroc, assessStage1Informativeness } from "../cascade/calibration.js";

describe("runFirstPartyCorpus — bar report shape (skill §7)", () => {
  it("reports accuracy, error, and abstention as SEPARATE numbers with CIs and a fixture label", async () => {
    const { cascade, frontierIsFixture } = buildDefaultCascade();
    const [report] = await runFirstPartyCorpus({
      cascade,
      fixture: LEGAL_FIXTURE,
      modes: ["batch"],
      runKind: frontierIsFixture ? "fixture" : "live",
    });
    expect(report.run_kind).toBe("fixture"); // no live credential in this environment
    expect(report.supportedAccuracy).toHaveProperty("ci95");
    expect(report.unsupportedErrorRate).toHaveProperty("ci95");
    expect(report.abstentionRate).toHaveProperty("ci95");
    expect(report.cacheHitRate).toHaveProperty("value"); // cache-hit rate alongside accuracy
    expect(report.stage1).toHaveProperty("auroc");
    expect(report.stage1).toHaveProperty("informative");
    expect(typeof report.barPass).toBe("boolean");
  });

  it("NEVER leaks a truly-unsupported claim to supported (fabricated + contradicted + absent)", async () => {
    const { cascade, frontierIsFixture } = buildDefaultCascade();
    const reports = await runFirstPartyCorpus({
      cascade,
      fixture: PHARMA_FIXTURE,
      modes: ["batch"],
      runKind: frontierIsFixture ? "fixture" : "live",
    });
    // The <=2% bar is a leak rate; on this small planted-bad fixture the doubles must not
    // mark a contradicted/fabricated/absent claim as supported.
    expect(reports[0]!.unsupportedErrorRate.value).toBeLessThanOrEqual(0.01);
  });

  it("runs every corpus in both modes without throwing", async () => {
    for (const fixture of ALL_CORPUS_FIXTURES) {
      const { cascade, frontierIsFixture } = buildDefaultCascade();
      const reports = await runFirstPartyCorpus({
        cascade,
        fixture,
        modes: ["batch", "in_path"],
        latencyBudgetMs: 5_000,
        runKind: frontierIsFixture ? "fixture" : "live",
      });
      expect(reports).toHaveLength(2);
      expect(reports.map((r) => r.mode).sort()).toEqual(["batch", "in_path"]);
    }
  });
});

describe("runWrappedMcpScenario — Stage-5 in-path economics (skill §7 dual input)", () => {
  it("produces in-path economics and honestly flags the MCP wrapping as a stub", async () => {
    const { cascade, frontierIsFixture } = buildDefaultCascade();
    const report = await runWrappedMcpScenario({
      cascade,
      scenario: "redis-iris-stub",
      claims: REDIS_IRIS_STUB_CLAIMS,
      latencyBudgetMs: 5_000,
      runKind: frontierIsFixture ? "fixture" : "live",
      mcpWrappingIsStub: true,
    });
    expect(report.mcpWrappingIsStub).toBe(true);
    expect(report.run_kind).toBe("fixture");
    expect(report.economics.mode).toBe("in_path");
    expect(report.addedVerifyLatencyMsPerClaim).toBeGreaterThanOrEqual(0);
    expect(report.honesty).toMatch(/STUB/);
  });
});

describe("computeAuroc — informativeness metric (skill §4)", () => {
  it("returns ~1 for perfectly separating scores and ~0.5 for random", () => {
    expect(computeAuroc([0.9, 0.8, 0.2, 0.1], [true, true, false, false])).toBe(1);
    // Interleaved -> around chance.
    const auroc = computeAuroc([0.5, 0.5, 0.5, 0.5], [true, false, true, false]);
    expect(auroc).toBeCloseTo(0.5, 5);
  });

  it("assessStage1Informativeness flags an uninformative corpus with a simplification finding", () => {
    const finding = assessStage1Informativeness("flat-corpus", 0.5);
    expect(finding.informative).toBe(false);
    expect(finding.finding).toMatch(/UNINFORMATIVE|simplification/);
  });
});
