import { describe, expect, it } from "vitest";
import { dashboardEntryHref, dashboardLoginHref, safeDashboardRedirectPath } from "./dashboard-entry";

describe("dashboard-entry", () => {
  it("dashboardEntryHref sends signed-in users to workspace home", () => {
    expect(dashboardEntryHref({ uid: "u1" })).toBe("/keys/dashboard/activity");
    expect(dashboardEntryHref(null)).toBe("/keys/dashboard/login");
    expect(dashboardEntryHref(undefined)).toBe("/keys/dashboard/login");
  });

  it("safeDashboardRedirectPath allows dashboard paths only", () => {
    expect(safeDashboardRedirectPath("/keys/dashboard/connect")).toBe("/keys/dashboard/connect");
    expect(safeDashboardRedirectPath("/keys/dashboard/login")).toBe("/keys/dashboard/activity");
    expect(safeDashboardRedirectPath("https://evil.example/phish")).toBe("/keys/dashboard/activity");
    expect(safeDashboardRedirectPath("//evil.example/phish")).toBe("/keys/dashboard/activity");
    expect(safeDashboardRedirectPath(null)).toBe("/keys/dashboard/activity");
  });

  it("dashboardLoginHref is stable", () => {
    expect(dashboardLoginHref()).toBe("/keys/dashboard/login");
  });
});
