import { describe, expect, it } from "vitest";
import {
  verifyEnvelope,
  deriveEnvelopeStatus,
  parseMode1Result,
  makeStubValidator,
  assertValidatorIndependent,
  ValidatorIndependenceError,
  type Mode1Result,
} from "../proxy/index.js";
import type { ExtractionGenerate } from "../ingest/extract.js";

/**
 * Hermetic verify-core tests (no MCP, no keys, no network). The STUB validator serves
 * pre-baked verdicts + quotes keyed by claim text, so every fail-safe path is exercised
 * deterministically. Assertions are NOT weakened to pass — a planted unsupported claim must
 * route to review, and an error/timeout/unbound span must abstain (never "supported").
 */

const GROUNDED_CLAIM = "The Atlantic salmon returns to its natal river to spawn.";
const UNSUPPORTED_CLAIM = "The Atlantic salmon lives exclusively in freshwater its entire life.";

const SOURCE_TEXT =
  "The Atlantic salmon (Salmo salar) is a migratory fish. After years at sea, the Atlantic " +
  "salmon returns to its natal river to spawn. Juveniles spend their early life in freshwater " +
  "before migrating to the ocean.";

const GROUNDED_QUOTE = "the Atlantic salmon returns to its natal river to spawn";

function mode1(): Mode1Result {
  return {
    answer: `${GROUNDED_CLAIM} ${UNSUPPORTED_CLAIM}`,
    claims: [GROUNDED_CLAIM, UNSUPPORTED_CLAIM],
    sources: [{ id: "salmon-1", text: SOURCE_TEXT, uri: "corpus://salmon.md" }],
  };
}

describe("parseMode1Result", () => {
  it("uses explicit claims when present and pairs each with the cited sources", () => {
    const claims = parseMode1Result(mode1());
    expect(claims).toHaveLength(2);
    expect(claims[0]!.claim).toBe(GROUNDED_CLAIM);
    expect(claims[0]!.sources).toHaveLength(1);
  });

  it("falls back to the whole answer as one claim when no explicit claims", () => {
    const claims = parseMode1Result({ answer: "just the answer", sources: [] });
    expect(claims).toHaveLength(1);
    expect(claims[0]!.claim).toBe("just the answer");
  });
});

describe("deriveEnvelopeStatus (fail-safe table)", () => {
  const bound = {
    status: "bound" as const,
    span: { quote: "q", start: 0, end: 1, source_hash: "h", match: "exact" as const },
  };
  const unbound = { status: "unbound" as const, reason: "quote_not_found" as const };

  it("bound + entailed → supported", () => {
    expect(deriveEnvelopeStatus(bound, { verdict: "entailed", confidence: 0.9 })).toBe("supported");
  });
  it("bound + not_entailed → unverified", () => {
    expect(deriveEnvelopeStatus(bound, { verdict: "not_entailed", confidence: 0.9 })).toBe(
      "unverified",
    );
  });
  it("bound + abstain → abstain", () => {
    expect(deriveEnvelopeStatus(bound, { verdict: "abstain", confidence: null })).toBe("abstain");
  });
  it("bound + low-confidence entailed → abstain (never supported)", () => {
    expect(deriveEnvelopeStatus(bound, { verdict: "entailed", confidence: 0.2 })).toBe("abstain");
  });
  it("unbound + entailed → abstain (a model cannot make unbindable evidence supported)", () => {
    expect(deriveEnvelopeStatus(unbound, { verdict: "entailed", confidence: 0.99 })).toBe("abstain");
  });
});

describe("verifyEnvelope — grounded vs planted-unsupported (stub validator, no keys)", () => {
  it("grounded claim → supported with span + source_hash + verdict; planted → review", async () => {
    const validator = makeStubValidator({
      fixtureVerdicts: {
        [GROUNDED_CLAIM]: { verdict: "entailed", confidence: 0.95 },
        [UNSUPPORTED_CLAIM]: { verdict: "not_entailed", confidence: 0.9, note: "overstates source" },
      },
      fixtureQuotes: {
        [GROUNDED_CLAIM]: [GROUNDED_QUOTE],
        // No quote planted for the unsupported claim → unbound → never supported.
      },
    });

    const env = await verifyEnvelope({ result: mode1(), validator });
    const byClaim = new Map(env.claims.map((c) => [c.claim, c]));

    const grounded = byClaim.get(GROUNDED_CLAIM)!;
    expect(grounded.status).toBe("supported");
    expect(grounded.binding.status).toBe("bound");
    if (grounded.binding.status === "bound") {
      expect(grounded.binding.span.source_hash).toMatch(/^[0-9a-f]{64}$/);
      expect(grounded.binding.span.quote.length).toBeGreaterThan(0);
    }
    expect(grounded.entailment.verdict).toBe("entailed");
    expect(grounded.source_ref.source_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(grounded.source_ref.id).toBe("salmon-1");

    const planted = byClaim.get(UNSUPPORTED_CLAIM)!;
    // Planted unsupported is NEVER supported — it routes to review.
    expect(planted.status).not.toBe("supported");
    expect(["unverified", "abstain"]).toContain(planted.status);

    // Restormel-side cost is counted; legs are measured.
    expect(env.meta.restormel_cost.calls).toBeGreaterThan(0);
    expect(env.meta.legs_ms).toHaveProperty("judge_entailment");
    expect(env.meta.legs_ms).toHaveProperty("layer1_bind");
    expect(env.meta.validator_model).toBe("stub-1");
  });

  it("planted unsupported with a bound span but not_entailed → unverified (review, not passed)", async () => {
    // Plant a quote so the span binds, but the verdict is not_entailed.
    const validator = makeStubValidator({
      fixtureVerdicts: { [UNSUPPORTED_CLAIM]: { verdict: "not_entailed", confidence: 0.88 } },
      fixtureQuotes: { [UNSUPPORTED_CLAIM]: ["Juveniles spend their early life in freshwater"] },
    });
    const env = await verifyEnvelope({
      result: { answer: UNSUPPORTED_CLAIM, claims: [UNSUPPORTED_CLAIM], sources: mode1().sources },
      validator,
    });
    expect(env.claims[0]!.binding.status).toBe("bound");
    expect(env.claims[0]!.status).toBe("unverified");
  });
});

describe("verifyEnvelope — fail-safe legs never silently pass", () => {
  it("validator throws (unreachable) → abstain, never supported", async () => {
    const validator = makeStubValidator({
      fixtureVerdicts: { "*": { verdict: "entailed", confidence: 0.99 } },
      throws: true,
    });
    const env = await verifyEnvelope({ result: mode1(), validator });
    for (const c of env.claims) {
      expect(c.status).toBe("abstain");
      expect(c.status).not.toBe("supported");
    }
  });

  it("validator times out → abstain, never supported", async () => {
    // Hang every call past the timeout; the timeout surfaces as a throw → abstain.
    const hanging: ExtractionGenerate = () => new Promise<string>(() => {});
    const env = await verifyEnvelope({
      result: mode1(),
      validator: { family: "restormel-test", model: "slow-1", generate: hanging },
      validatorTimeoutMs: 20,
    });
    for (const c of env.claims) {
      expect(c.status).toBe("abstain");
    }
  });

  it("no retrievable quote → unbound span → abstain (judge never sees it)", async () => {
    // Validator entails everything, but supplies NO quote — nothing binds, so nothing passes.
    const validator = makeStubValidator({
      fixtureVerdicts: { "*": { verdict: "entailed", confidence: 0.99 } },
      fixtureQuotes: {}, // empty ⇒ retrieval returns "" ⇒ unbound.
    });
    const env = await verifyEnvelope({ result: mode1(), validator });
    for (const c of env.claims) {
      expect(c.binding.status).not.toBe("bound");
      expect(c.status).toBe("abstain");
    }
  });

  it("missing verdict for a claim → coverage-gap abstain (never a silent pass)", async () => {
    // Validator returns a quote (binds) but omits the verdict for the claim.
    const validator = makeStubValidator({
      fixtureVerdicts: {}, // no verdict for any claim ⇒ judge omits ⇒ coverage gap.
      fixtureQuotes: { [GROUNDED_CLAIM]: [GROUNDED_QUOTE] },
    });
    const env = await verifyEnvelope({
      result: { answer: GROUNDED_CLAIM, claims: [GROUNDED_CLAIM], sources: mode1().sources },
      validator,
    });
    expect(env.claims[0]!.binding.status).toBe("bound");
    expect(env.claims[0]!.status).toBe("abstain");
    expect(env.claims[0]!.entailment.verdict).toBe("abstain");
  });
});

describe("validator independence (D-c)", () => {
  it("asserts the validator family differs from the answer author", () => {
    expect(() => assertValidatorIndependent("anthropic", { family: "anthropic" })).toThrow(
      ValidatorIndependenceError,
    );
    expect(() => assertValidatorIndependent("openai", { family: "anthropic" })).not.toThrow();
    // Unknown author (null) does not block a Restormel-selected validator.
    expect(() => assertValidatorIndependent("openai", null)).not.toThrow();
  });

  it("fails CLOSED: a non-independent validator yields abstentions, never silent passes", async () => {
    // The stub would entail+bind everything; but its family MATCHES the answer author, so the
    // verify core must swap in the fail-closed validator → all claims abstain.
    const validator = makeStubValidator({
      family: "acme",
      fixtureVerdicts: { "*": { verdict: "entailed", confidence: 0.99 } },
      fixtureQuotes: { [GROUNDED_CLAIM]: [GROUNDED_QUOTE] },
    });
    const env = await verifyEnvelope({
      result: { answer: GROUNDED_CLAIM, claims: [GROUNDED_CLAIM], sources: mode1().sources },
      validator,
      author: { family: "acme", model: "acme-graph-1" },
    });
    expect(env.claims[0]!.status).toBe("abstain");
    expect(env.meta.validator_model).toContain("fail-closed");
  });
});
