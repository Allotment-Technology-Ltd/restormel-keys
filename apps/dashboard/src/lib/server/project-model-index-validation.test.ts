/**
 * Unit tests for registry vs execution validation (no DB).
 */
import { describe, it, expect } from "vitest";
import {
  REGISTRY_MODEL_ID_MAX_LEN,
  REGISTRY_PROVIDER_MAX_LEN,
  validateRegistryBinding,
} from "$lib/server/project-model-index-validation";

describe("validateRegistryBinding", () => {
  it("accepts arbitrary provider and model id", () => {
    const r = validateRegistryBinding("DeepSeek", "deepseek-embed-foo");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.providerType).toBe("deepseek");
      expect(r.modelId).toBe("deepseek-embed-foo");
    }
  });

  it("rejects empty provider or modelId", () => {
    expect(validateRegistryBinding("", "m").ok).toBe(false);
    expect(validateRegistryBinding("x", "").ok).toBe(false);
  });

  it("rejects provider longer than max", () => {
    const r = validateRegistryBinding("a".repeat(REGISTRY_PROVIDER_MAX_LEN + 1), "m");
    expect(r.ok).toBe(false);
  });

  it("rejects modelId longer than max", () => {
    const r = validateRegistryBinding("p", "m".repeat(REGISTRY_MODEL_ID_MAX_LEN + 1));
    expect(r.ok).toBe(false);
  });

  it("rejects control characters", () => {
    expect(validateRegistryBinding("a\u0001b", "m").ok).toBe(false);
    expect(validateRegistryBinding("a", "m\x00x").ok).toBe(false);
  });
});
