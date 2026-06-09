import { describe, expect, it } from "vitest";
import {
  bindEvidenceSpan,
  bindUnitsEvidence,
  contentHash,
  verifyEvidenceSpan,
  type EvidenceSpan,
} from "../ingest/evidence-binding.js";
import { deriveLayer1State } from "../ingest/verification-state.js";
import { parseExtractionResponse } from "../ingest/extract.js";

const SOURCE =
  "Bentham introduced a felicific calculus: a method for estimating the value of a pleasure " +
  "or pain by dimensions such as intensity, duration, certainty, and extent. " +
  "Mill distinguished higher pleasures — those of the intellect — from lower, bodily pleasures. " +
  "Every person's happiness counts equally in the aggregate.";

const HASH = "test-hash-aaaa";

describe("bindEvidenceSpan", () => {
  it("binds an exact quote with correct offsets", () => {
    const quote = "Every person's happiness counts equally in the aggregate.";
    const b = bindEvidenceSpan({ quote, sourceText: SOURCE, sourceHash: HASH });
    expect(b.status).toBe("bound");
    if (b.status !== "bound") return;
    expect(b.span.match).toBe("exact");
    expect(SOURCE.slice(b.span.start, b.span.end)).toBe(quote);
  });

  it("binds across whitespace and unicode quote/dash differences as 'normalized'", () => {
    const quote = 'Mill  distinguished higher pleasures - those of the intellect - from lower,   bodily pleasures.';
    const b = bindEvidenceSpan({ quote, sourceText: SOURCE, sourceHash: HASH });
    expect(b.status).toBe("bound");
    if (b.status !== "bound") return;
    expect(b.span.match).toBe("normalized");
    // Offsets refer to the ORIGINAL text and cover the em-dash sentence.
    expect(SOURCE.slice(b.span.start, b.span.end)).toContain("Mill distinguished higher pleasures");
  });

  it("falls back to a bounded fuzzy sentence window for light paraphrase", () => {
    const quote =
      "Bentham introduced the felicific calculus, a method of estimating the value of pleasures and pains by intensity, duration, certainty and extent";
    const b = bindEvidenceSpan({ quote, sourceText: SOURCE, sourceHash: HASH });
    expect(b.status).toBe("bound");
    if (b.status !== "bound") return;
    expect(b.span.match).toBe("fuzzy");
    expect(SOURCE.slice(b.span.start, b.span.end)).toContain("felicific calculus");
  });

  it("misattribution: a quote from a different source does NOT bind to the cited one", () => {
    const otherSourceQuote = "An action has moral worth when it is done from duty rather than from inclination.";
    const b = bindEvidenceSpan({ quote: otherSourceQuote, sourceText: SOURCE, sourceHash: HASH });
    expect(b).toEqual({ status: "unbound", reason: "quote_not_found" });
  });

  it("missing evidence is its own status, distinct from unbound", () => {
    expect(bindEvidenceSpan({ quote: "  ", sourceText: SOURCE, sourceHash: HASH })).toEqual({
      status: "no_evidence",
      reason: "extractor_returned_no_quote",
    });
  });

  it("repeated quotes bind deterministically to the first occurrence", () => {
    const src = "alpha beta gamma. alpha beta gamma.";
    const b = bindEvidenceSpan({ quote: "alpha beta gamma.", sourceText: src, sourceHash: HASH });
    expect(b.status).toBe("bound");
    if (b.status !== "bound") return;
    expect(b.span.start).toBe(0);
  });
});

describe("verifyEvidenceSpan (the deterministic re-check)", () => {
  const bound = bindEvidenceSpan({
    quote: "Every person's happiness counts equally in the aggregate.",
    sourceText: SOURCE,
    sourceHash: HASH,
  });
  const span = (bound as { status: "bound"; span: EvidenceSpan }).span;

  it("re-passes against the unchanged source version", () => {
    expect(verifyEvidenceSpan({ span, sourceText: SOURCE, sourceHash: HASH })).toEqual({
      ok: true,
      match: "exact",
    });
  });

  it("fails closed on hash mismatch (source version changed)", () => {
    expect(verifyEvidenceSpan({ span, sourceText: SOURCE, sourceHash: "other" })).toEqual({
      ok: false,
      reason: "hash_mismatch",
    });
  });

  it("fails closed when the text at the offsets changed", () => {
    const tampered = SOURCE.replace("counts equally", "counts unequally");
    expect(verifyEvidenceSpan({ span, sourceText: tampered, sourceHash: HASH })).toEqual({
      ok: false,
      reason: "text_changed",
    });
  });

  it("fails closed on out-of-range offsets", () => {
    const broken = { ...span, end: SOURCE.length + 50 };
    expect(verifyEvidenceSpan({ span: broken, sourceText: SOURCE, sourceHash: HASH })).toEqual({
      ok: false,
      reason: "offsets_out_of_range",
    });
  });
});

describe("contentHash", () => {
  it("is stable for identical text and differs on any change", async () => {
    const a1 = await contentHash(SOURCE);
    const a2 = await contentHash(SOURCE);
    const b = await contentHash(SOURCE + " ");
    expect(a1).toBe(a2);
    expect(a1).toMatch(/^[0-9a-f]{64}$/);
    expect(b).not.toBe(a1);
  });
});

describe("extraction evidence plumbing", () => {
  it("parseExtractionResponse keeps the evidence quote (no longer decorative)", () => {
    const parsed = parseExtractionResponse(
      '{"units":[{"id":"u1","text":"Claim.","evidence":"Every person\'s happiness counts equally in the aggregate."}],"relations":[]}',
    );
    expect(parsed.units[0].evidence).toBe(
      "Every person's happiness counts equally in the aggregate.",
    );
  });

  it("bindUnitsEvidence binds per unit and flags missing quotes", () => {
    const out = bindUnitsEvidence({
      units: [
        { id: "u1", evidence: "Every person's happiness counts equally in the aggregate." },
        { id: "u2", evidence: "Quote that exists nowhere in this source." },
        { id: "u3" },
      ],
      sourceText: SOURCE,
      sourceHash: HASH,
    });
    expect(out[0].binding.status).toBe("bound");
    expect(out[1].binding.status).toBe("unbound");
    expect(out[2].binding.status).toBe("no_evidence");
  });
});

describe("deriveLayer1State (interim mapping until Layer 2)", () => {
  const bound = bindEvidenceSpan({
    quote: "Every person's happiness counts equally in the aggregate.",
    sourceText: SOURCE,
    sourceHash: HASH,
  });
  const unbound = bindEvidenceSpan({ quote: "not in source", sourceText: SOURCE, sourceHash: HASH });

  it("bound + ok → supported; unbound + ok → inferred (never supported without a span)", () => {
    expect(deriveLayer1State({ binding: bound, legacyVerdict: "ok" })).toBe("supported");
    expect(deriveLayer1State({ binding: unbound, legacyVerdict: "ok" })).toBe("inferred");
  });

  it("weak / unsupported / omitted → unverified (review), regardless of binding", () => {
    expect(deriveLayer1State({ binding: bound, legacyVerdict: "weak" })).toBe("unverified");
    expect(deriveLayer1State({ binding: bound, legacyVerdict: "unsupported" })).toBe("unverified");
    expect(deriveLayer1State({ binding: unbound, legacyVerdict: "omitted" })).toBe("unverified");
  });
});
