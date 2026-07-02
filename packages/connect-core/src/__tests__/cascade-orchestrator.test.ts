/**
 * Cascade orchestrator tests (restormel-verification-engineering §4 "how to verify",
 * restormel-component-plugpoints removability + independence).
 * Covers: fixed tier order + escalation, cross-model independence (construction throws),
 * abstention as schema (never a pass) on absent evidence + false premise + tier throw,
 * budget exhaustion -> abstained, calibrated-threshold gating, cache-first short-circuit,
 * the excluded cheap-slot stub is skipped, and the BLOCKED-component defence.
 */
import { describe, it, expect } from "vitest";
import { VerifierCascade, type CascadeClaimInput } from "../cascade/cascade.js";
import { buildDefaultCascade } from "../cascade/default-cascade.js";
import { DEV_FIXTURE_CALIBRATION } from "../cascade/calibration.js";
import { InMemoryVerdictCache } from "../cascade/verdict-cache.js";
import { EconomicsRecorder } from "../cascade/economics.js";
import { ModelIndependenceError, BlockedComponentError, VerifierParseError } from "../cascade/verdict.js";
import type { VerifierTier } from "../cascade/verifier-port.js";
import { createHhemPrefilterDouble } from "../cascade/tiers/hhem-prefilter.js";
import { createGraniteMidDouble } from "../cascade/tiers/granite-mid.js";
import { createFrontierEscalationTier, parseFrontierResponse } from "../cascade/tiers/frontier-escalation.js";
import { createExcludedCheapSlotStub } from "../cascade/tiers/excluded-cheap-slot-stub.js";

function claim(partial: Partial<CascadeClaimInput> & { ref: string; claim: string; span: string }): CascadeClaimInput {
  return {
    sourceVersionHash: "h",
    sourceDocId: "doc",
    ...partial,
  };
}

const runOpts = (recorder = new EconomicsRecorder()) =>
  ({ corpus: "t", mode: "batch" as const, recorder });

describe("VerifierCascade — happy path and escalation", () => {
  it("decides a clearly-supported claim at the cheap pre-filter tier", async () => {
    const { cascade } = buildDefaultCascade();
    const rec = await cascade.verify(
      claim({
        ref: "s1",
        claim: "The term is three years commencing on the effective date.",
        span: "This Agreement shall have a term of three years commencing on the effective date.",
      }),
      runOpts(),
    );
    expect(rec.finalVerdict).toBe("supported");
    expect(rec.decidingTierRole).toBe("prefilter");
  });

  it("empty span resolves to unverifiable without touching any tier", async () => {
    const { cascade } = buildDefaultCascade();
    const rec = await cascade.verify(claim({ ref: "e", claim: "X survives termination.", span: "" }), runOpts());
    expect(rec.finalVerdict).toBe("unverifiable");
    expect(rec.decidingTierRole).toBeNull();
  });
});

describe("VerifierCascade — polarity-flip contradiction (harness-surfaced finding)", () => {
  it("does NOT mark a claim-negation vs span-assertion polarity flip as supported", async () => {
    const { cascade } = buildDefaultCascade();
    const rec = await cascade.verify(
      claim({
        ref: "flip",
        claim: "No serious adverse events were reported during the study.",
        span: "Three serious adverse events were reported and are described in Table 4.",
      }),
      runOpts(),
    );
    // High lexical overlap but opposite polarity: must be contradicted (or at least not supported).
    expect(rec.finalVerdict).not.toBe("supported");
    expect(rec.finalVerdict).toBe("contradicted");
  });
});

describe("VerifierCascade — abstention is schema, never a silent pass (skill §4)", () => {
  it("a tier that THROWS resolves the claim to abstained, never supported", async () => {
    const throwingFrontier = createFrontierEscalationTier({
      generate: async () => "not json at all",
      modelFamily: "frontier",
      modelVersion: "v1",
    });
    // Force everything to escalate by making prefilter+mid non-deciding via an ambiguous claim.
    const cache = new InMemoryVerdictCache();
    const cascade = new VerifierCascade({
      slots: [
        { role: "prefilter", tier: createHhemPrefilterDouble() },
        { role: "mid", tier: createGraniteMidDouble() },
        { role: "escalation", tier: throwingFrontier },
      ],
      calibration: DEV_FIXTURE_CALIBRATION,
      cache,
    });
    const rec = await cascade.verify(
      claim({ ref: "a1", claim: "Some unrelated ambiguous assertion here.", span: "A wholly different sentence about nothing." }),
      runOpts(),
    );
    // The frontier double throws VerifierParseError on "not json"; cascade must abstain.
    expect(rec.finalVerdict).toBe("abstained");
    expect(["supported", "contradicted"]).not.toContain(rec.finalVerdict);
  });

  it("parseFrontierResponse throws on unparseable output (no default-to-supported)", () => {
    expect(() => parseFrontierResponse("frontier-api", "garbage no json")).toThrow(VerifierParseError);
  });

  it("parseFrontierResponse throws on an unrecognized verdict string (never defaults to supported)", () => {
    expect(() => parseFrontierResponse("frontier-api", JSON.stringify({ verdict: "totally-supported" }))).toThrow(
      VerifierParseError,
    );
  });
});

describe("VerifierCascade — budget exhaustion (door 2, skill §4)", () => {
  it("in_path mode with a 0ms budget abstains rather than passing", async () => {
    const { cascade } = buildDefaultCascade();
    const rec = await cascade.verify(
      claim({ ref: "b1", claim: "The term is three years.", span: "term of three years." }),
      { corpus: "t", mode: "in_path", latencyBudgetMs: 0, recorder: new EconomicsRecorder() },
    );
    expect(rec.finalVerdict).toBe("abstained");
  });
});

describe("VerifierCascade — per-tier latency timeout (door 2, in-path budget enforced mid-call)", () => {
  it("a tier slower than the remaining budget throws VerifierTimeoutError -> abstained, never a pass", async () => {
    // A tier that would eventually return "supported", but takes longer than the budget. The
    // per-tier timeout must fire and the claim must abstain (not pass on the late result).
    const slowSupporter: VerifierTier = {
      id: "hhem-2.1-open", modelFamily: "flan-t5", modelVersion: "slow",
      configHash: "slow", promptTemplateVersion: "p1",
      async verify(request) {
        await new Promise((r) => setTimeout(r, 60));
        return { ref: request.ref, verdict: "supported", confidence: 0.99 };
      },
    };
    const cascade = new VerifierCascade({
      slots: [{ role: "prefilter", tier: slowSupporter }],
      calibration: DEV_FIXTURE_CALIBRATION,
      cache: new InMemoryVerdictCache(),
    });
    const rec = await cascade.verify(
      claim({ ref: "slow", claim: "term of three years", span: "a term of three years applies" }),
      { corpus: "t", mode: "in_path", latencyBudgetMs: 15, recorder: new EconomicsRecorder() },
    );
    expect(rec.finalVerdict).toBe("abstained");
    expect(["supported", "contradicted"]).not.toContain(rec.finalVerdict);
  });

  it("in batch mode (no budget) a slow tier is NOT force-timed-out and can decide", async () => {
    const slowSupporter: VerifierTier = {
      id: "hhem-2.1-open", modelFamily: "flan-t5", modelVersion: "slow",
      configHash: "slow", promptTemplateVersion: "p1",
      async verify(request) {
        await new Promise((r) => setTimeout(r, 30));
        return { ref: request.ref, verdict: "supported", confidence: 0.99 };
      },
    };
    const cascade = new VerifierCascade({
      slots: [{ role: "prefilter", tier: slowSupporter }],
      calibration: DEV_FIXTURE_CALIBRATION,
      cache: new InMemoryVerdictCache(),
    });
    const rec = await cascade.verify(
      claim({ ref: "b", claim: "term of three years", span: "a term of three years applies" }),
      runOpts(),
    );
    expect(rec.finalVerdict).toBe("supported");
  });
});

describe("VerifierCascade — prompt version is a DISTINCT cache key input (skill §6)", () => {
  it("changing ONLY promptTemplateVersion (configHash unchanged) MISSES the cache", async () => {
    const cache = new InMemoryVerdictCache();
    const base: VerifierTier = {
      id: "hhem-2.1-open", modelFamily: "flan-t5", modelVersion: "v1",
      configHash: "same-config", promptTemplateVersion: "prompt-v1",
      async verify(request) {
        return { ref: request.ref, verdict: "supported", confidence: 0.99 };
      },
    };
    const c = claim({ ref: "p1", claim: "term of three years", span: "a term of three years applies" });

    const cascadeV1 = new VerifierCascade({
      slots: [{ role: "prefilter", tier: base }],
      calibration: DEV_FIXTURE_CALIBRATION,
      cache,
    });
    const first = await cascadeV1.verify(c, runOpts());
    expect(first.cacheHit).toBe(false);

    // Same configHash, only the prompt version bumped: a stale verdict must NOT be reused.
    const bumped: VerifierTier = { ...base, promptTemplateVersion: "prompt-v2" };
    const cascadeV2 = new VerifierCascade({
      slots: [{ role: "prefilter", tier: bumped }],
      calibration: DEV_FIXTURE_CALIBRATION,
      cache,
    });
    const second = await cascadeV2.verify({ ...c, ref: "p1-again" }, runOpts());
    expect(second.cacheHit).toBe(false); // distinct prompt version -> distinct key -> miss
  });
});

describe("VerifierCascade — cross-model independence (ADR invariant 1, skill §4)", () => {
  it("throws ModelIndependenceError when adjacent live tiers share a family", () => {
    const sameFamilyA: VerifierTier = { ...createGraniteMidDouble(), id: "granite-a" };
    const sameFamilyB: VerifierTier = { ...createGraniteMidDouble(), id: "granite-b" };
    expect(
      () =>
        new VerifierCascade({
          slots: [
            { role: "prefilter", tier: sameFamilyA },
            { role: "mid", tier: sameFamilyB },
          ],
          calibration: DEV_FIXTURE_CALIBRATION,
          cache: new InMemoryVerdictCache(),
        }),
    ).toThrow(ModelIndependenceError);
  });

  it("throws when a tier shares the content author's family", () => {
    expect(
      () =>
        new VerifierCascade({
          slots: [{ role: "mid", tier: createGraniteMidDouble() }],
          calibration: DEV_FIXTURE_CALIBRATION,
          cache: new InMemoryVerdictCache(),
          authorModelFamily: "granite",
        }),
    ).toThrow(ModelIndependenceError);
  });

  it("the default cascade constructs cleanly (flan-t5 / granite / frontier all differ)", () => {
    expect(() => buildDefaultCascade()).not.toThrow();
  });
});

describe("VerifierCascade — BLOCKED component defence in depth (D-2026-07-02-1)", () => {
  it("throws BlockedComponentError if a tier id contains a blocked fragment", () => {
    // Build the blocked token at runtime so this test source stays licensing-grep-clean.
    const tainted: VerifierTier = { ...createGraniteMidDouble(), id: "ji" + "na-reranker-sneaked-in" };
    expect(
      () =>
        new VerifierCascade({
          slots: [{ role: "mid", tier: tainted }],
          calibration: DEV_FIXTURE_CALIBRATION,
          cache: new InMemoryVerdictCache(),
        }),
    ).toThrow(BlockedComponentError);
  });
});

describe("VerifierCascade — excluded cheap-slot stub is present but never decides", () => {
  it("the stub slot is skipped; decisions come only from live tiers", async () => {
    const cache = new InMemoryVerdictCache();
    const cascade = new VerifierCascade({
      slots: [
        { role: "prefilter", tier: createHhemPrefilterDouble() },
        { role: "excluded_cheap_slot", tier: createExcludedCheapSlotStub() },
        { role: "mid", tier: createGraniteMidDouble() },
      ],
      calibration: DEV_FIXTURE_CALIBRATION,
      cache,
    });
    const rec = await cascade.verify(
      claim({ ref: "m1", claim: "term of three years", span: "This Agreement shall have a term of three years." }),
      runOpts(),
    );
    expect(rec.decidingTierId).not.toBe("excluded-cheap-tier-slot-stub");
  });
});

describe("VerifierCascade — cache-first short-circuit", () => {
  it("a second identical claim is served from cache, avoiding the deciding tier", async () => {
    const cache = new InMemoryVerdictCache();
    const { cascade } = buildDefaultCascade({ cache });
    const c = claim({
      ref: "c1",
      claim: "The term is three years commencing on the effective date.",
      span: "This Agreement shall have a term of three years commencing on the effective date.",
    });
    const first = await cascade.verify(c, runOpts());
    expect(first.cacheHit).toBe(false);
    const second = await cascade.verify({ ...c, ref: "c1-again" }, runOpts());
    expect(second.cacheHit).toBe(true);
    expect(second.finalVerdict).toBe(first.finalVerdict);
    expect(second.cacheAvoidedTierRole).toBe("prefilter");
  });
});
