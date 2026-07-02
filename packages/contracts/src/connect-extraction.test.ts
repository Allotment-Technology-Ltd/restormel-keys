import { describe, expect, it } from "vitest";
import {
  ConnectExtractionResultSchema,
  ConnectSourceLocatorSchema,
  ConnectCapabilityTierSchema,
  CONNECT_CANONICAL_OFFSET_UNIT,
} from "./connect.js";

describe("@restormel/contracts/connect — extraction-connector contract", () => {
  it("accepts a well-formed Tier-A (spatial) extraction result", () => {
    const parsed = ConnectExtractionResultSchema.safeParse({
      document: {
        source_id: "doc-1",
        version_hash_inputs: {
          canonical_text_sha256: "a".repeat(64),
          raw_file_sha256: "b".repeat(64),
          extractor_id: "paddleocr-vl",
          extractor_version: "1.5.0",
        },
        language: "en",
        page_count: 1,
        capability_tier: "spatial",
        offset_unit: "utf16",
      },
      text_units: [
        {
          text: "Verbatim clause text.",
          source_locator: { kind: "spatial", page: 0, bbox: { x0: 0.1, y0: 0.1, x1: 0.9, y1: 0.2 }, offset: 0, length: 21 },
          confidence: 0.95,
          block_type: "paragraph",
          reading_order: 0,
        },
      ],
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects a bbox coordinate outside [0,1]", () => {
    const bad = ConnectSourceLocatorSchema.safeParse({ kind: "spatial", page: 0, bbox: { x0: 0, y0: 0, x1: 1.5, y1: 1 } });
    expect(bad.success).toBe(false);
  });

  it("rejects a malformed source-version hash (must be 64 hex)", () => {
    const parsed = ConnectExtractionResultSchema.safeParse({
      document: {
        source_id: "doc-1",
        version_hash_inputs: {
          canonical_text_sha256: "not-a-hash",
          raw_file_sha256: "b".repeat(64),
          extractor_id: "x",
          extractor_version: "1",
        },
        capability_tier: "textual",
        offset_unit: "utf16",
      },
      text_units: [],
    });
    expect(parsed.success).toBe(false);
  });

  it("declares the canonical offset unit as utf16", () => {
    expect(CONNECT_CANONICAL_OFFSET_UNIT).toBe("utf16");
    expect(ConnectCapabilityTierSchema.options).toEqual(["spatial", "textual"]);
  });
});
