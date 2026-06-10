import { describe, expect, it } from "vitest";
import { resolvePrNumber } from "./run-gate.js";

describe("resolvePrNumber", () => {
  it("prefers the explicit input", () => {
    expect(resolvePrNumber("12", { pull_request: { number: 9 } })).toBe(12);
  });

  it("falls back to pull_request.number then issue.number from the event", () => {
    expect(resolvePrNumber(undefined, { pull_request: { number: 9 } })).toBe(9);
    expect(resolvePrNumber(undefined, { issue: { number: 4 } })).toBe(4);
  });

  it("returns null outside a PR context or for junk input", () => {
    expect(resolvePrNumber(undefined, { ref: "refs/heads/main" })).toBeNull();
    expect(resolvePrNumber("abc", null)).toBeNull();
    expect(resolvePrNumber("0", null)).toBeNull();
  });
});
