import { describe, expect, it } from "vitest";

/** Mirrors hooks.server.ts founders gate composition. */
function foundersGateAllowsAccess(isServiceAdmin: boolean, foundersStatus: boolean | null): boolean {
  return isServiceAdmin || foundersStatus !== false;
}

describe("founders gate approval composition", () => {
  it("allows service admins regardless of founders status", () => {
    expect(foundersGateAllowsAccess(true, false)).toBe(true);
    expect(foundersGateAllowsAccess(true, null)).toBe(true);
  });

  it("blocks only when founders status is explicitly false", () => {
    expect(foundersGateAllowsAccess(false, true)).toBe(true);
    expect(foundersGateAllowsAccess(false, false)).toBe(false);
  });

  it("does not block when founders lookup failed (null)", () => {
    expect(foundersGateAllowsAccess(false, null)).toBe(true);
  });
});
