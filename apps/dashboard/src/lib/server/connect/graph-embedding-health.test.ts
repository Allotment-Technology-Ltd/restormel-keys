import { describe, expect, it } from "vitest";
import { deriveEmbeddingAction } from "./graph-embedding-health";

describe("deriveEmbeddingAction", () => {
  it("returns none when all units are embedded at target dimension", () => {
    expect(
      deriveEmbeddingAction({
        unembeddedCount: 0,
        mismatchedDimensionCount: 0,
        hasMixedDimensions: false,
        dominantDimension: 1024,
        targetDimensions: 1024,
        embeddedCount: 100,
      }),
    ).toEqual({ actionNeeded: false, actionReason: "none", workCount: 0 });
  });

  it("flags missing embeddings", () => {
    expect(
      deriveEmbeddingAction({
        unembeddedCount: 12,
        mismatchedDimensionCount: 0,
        hasMixedDimensions: false,
        dominantDimension: 1024,
        targetDimensions: 1024,
        embeddedCount: 88,
      }),
    ).toEqual({ actionNeeded: true, actionReason: "missing", workCount: 12 });
  });

  it("flags mixed dimensions when some vectors differ from target", () => {
    expect(
      deriveEmbeddingAction({
        unembeddedCount: 0,
        mismatchedDimensionCount: 8,
        hasMixedDimensions: true,
        dominantDimension: 1024,
        targetDimensions: 1024,
        embeddedCount: 100,
      }),
    ).toEqual({ actionNeeded: true, actionReason: "mixed", workCount: 8 });
  });

  it("combines missing and mismatched work counts", () => {
    expect(
      deriveEmbeddingAction({
        unembeddedCount: 5,
        mismatchedDimensionCount: 3,
        hasMixedDimensions: true,
        dominantDimension: 512,
        targetDimensions: 1024,
        embeddedCount: 20,
      }),
    ).toEqual({ actionNeeded: true, actionReason: "mixed", workCount: 8 });
  });
});
