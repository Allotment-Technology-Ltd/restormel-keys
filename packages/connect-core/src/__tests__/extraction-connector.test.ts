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
  it("runs default and alternative through the identical extract() contract", async () => {
    const delta = await runSwapTest({ default: paddle, alternative: mistral, source: fixtureAsBinary(legal) });
    expect(delta.identicalContract).toBe(true);
    // Both are Tier A on this fixture.
    expect(delta.default_.emittedTier).toBe("spatial");
    expect(delta.alternative.emittedTier).toBe("spatial");
    // Same underlying content → very high token overlap despite different engines.
    expect(delta.canonicalTokenOverlap).toBeGreaterThan(0.9);
    // Span anchoring holds for both.
    expect(delta.default_.spanAnchorRate).toBe(1);
    expect(delta.alternative.spanAnchorRate).toBe(1);
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
      expect(r.summary.fidelityPassRate).toBe(1);
      expect(r.summary.meanSpanAnchorRate).toBe(1);
      expect(r.summary.note).toContain("INDICATIVE");
    }
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
