import { describe, it, expect } from "vitest";
import { getProviderIcon, PROVIDER_ICONS, GENERIC_ICON } from "./icons.js";

describe("icons", () => {
  it("returns SVG string for openai", () => {
    const svg = getProviderIcon("openai");
    expect(svg).toContain("<svg");
    expect(svg).toContain("viewBox");
  });

  it("returns SVG string for anthropic", () => {
    const svg = getProviderIcon("anthropic");
    expect(svg).toContain("<svg");
  });

  it("returns SVG string for google", () => {
    const svg = getProviderIcon("google");
    expect(svg).toContain("<svg");
  });

  it("returns generic icon for unknown provider", () => {
    const svg = getProviderIcon("unknown");
    expect(svg).toBe(GENERIC_ICON);
    expect(svg).toContain("<svg");
  });

  it("PROVIDER_ICONS has openai, anthropic, google", () => {
    expect(PROVIDER_ICONS.openai).toBeDefined();
    expect(PROVIDER_ICONS.anthropic).toBeDefined();
    expect(PROVIDER_ICONS.google).toBeDefined();
  });

  it("GENERIC_ICON is an SVG string", () => {
    expect(GENERIC_ICON).toContain("<svg");
  });
});
