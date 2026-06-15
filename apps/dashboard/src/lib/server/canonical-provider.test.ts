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
    expect(isExecutableProviderModelPair("google", "gemini-2.5-flash").ok).toBe(true);
    expect(isExecutableProviderModelPair("vertex", "gemini-2.5-flash").ok).toBe(true);
  });
});

describe("canonical-provider (xai aliases)", () => {
  it("normalizes xai and free-text aliases to canonical xai", () => {
    expect(normalizeProviderToCanonicalApi("xai")).toBe("xai");
    expect(normalizeProviderToCanonicalApi("XAI")).toBe("xai");
    expect(normalizeProviderToCanonicalApi("grok")).toBe("xai");
    expect(normalizeProviderToCanonicalApi("Grok")).toBe("xai");
    expect(normalizeProviderToCanonicalApi("x.ai")).toBe("xai");
    expect(normalizeProviderToCanonicalApi("x_ai")).toBe("xai");
  });

  it("stores xai aliases as xai", () => {
    expect(normalizeProviderForStorage("xai")).toBe("xai");
    expect(normalizeProviderForStorage("grok")).toBe("xai");
    expect(normalizeProviderForStorage("x.ai")).toBe("xai");
  });

  it("treats xai + grok model id as executable", () => {
    const r = isExecutableProviderModelPair("xai", "grok-3");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.canonicalProvider).toBe("xai");
      expect(r.modelId).toBe("grok-3");
    }
  });
});
