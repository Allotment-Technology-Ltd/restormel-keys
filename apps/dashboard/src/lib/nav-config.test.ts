/**
 * Nav config: canonical IA and topbar title.
 */
import { describe, it, expect } from "vitest";
import { NAV_ITEMS, topbarTitle } from "./nav-config";
import { DASHBOARD_BASE } from "$lib/dashboard-base";

describe("NAV_ITEMS", () => {
  it("includes all canonical sections in order", () => {
    const labels = NAV_ITEMS.map((item) => item.label);
    expect(labels).toContain("Overview");
    expect(labels).toContain("Projects");
    expect(labels).toContain("Access");
    expect(labels).toContain("Provider Integrations");
    expect(labels).toContain("Models");
    expect(labels).toContain("Routes");
    expect(labels).toContain("Policies");
    expect(labels).toContain("Analytics");
    expect(labels).toContain("Logs & Traces");
    expect(labels).toContain("Lifecycle & Migrations");
    expect(labels).toContain("Billing & Forecasting");
    expect(labels).toContain("Documentation");
    expect(labels).toContain("Settings");
  });

  it("Overview is first", () => {
    expect(NAV_ITEMS[0].label).toBe("Overview");
  });

  it("Documentation is marked external", () => {
    const doc = NAV_ITEMS.find((item) => item.label === "Documentation");
    expect(doc?.external).toBe(true);
  });
});

describe("topbarTitle", () => {
  it("returns Overview for root path", () => {
    expect(topbarTitle(DASHBOARD_BASE + "/")).toBe("Overview");
  });

  it("returns Projects for /projects", () => {
    expect(topbarTitle(DASHBOARD_BASE + "/projects")).toBe("Projects");
  });

  it("returns Project for project detail path", () => {
    expect(topbarTitle(base + "/projects/abc-123")).toBe("Project");
  });

  it("returns empty string for unknown path", () => {
    expect(topbarTitle(base + "/unknown")).toBe("");
  });
});
