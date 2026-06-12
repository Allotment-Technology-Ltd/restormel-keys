import { describe, expect, it } from "vitest";
import { dashboardEntryHref, dashboardLoginHref, safeDashboardRedirectPath } from "./dashboard-entry";

describe("dashboard-entry", () => {
  it("dashboardEntryHref sends signed-in users to workspace home", () => {
    expect(dashboardEntryHref({ uid: "u1" })).toBe("/keys/dashboard/home");
    expect(dashboardEntryHref(null)).toBe("/keys/dashboard/login");
    expect(dashboardEntryHref(undefined)).toBe("/keys/dashboard/login");
  });

  it("safeDashboardRedirectPath allows dashboard paths only", () => {
    expect(safeDashboardRedirectPath("/keys/dashboard/claims")).toBe("/keys/dashboard/claims");
    expect(safeDashboardRedirectPath("/keys/dashboard/login")).toBe("/keys/dashboard/home");
    expect(safeDashboardRedirectPath("https://evil.example/phish")).toBe("/keys/dashboard/home");
    expect(safeDashboardRedirectPath("//evil.example/phish")).toBe("/keys/dashboard/home");
    expect(safeDashboardRedirectPath(null)).toBe("/keys/dashboard/home");
  });

  it("dashboardLoginHref is stable", () => {
    expect(dashboardLoginHref()).toBe("/keys/dashboard/login");
  });
});
