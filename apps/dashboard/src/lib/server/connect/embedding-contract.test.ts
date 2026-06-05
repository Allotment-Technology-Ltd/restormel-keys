import { describe, expect, it } from "vitest";
import {
  assertEmbeddingDimensionsAllowed,
  modelSupportsDimensions,
  pickEmbeddingModelForDimensions,
} from "./embedding-contract";

describe("embedding-contract", () => {
  it("prefers voyage when connected for 1024d", () => {
    const pick = pickEmbeddingModelForDimensions({
      providerTypes: new Set(["openai", "voyage"]),
      dimensions: 1024,
    });
    expect(pick?.provider).toBe("voyage");
    expect(pick?.modelId).toBe("voyage-3");
  });

  it("blocks pack dimension change when graph is locked", () => {
    const result = assertEmbeddingDimensionsAllowed({
      requestedDimensions: 512,
      lock: { dimensions: 1024, embeddedUnitCount: 5 },
    });
    expect(result.ok).toBe(false);
  });

  it("knows voyage-3 supports matryoshka dimensions", () => {
    expect(modelSupportsDimensions("voyage-3", 512)).toBe(true);
    expect(modelSupportsDimensions("voyage-3", 9999)).toBe(false);
  });
});
