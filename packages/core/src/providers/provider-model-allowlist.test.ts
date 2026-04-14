import { describe, expect, it } from "vitest";
import { buildDefaultProviderModelAllowlist, isProviderModelInDefaultAllowlist } from "./provider-model-allowlist.js";

describe("provider-model-allowlist", () => {
  it("includes known OpenAI and Anthropic models", () => {
    const m = buildDefaultProviderModelAllowlist();
    expect(isProviderModelInDefaultAllowlist("openai", "gpt-4o", m)).toBe(true);
    expect(isProviderModelInDefaultAllowlist("anthropic", "claude-sonnet-4", m)).toBe(true);
    expect(isProviderModelInDefaultAllowlist("google", "gemini-3.1-pro-preview", m)).toBe(true);
    expect(isProviderModelInDefaultAllowlist("google", "gemini-3-flash-preview", m)).toBe(true);
  });

  it("excludes removed legacy models", () => {
    const m = buildDefaultProviderModelAllowlist();
    expect(isProviderModelInDefaultAllowlist("openai", "gpt-3.5-turbo", m)).toBe(false);
    expect(isProviderModelInDefaultAllowlist("anthropic", "claude-3-haiku-20240307", m)).toBe(false);
    expect(isProviderModelInDefaultAllowlist("google", "gemini-1.0-pro", m)).toBe(false);
    expect(isProviderModelInDefaultAllowlist("google", "gemini-1.5-flash", m)).toBe(false);
    expect(isProviderModelInDefaultAllowlist("anthropic", "claude-3-5-haiku-20241022", m)).toBe(false);
  });

  it("returns false for unknown providers", () => {
    expect(isProviderModelInDefaultAllowlist("unknown-vendor", "x", buildDefaultProviderModelAllowlist())).toBe(false);
  });
});
