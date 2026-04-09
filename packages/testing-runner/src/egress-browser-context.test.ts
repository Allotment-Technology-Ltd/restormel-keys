import { describe, expect, it } from "vitest";
import { isBrowserEgressUrlAllowed } from "./egress-browser-context.js";

describe("isBrowserEgressUrlAllowed", () => {
  const base = "https://app.example.com/";

  it("allows same-origin https subresource", () => {
    expect(isBrowserEgressUrlAllowed("https://app.example.com/static/app.js", base, undefined)).toBe(true);
  });

  it("denies third-party script without allowlist", () => {
    expect(isBrowserEgressUrlAllowed("https://evil.com/track.js", base, undefined)).toBe(false);
  });

  it("allows listed host for xhr", () => {
    expect(
      isBrowserEgressUrlAllowed("https://api.example.com/v1", base, ["api.example.com"]),
    ).toBe(true);
  });

  it("allows wss on allowed host", () => {
    expect(isBrowserEgressUrlAllowed("wss://api.example.com/socket", base, ["api.example.com"])).toBe(true);
  });

  it("allows data and blob urls (in-document)", () => {
    expect(isBrowserEgressUrlAllowed("data:text/plain,hi", base, undefined)).toBe(true);
    expect(isBrowserEgressUrlAllowed("blob:https://app.example.com/uuid", base, undefined)).toBe(true);
    expect(isBrowserEgressUrlAllowed("about:blank", base, undefined)).toBe(true);
  });

  it("denies unsupported schemes", () => {
    expect(isBrowserEgressUrlAllowed("ftp://files.example.com/a", base, undefined)).toBe(false);
  });
});
