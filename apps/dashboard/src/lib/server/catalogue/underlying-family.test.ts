import { describe, it, expect } from "vitest";
import { resolveUnderlyingFamily, normaliseFamily } from "./underlying-family";

describe("normaliseFamily", () => {
  it("aliases vendor tokens to canonical families", () => {
    expect(normaliseFamily("claude")).toBe("anthropic");
    expect(normaliseFamily("gemini")).toBe("google");
    expect(normaliseFamily("deepseek-ai")).toBe("deepseek");
    expect(normaliseFamily("meta-llama")).toBe("meta");
    expect(normaliseFamily("kimi")).toBe("moonshot");
    expect(normaliseFamily("grok")).toBe("xai");
  });
  it("returns null for empty", () => {
    expect(normaliseFamily("")).toBeNull();
    expect(normaliseFamily(null)).toBeNull();
  });
});

describe("resolveUnderlyingFamily — aggregators resolve to the underlying vendor", () => {
  it("Aizolo ids encode the vendor", () => {
    expect(resolveUnderlyingFamily("aizolo-claude-claude-sonnet-4-5")).toBe("anthropic");
    expect(resolveUnderlyingFamily("aizolo-openai-gpt-5")).toBe("openai");
    expect(resolveUnderlyingFamily("aizolo-deepseek-deepseek-chat")).toBe("deepseek");
    expect(resolveUnderlyingFamily("aizolo-gemini")).toBe("google");
  });

  it("Together gateway ids map to upstream provider", () => {
    // From TOGETHER_GATEWAY_CHAT_MODELS
    expect(resolveUnderlyingFamily("claude-sonnet-4-6")).toBe("anthropic");
    expect(resolveUnderlyingFamily("together-deepseek-v3-1")).toBe("deepseek");
    expect(resolveUnderlyingFamily("together-qwen3-5-397b")).toBe("qwen");
    expect(resolveUnderlyingFamily("together-gpt-oss-120b")).toBe("openai");
  });

  it("an OpenRouter-style providerModelId prefix is the vendor", () => {
    expect(
      resolveUnderlyingFamily("some-id", { provider: "openrouter", providerModelId: "anthropic/claude-sonnet-4" }),
    ).toBe("anthropic");
  });

  it("direct providers fall back to family then provider", () => {
    expect(resolveUnderlyingFamily("x", { family: "mistral" })).toBe("mistral");
    expect(resolveUnderlyingFamily("x", { provider: "cohere" })).toBe("cohere");
  });

  it("never returns the aggregator name as a family", () => {
    // together provider, no mapping, no family → should not be "together"
    const fam = resolveUnderlyingFamily("unmapped-id", { provider: "together" });
    expect(fam).not.toBe("together");
  });
});
