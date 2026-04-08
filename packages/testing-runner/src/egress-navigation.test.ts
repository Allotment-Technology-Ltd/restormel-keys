import { describe, expect, it } from "vitest";
import {
  isHostnameAllowedForNavigation,
  normalizeEgressAllowHosts,
  resolveAgentNavigateUrl,
} from "./egress-navigation.js";

describe("normalizeEgressAllowHosts", () => {
  it("strips URL to hostname", () => {
    expect(normalizeEgressAllowHosts(["https://api.example.com/v1"])).toEqual(["api.example.com"]);
  });

  it("accepts bare hostnames", () => {
    expect(normalizeEgressAllowHosts(["API.EXAMPLE.COM", "cdn.test"])).toEqual(["api.example.com", "cdn.test"]);
  });
});

describe("resolveAgentNavigateUrl", () => {
  const base = "https://app.example.com/";

  it("allows same-origin path", () => {
    expect(resolveAgentNavigateUrl("/dash", base, undefined, undefined)).toBe("https://app.example.com/dash");
  });

  it("denies other origin without allowlist", () => {
    expect(resolveAgentNavigateUrl("https://evil.com/x", base, undefined, undefined)).toBeNull();
  });

  it("allows extra host when listed", () => {
    expect(
      resolveAgentNavigateUrl("https://api.example.com/health", base, undefined, ["api.example.com"]),
    ).toBe("https://api.example.com/health");
  });

  it("uses current page for relative resolution then checks allowlist", () => {
    expect(
      resolveAgentNavigateUrl("/rel", "https://api.example.com/", "https://api.example.com/v1", ["api.example.com"]),
    ).toBe("https://api.example.com/rel");
  });
});

describe("isHostnameAllowedForNavigation", () => {
  it("matches origin", () => {
    expect(
      isHostnameAllowedForNavigation(new URL("https://a.com/b"), "https://a.com/", undefined),
    ).toBe(true);
  });
});
