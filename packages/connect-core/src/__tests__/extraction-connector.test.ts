import { describe, expect, it } from "vitest";
import { ConnectExtractionResultSchema } from "@restormel/contracts/connect";
import {
  ExtractionError,
  deriveCapabilityTier,
  assertProvenanceRoundTrip,
  reresolveLocator,
  buildCanonicalText,
  computeVersionHashInputs,
  sourceVersionHash,
  textualFallbackExtractionConnector,
  createPaddleOcrVlConnector,
  createMistralOcrConnector,
  selectExtractionConnector,
  EXTRACTION_CONNECTOR_KEYS,
  runConformance,
  runSwapTest,
  runIndicativeValidation,
  type ExtractionConnector,
} from "../index.js";
import {
  EXTRACTION_FIXTURES,
  fixtureAsText,
  fixtureAsBinary,
  fixtureMustContain,
  makePaddleOcrVlFixtureTransport,
  makeMistralOcrFixtureTransport,
} from "../ingest/extraction-fixtures/index.js";

const legal = EXTRACTION_FIXTURES[0];
const paddle = createPaddleOcrVlConnector(makePaddleOcrVlFixtureTransport(legal));
const mistral = createMistralOcrConnector(makeMistralOcrFixtureTransport(legal));

describe("extraction contract — shape and verbatim provenance", () => {
  it("PaddleOCR-VL output parses against the Zod contract", async () => {
    const result = await paddle.extract(fixtureAsBinary(legal));
    expect(ConnectExtractionResultSchema.safeParse(result).success).toBe(true);
    expect(result.document.source_id).toBe("fixture-legal-001");
    expect(result.document.offset_unit).toBe("utf16");
  });

  it("stores text VERBATIM — no reshaping (curly quotes survive)", async () => {
    const result = await paddle.extract(fixtureAsBinary(legal));
    const joined = result.text_units.map((u) => u.text).join("\n");
    expect(joined).toContain("the “Agreement”"); // curly quotes untouched
  });

  it("every unit's locator re-resolves byte-identically to its stored text", async () => {
    const result = await paddle.extract(fixtureAsBinary(legal));
    const rt = assertProvenanceRoundTrip(result);
    expect(rt.ok).toBe(true);
    expect(rt.failures).toEqual([]);
    expect(rt.resolved).toBe(result.text_units.length);
  });

  it("reresolveLocator flags a corrupted offset (self-checking fallback)", async () => {
    const result = await paddle.extract(fixtureAsBinary(legal));
    const canonical = buildCanonicalText(result.text_units);
    const unit = result.text_units[1];
    const broken = { ...unit, source_locator: { kind: "textual" as const, offset: 999999, length: 10 } };
    expect(reresolveLocator(canonical, broken).ok).toBe(false);
  });
});

describe("provenance tier — mechanical, never inflated", () => {
  it("all-spatial locators derive Tier A", () => {
    expect(deriveCapabilityTier([{ kind: "spatial" }, { kind: "spatial" }])).toBe("spatial");
  });
  it("one textual locator downgrades the document to Tier B", () => {
    expect(deriveCapabilityTier([{ kind: "spatial" }, { kind: "textual" }])).toBe("textual");
  });
  it("PaddleOCR-VL emits Tier A; textual fallback emits Tier B", async () => {
    const a = await paddle.extract(fixtureAsBinary(legal));
    const b = await textualFallbackExtractionConnector.extract(fixtureAsText(legal));
    expect(a.document.capability_tier).toBe("spatial");
    expect(b.document.capability_tier).toBe("textual");
  });
});

describe("version hashing — swap invalidation by construction", () => {
  it("changing the extractor id/version changes the source-version hash", async () => {
    const canonicalText = "hello world";
    const rawBytes = new TextEncoder().encode("raw");
    const a = await computeVersionHashInputs({ canonicalText, rawBytes, extractorId: "paddleocr-vl", extractorVersion: "1.5.0" });
    const b = await computeVersionHashInputs({ canonicalText, rawBytes, extractorId: "mistral-ocr", extractorVersion: "ocr-4" });
    expect(a.canonical_text_sha256).toBe(b.canonical_text_sha256); // same text
    expect(await sourceVersionHash(a)).not.toBe(await sourceVersionHash(b)); // extractor differs → miss
  });
});

describe("named-error taxonomy — never a fabricated empty success", () => {
  it("empty bytes throw ExtractionError, not an empty result", async () => {
    await expect(paddle.extract({ ...fixtureAsBinary(legal), bytes: new Uint8Array(0) })).rejects.toBeInstanceOf(
      ExtractionError,
    );
  });
  it("textual fallback rejects a binary mime with unsupported_mime", async () => {
    await expect(
      textualFallbackExtractionConnector.extract({ sourceId: "x", bytes: new Uint8Array([1, 2, 3]), mime: "application/pdf", name: "x.pdf" }),
    ).rejects.toMatchObject({ code: "unsupported_mime" });
  });
  it("a transport failure surfaces as transport_failed, never a pass", async () => {
    const flaky = createPaddleOcrVlConnector(async () => {
      throw new Error("connection refused");
    });
    await expect(flaky.extract(fixtureAsBinary(legal))).rejects.toMatchObject({ code: "transport_failed" });
  });
});

describe("composition-root selection — one config key, fail closed", () => {
  it("selects the textual fallback with no transport", () => {
    const c = selectExtractionConnector(EXTRACTION_CONNECTOR_KEYS.textualFallback);
    expect(c.id).toBe("textual-fallback");
  });
  it("selects PaddleOCR-VL when its transport is supplied", () => {
    const c = selectExtractionConnector(EXTRACTION_CONNECTOR_KEYS.default, {
      paddleOcrVl: makePaddleOcrVlFixtureTransport(legal),
    });
    expect(c.id).toBe("paddleocr-vl");
  });
  it("fails closed when a network adapter is selected without its transport", () => {
    expect(() => selectExtractionConnector(EXTRACTION_CONNECTOR_KEYS.default)).toThrow(ExtractionError);
  });
  it("fails closed on an unknown key (never a silent default)", () => {
    expect(() => selectExtractionConnector("unknown:model")).toThrow(ExtractionError);
  });
});

describe("shared conformance suite — every registered adapter", () => {
  const cases: Array<{ name: string; connector: ExtractionConnector; sample: ReturnType<typeof fixtureAsBinary> }> = [
    { name: "paddleocr-vl", connector: paddle, sample: fixtureAsBinary(legal) },
    { name: "mistral-ocr", connector: mistral, sample: fixtureAsBinary(legal) },
    { name: "textual-fallback", connector: textualFallbackExtractionConnector, sample: fixtureAsText(legal) },
  ];
  for (const c of cases) {
    it(`${c.name} passes the contract conformance suite`, async () => {
      const f = await runConformance({ connector: c.connector, sample: c.sample });
      expect(f.errors).toEqual([]);
      expect(f.schemaOk).toBe(true);
      expect(f.roundTripOk).toBe(true);
      expect(f.tierConsistent).toBe(true);
      expect(f.emptyThrows).toBe(true);
      expect(f.deterministic).toBe(true);
    });
  }
});

describe("swap test — provable, identical contract, documented deltas (Scope §4)", () => {
  it("runs default and alternative through the identical extract() contract — ALL THREE doc types", async () => {
    // Scope §4 says "the same indicative corpus" — exercise legal AND pharma AND finance,
    // not just legal (each fixture carries its own transport double).
    for (const fx of EXTRACTION_FIXTURES) {
      const delta = await runSwapTest({
        default: createPaddleOcrVlConnector(makePaddleOcrVlFixtureTransport(fx)),
        alternative: createMistralOcrConnector(makeMistralOcrFixtureTransport(fx)),
        source: fixtureAsBinary(fx),
        claims: fixtureMustContain(fx),
      });
      expect(delta.identicalContract).toBe(true);
      // Both are Tier A on every fixture.
      expect(delta.default_.emittedTier).toBe("spatial");
      expect(delta.alternative.emittedTier).toBe("spatial");
      // Same underlying content → very high token overlap despite different engines.
      expect(delta.canonicalTokenOverlap).toBeGreaterThan(0.9);
      // Span anchoring holds for both.
      expect(delta.default_.spanAnchorRate).toBe(1);
      expect(delta.alternative.spanAnchorRate).toBe(1);
      // Verification-outcome half (§4c, model-free): every claim binds to a byte-identical
      // span in BOTH connectors, so a verifier sees no binding-driven abstention delta.
      expect(delta.claimBindingDeltas.length).toBe(fixtureMustContain(fx).length);
      expect(delta.claimBindingDeltas.every((d) => d.boundInDefault && d.boundInAlternative)).toBe(true);
      expect(delta.claimBindingDeltas.some((d) => d.bindingDiffers)).toBe(false);
    }
  });

  it("surfaces a verification-outcome delta when a claim binds in one connector but not the other", async () => {
    // A claim present in the source but NOT emitted by the alternative would make a
    // verifier abstain on the alternative for want of bound evidence — a real, model-free
    // verification-outcome delta the swap test must surface (Scope §4c).
    const delta = await runSwapTest({
      default: paddle,
      alternative: {
        id: "sparse-double" as ExtractionConnector["id"],
        version: "test",
        declaredTier: "spatial",
        // Drops the liability clause: the claim will not bind in the alternative.
        extract: async () => {
          const full = await paddle.extract(fixtureAsBinary(legal));
          return { ...full, text_units: full.text_units.filter((u) => !u.text.includes("LIMITATION OF LIABILITY")) };
        },
      },
      source: fixtureAsBinary(legal),
      claims: ["1. LIMITATION OF LIABILITY. In no event shall either party's aggregate liability exceed the fees paid in the twelve (12) months preceding the claim."],
    });
    const liability = delta.claimBindingDeltas[0];
    expect(liability.boundInDefault).toBe(true);
    expect(liability.boundInAlternative).toBe(false);
    expect(liability.bindingDiffers).toBe(true);
  });

  it("degradation swap (Tier A → Tier B) is honestly labelled", async () => {
    const delta = await runSwapTest({
      default: paddle,
      alternative: {
        // wrap the textual fallback to consume the same binary source id via text bytes
        id: textualFallbackExtractionConnector.id,
        version: textualFallbackExtractionConnector.version,
        declaredTier: textualFallbackExtractionConnector.declaredTier,
        extract: () => textualFallbackExtractionConnector.extract(fixtureAsText(legal)),
      },
      source: fixtureAsBinary(legal),
    });
    expect(delta.tierChanged).toBe(true);
    expect(delta.alternative.emittedTier).toBe("textual");
  });
});

describe("indicative validation harness — INDICATIVE, fixture-backed", () => {
  it("reports fidelity, span-anchoring, tier distribution across the corpus", async () => {
    const corpus = EXTRACTION_FIXTURES.map((f) => ({
      docType: f.docType,
      source: fixtureAsBinary(f),
      mustContain: fixtureMustContain(f),
    }));
    // Rebuild a paddle connector per fixture (each has its own transport double).
    const reports = await Promise.all(
      EXTRACTION_FIXTURES.map((f) =>
        runIndicativeValidation({
          connector: createPaddleOcrVlConnector(makePaddleOcrVlFixtureTransport(f)),
          corpus: [{ docType: f.docType, source: fixtureAsBinary(f), mustContain: fixtureMustContain(f) }],
          execution: "fixture",
        }),
      ),
    );
    for (const r of reports) {
      expect(r.execution).toBe("fixture");
      // fidelityPassRate === 1 is CIRCULAR under fixtures (mustContain is drawn from the
      // doubles' own blocks — see fixtureMustContain doc). It proves the mapping/round-trip
      // plumbing, not live OCR fidelity; the real number is the step-2 private-eval harness.
      expect(r.summary.fidelityPassRate).toBe(1);
      expect(r.summary.meanSpanAnchorRate).toBe(1);
      expect(r.summary.note).toContain("INDICATIVE");
      // Throughput IS measured (Scope §5) — a positive pages/sec, honestly stamped fixture.
      expect(r.summary.indicativePagesPerSec).not.toBeNull();
      expect(r.summary.indicativePagesPerSec as number).toBeGreaterThan(0);
      expect(r.items[0].extractMs).toBeGreaterThanOrEqual(0);
      expect(r.items[0].pageCount).toBeGreaterThan(0);
      // Per-page cost is NULL under fixtures — the honest state (no vendor price in a
      // double; connect-core is credential-free), NOT a silent omission (§8).
      expect(r.summary.meanPerPageCostUsd).toBeNull();
      expect(r.items[0].perPageCostUsd).toBeNull();
    }
    // A live run supplies per-page cost via the host-app hook (from provider usage/pricing —
    // never a client estimate). Prove the field populates when the hook is present.
    const costed = await runIndicativeValidation({
      connector: createPaddleOcrVlConnector(makePaddleOcrVlFixtureTransport(legal)),
      corpus: [{ docType: "legal", source: fixtureAsBinary(legal), mustContain: [] }],
      execution: "live",
      perPageCostUsd: () => 0.001,
    });
    expect(costed.summary.meanPerPageCostUsd).toBe(0.001);
    expect(costed.items[0].perPageCostUsd).toBe(0.001);
    // Confidence-as-abstention: the legal footnote (0.72) is above 0.6, so 0 low-confidence;
    // lower the threshold and it should be flagged.
    const strict = await runIndicativeValidation({
      connector: createPaddleOcrVlConnector(makePaddleOcrVlFixtureTransport(legal)),
      corpus: [{ docType: "legal", source: fixtureAsBinary(legal), mustContain: [] }],
      execution: "fixture",
      abstentionThreshold: 0.8,
    });
    expect(strict.items[0].lowConfidenceUnits).toBeGreaterThan(0);
  });
});
