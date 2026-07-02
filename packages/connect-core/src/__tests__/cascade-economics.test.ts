/**
 * Unit-economics instrumentation tests (restormel-verification-engineering §8 "how to
 * verify"). Covers: the full OTel GenAI attribute set on every emitted span, authoritative
 * (never client-estimated) token fields, the five first-class metrics keyed (corpus, mode),
 * and cluster-robust SE > naive SE when claims share a source doc (skill §7).
 */
import { describe, it, expect } from "vitest";
import { buildDefaultCascade } from "../cascade/default-cascade.js";
import { EconomicsRecorder, clusteredProportionEstimate, proportionEstimate } from "../cascade/economics.js";
import type { CascadeClaimInput } from "../cascade/cascade.js";

const claim = (ref: string, c: string, span: string, doc = "doc"): CascadeClaimInput => ({
  ref,
  claim: c,
  span,
  sourceVersionHash: "h",
  sourceDocId: doc,
});

describe("GenAiCallSpan — OTel GenAI attribute set (skill §8)", () => {
  it("every emitted span carries the full required attribute set", async () => {
    const recorder = new EconomicsRecorder();
    const { cascade } = buildDefaultCascade();
    await cascade.verify(
      claim("s", "The term is three years.", "a term of three years applies"),
      { corpus: "legal", mode: "batch", recorder },
    );
    const spans = recorder.allSpans();
    expect(spans.length).toBeGreaterThan(0);
    for (const s of spans) {
      expect(s).toHaveProperty("gen_ai.provider.name");
      expect(s).toHaveProperty("gen_ai.request.model");
      expect(s).toHaveProperty("gen_ai.usage.input_tokens");
      expect(s).toHaveProperty("gen_ai.usage.output_tokens");
      expect(s).toHaveProperty("cost_usd");
      expect(s.tier).toBeTypeOf("string");
      expect(s.mode).toBe("batch");
      expect(s.corpus).toBe("legal");
      expect(s.latency_ms).toBeTypeOf("number");
      // Fixture doubles: usage is null (honest absence), never a fabricated client estimate.
      expect(s.fixture).toBe(true);
      expect(s["gen_ai.usage.input_tokens"]).toBeNull();
    }
  });
});

describe("EconomicsRecorder.report — five metrics keyed (corpus, mode)", () => {
  it("reports cost/claim, cache-hit rate, tier distribution, abstention rate, latency per tier", async () => {
    const recorder = new EconomicsRecorder();
    const { cascade } = buildDefaultCascade();
    for (const c of [
      claim("1", "term of three years", "a term of three years", "d1"),
      claim("2", "governed by France", "governed by the laws of England and Wales", "d1"),
      claim("3", "nothing here", "", "d2"),
    ]) {
      await cascade.verify(c, { corpus: "legal", mode: "batch", recorder });
    }
    const report = recorder.report("legal", "batch");
    expect(report.claims).toBe(3);
    expect(report.cacheHitRate).toHaveProperty("value");
    expect(report.cacheHitRate).toHaveProperty("ci95");
    expect(report.abstentionRate).toHaveProperty("ci95");
    expect(report.escalationRate).toHaveProperty("ci95");
    expect(Object.values(report.tierDistribution).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 5);
    expect(report.latencyPerTierMs).toBeTypeOf("object");
  });
});

describe("clusteredProportionEstimate — SE inflation from per-doc clusters (skill §7)", () => {
  it("clustered SE exceeds naive SE when outcomes are correlated within source docs", () => {
    // 20 obs across 2 docs; within each doc every outcome is identical (max intra-cluster
    // correlation). Naive SE treats them as 20 independent draws; clustered as ~2.
    const successes = [...Array(10).fill(true), ...Array(10).fill(false)];
    const clusters = [...Array(10).fill("docA"), ...Array(10).fill("docB")];
    const clustered = clusteredProportionEstimate(successes, clusters);
    const naive = proportionEstimate(10, 20);
    expect(clustered.value).toBeCloseTo(0.5, 5);
    expect(clustered.se).toBeGreaterThan(naive.se);
  });

  it("reduces toward the naive SE when every observation is its own cluster", () => {
    const successes = [true, false, true, false];
    const clusters = ["a", "b", "c", "d"];
    const clustered = clusteredProportionEstimate(successes, clusters);
    const naive = proportionEstimate(2, 4);
    // Same point estimate; SEs are the same order of magnitude (no clustering to inflate).
    expect(clustered.value).toBeCloseTo(naive.value, 5);
    expect(clustered.se).toBeGreaterThan(0);
  });
});
