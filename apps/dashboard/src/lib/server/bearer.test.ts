/**
 * Auth behaviour: Bearer token extraction. No raw keys in tests.
 */
import { describe, it, expect } from "vitest";
import { getBearerToken } from "./bearer";

describe("getBearerToken", () => {
  it("returns null when Authorization header is missing", () => {
    const req = new Request("https://example.com", { headers: {} });
    expect(getBearerToken(req)).toBeNull();
  });

  it("returns null when Authorization is not Bearer", () => {
    const req = new Request("https://example.com", {
      headers: { Authorization: "Basic dXNlcjpwYXNz" },
    });
    expect(getBearerToken(req)).toBeNull();
  });

  it("returns null when Bearer value is empty", () => {
    const req = new Request("https://example.com", {
      headers: { Authorization: "Bearer " },
    });
    expect(getBearerToken(req)).toBeNull();
  });

  it("returns null when Bearer value is only whitespace", () => {
    const req = new Request("https://example.com", {
      headers: { Authorization: "Bearer   " },
    });
    expect(getBearerToken(req)).toBeNull();
  });

  it("returns token after Bearer prefix", () => {
    const req = new Request("https://example.com", {
      headers: { Authorization: "Bearer rk_abc123" },
    });
    expect(getBearerToken(req)).toBe("rk_abc123");
  });

  it("trims leading/trailing whitespace from token", () => {
    const req = new Request("https://example.com", {
      headers: { Authorization: "Bearer  rk_xyz  " },
    });
    expect(getBearerToken(req)).toBe("rk_xyz");
  });
});
