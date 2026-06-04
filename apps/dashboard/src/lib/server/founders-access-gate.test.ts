import { describe, expect, it } from "vitest";
import {
  isFoundersGateExemptPath,
  requiresFoundersCircleAccess,
} from "./founders-access-gate";

describe("founders-access-gate", () => {
  it("requires approval for dashboard and admin paths", () => {
    expect(requiresFoundersCircleAccess("/keys/dashboard")).toBe(true);
    expect(requiresFoundersCircleAccess("/keys/dashboard/projects")).toBe(true);
    expect(requiresFoundersCircleAccess("/keys/admin/founders")).toBe(true);
    expect(requiresFoundersCircleAccess("/")).toBe(false);
    expect(requiresFoundersCircleAccess("/founders")).toBe(false);
  });

  it("exempts login, logout, auth callbacks, and pending page", () => {
    expect(isFoundersGateExemptPath("/keys/dashboard/login")).toBe(true);
    expect(isFoundersGateExemptPath("/keys/dashboard/logout")).toBe(true);
    expect(isFoundersGateExemptPath("/keys/dashboard/api/auth/callback")).toBe(true);
    expect(isFoundersGateExemptPath("/founders/pending")).toBe(true);
    expect(isFoundersGateExemptPath("/keys/dashboard/projects")).toBe(false);
  });
});
