import { describe, it, expect } from "vitest";
import {
  normalizeProviderToCanonicalApi,
  normalizeProviderForStorage,
  isExecutableProviderModelPair,
} from "./canonical-provider";

describe("canonical-provider (voyage + vertex)", () => {
  it("normalizes voyage to canonical voyage", () => {
    expect(normalizeProviderToCanonicalApi("voyage")).toBe("voyage");
    expect(normalizeProviderToCanonicalApi("VOYAGE")).toBe("voyage");
  });

  it("stores voyage as voyage and google aliases as google", () => {
    expect(normalizeProviderForStorage("voyage")).toBe("voyage");
    expect(normalizeProviderForStorage("vertex")).toBe("google");
    expect(normalizeProviderForStorage("google")).toBe("google");
  });

  it("treats voyage + model id as executable", () => {
    const r = isExecutableProviderModelPair("voyage", "voyage-3");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.canonicalProvider).toBe("voyage");
      expect(r.modelId).toBe("voyage-3");
    }
  });

  it("vertex/google remain executable with model", () => {
    expect(isExecutableProviderModelPair("google", "gemini-1.5-flash").ok).toBe(true);
    expect(isExecutableProviderModelPair("vertex", "gemini-1.5-flash").ok).toBe(true);
  });
});
