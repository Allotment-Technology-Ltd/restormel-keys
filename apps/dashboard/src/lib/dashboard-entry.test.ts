import { describe, expect, it } from "vitest";
import { dashboardEntryHref, dashboardLoginHref, safeDashboardRedirectPath } from "./dashboard-entry";

describe("dashboard-entry", () => {
  // Phase 3 Stage 1: the workspace landing is the verified Answer Console.
  const HOME = "/keys/dashboard/prove/proof";

  it("dashboardEntryHref sends signed-in users to the Answer Console", () => {
    expect(dashboardEntryHref({ uid: "u1" })).toBe(HOME);
    expect(dashboardEntryHref(null)).toBe("/keys/dashboard/login");
    expect(dashboardEntryHref(undefined)).toBe("/keys/dashboard/login");
  });

  it("safeDashboardRedirectPath allows dashboard paths only", () => {
    expect(safeDashboardRedirectPath("/keys/dashboard/claims")).toBe("/keys/dashboard/claims");
    expect(safeDashboardRedirectPath("/keys/dashboard/login")).toBe(HOME);
    expect(safeDashboardRedirectPath("https://evil.example/phish")).toBe(HOME);
    expect(safeDashboardRedirectPath("//evil.example/phish")).toBe(HOME);
    expect(safeDashboardRedirectPath(null)).toBe(HOME);
  });

  it("dashboardLoginHref is stable", () => {
    expect(dashboardLoginHref()).toBe("/keys/dashboard/login");
  });
});
