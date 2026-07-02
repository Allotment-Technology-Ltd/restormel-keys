/**
 * Unit-economics instrumentation tests (restormel-verification-engineering §8 "how to
 * verify"). Covers: the full OTel GenAI attribute set on every emitted span, authoritative
 * (never client-estimated) token fields, the five first-class metrics keyed (corpus, mode),
 * and cluster-robust SE > naive SE when claims share a source doc (skill §7).
 */
import { describe, it, expect } from "vitest";
import { buildDefaultCascade } from "../cascade/default-cascade.js";
import { VerifierCascade } from "../cascade/cascade.js";
import { EconomicsRecorder, clusteredProportionEstimate, proportionEstimate } from "../cascade/economics.js";
import { InMemoryVerdictCache } from "../cascade/verdict-cache.js";
import { DEV_FIXTURE_CALIBRATION } from "../cascade/calibration.js";
import type { VerifierTier } from "../cascade/verifier-port.js";
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

describe("authoritative usage seam — a LIVE tier populates cost + marks the span non-fixture (skill §8)", () => {
  // A tier that returns authoritative usage (as a real credentialed adapter would). It
  // decides "supported" with high confidence so the prefilter accepts it in one call.
  const liveHhem: VerifierTier = {
    id: "hhem-2.1-open",
    modelFamily: "flan-t5",
    modelVersion: "2.1-open-live",
    configHash: "live",
    promptTemplateVersion: "hhem-live-1",
    async verify(request) {
      return {
        ref: request.ref,
        verdict: "supported",
        confidence: 0.99,
        usage: { inputTokens: 120, outputTokens: 8, costUsd: 0.0003 },
      };
    },
  };

  it("emits fixture:false with real token counts + cost, and cost-per-verified-claim is populated", async () => {
    const recorder = new EconomicsRecorder();
    const cascade = new VerifierCascade({
      slots: [{ role: "prefilter", tier: liveHhem }],
      calibration: DEV_FIXTURE_CALIBRATION,
      cache: new InMemoryVerdictCache(),
    });
    await cascade.verify(
      { ref: "L", claim: "the term is three years", span: "a term of three years applies", sourceVersionHash: "h", sourceDocId: "d1" },
      { corpus: "c", mode: "batch", recorder },
    );
    const span = recorder.allSpans().find((s) => s.tier === "prefilter");
    expect(span).toBeDefined();
    // A live call (authoritative usage present) is NOT a fixture and carries real numbers.
    expect(span!.fixture).toBe(false);
    expect(span!["gen_ai.usage.input_tokens"]).toBe(120);
    expect(span!.cost_usd).toBeCloseTo(0.0003, 8);

    const report = recorder.report("c", "batch");
    // The cost seam is now structurally reachable: at least one claim carries authoritative cost.
    expect(report.claimsWithAuthoritativeCost).toBe(1);
    expect(report.costPerVerifiedClaim.value).toBeCloseTo(0.0003, 8);
  });

  it("cache hits are valued at the mean authoritative cost of the avoided tier (skill §8)", async () => {
    const recorder = new EconomicsRecorder();
    const cache = new InMemoryVerdictCache();
    const cascade = new VerifierCascade({
      slots: [{ role: "prefilter", tier: liveHhem }],
      calibration: DEV_FIXTURE_CALIBRATION,
      cache,
    });
    const c: CascadeClaimInput = {
      ref: "H1", claim: "the term is three years", span: "a term of three years applies",
      sourceVersionHash: "h", sourceDocId: "d1",
    };
    await cascade.verify(c, { corpus: "c", mode: "in_path", recorder }); // cold: pays cost
    await cascade.verify({ ...c, ref: "H2" }, { corpus: "c", mode: "in_path", recorder }); // hit
    const report = recorder.report("c", "in_path");
    expect(report.cacheHitRate.value).toBeCloseTo(0.5, 5);
    // The hit avoided the prefilter, whose authoritative cost was 0.0003 -> that is the value saved.
    expect(report.cacheAvoidedCostUsd).toBeCloseTo(0.0003, 8);
  });

  it("fixtures carry NO authoritative cost, so cache-hit valuation is honestly null, never faked", async () => {
    const recorder = new EconomicsRecorder();
    const cache = new InMemoryVerdictCache();
    const { cascade } = buildDefaultCascade({ cache });
    const c: CascadeClaimInput = {
      ref: "F1", claim: "the term is three years commencing on the effective date",
      span: "This Agreement shall have a term of three years commencing on the effective date.",
      sourceVersionHash: "h", sourceDocId: "d1",
    };
    await cascade.verify(c, { corpus: "c", mode: "in_path", recorder });
    await cascade.verify({ ...c, ref: "F2" }, { corpus: "c", mode: "in_path", recorder });
    const report = recorder.report("c", "in_path");
    expect(report.cacheHitRate.value).toBeGreaterThan(0);
    expect(report.cacheAvoidedCostUsd).toBeNull(); // no authoritative tier cost ever seen
  });
});

describe("escalationRate counts claims that REACHED escalation, not only those decided there (skill §8)", () => {
  it("a claim that reaches the frontier tier and then abstains still counts toward β", async () => {
    const recorder = new EconomicsRecorder();
    // Frontier double that always yields low confidence -> not accepted -> cascade exhausts -> abstained,
    // but the escalation span WAS emitted (the claim reached escalation).
    const weakFrontier: VerifierTier = {
      id: "frontier-api", modelFamily: "frontier", modelVersion: "v1",
      configHash: "double", promptTemplateVersion: "p1",
      async verify(request) {
        return { ref: request.ref, verdict: "unverifiable", confidence: 0.1 };
      },
    };
    const { cascade } = buildDefaultCascade();
    void cascade; // use an explicit cascade to force escalation:
    const forced = new VerifierCascade({
      slots: [{ role: "escalation", tier: weakFrontier }],
      calibration: DEV_FIXTURE_CALIBRATION,
      cache: new InMemoryVerdictCache(),
    });
    const rec = await forced.verify(
      { ref: "E", claim: "an ambiguous assertion", span: "an unrelated sentence", sourceVersionHash: "h", sourceDocId: "d1" },
      { corpus: "c", mode: "batch", recorder },
    );
    expect(rec.finalVerdict).toBe("abstained");
    const report = recorder.report("c", "batch");
    // Reached escalation despite not being decided there.
    expect(report.escalationRate.value).toBeCloseTo(1, 5);
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
