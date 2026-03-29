/**
 * Nav config: canonical IA and topbar title.
 */
import { describe, it, expect } from "vitest";
import { NAV_GROUPS, OVERVIEW_ITEM, topbarTitle } from "./nav-config";
import { DASHBOARD_BASE } from "$lib/dashboard-base";

describe("sidebar nav", () => {
  it("keeps overview outside grouped sections", () => {
    expect(OVERVIEW_ITEM.label).toBe("Overview");
  });

  it("contains expected grouped labels", () => {
    const labels = NAV_GROUPS.flatMap((group) => group.items.map((item) => item.label));
    expect(labels).toContain("Connections");
    expect(labels).toContain("Rules");
    expect(labels).toContain("Guard Rails");
    expect(labels).toContain("Model Catalog");
    expect(labels).toContain("Usage & Analytics");
    expect(labels).toContain("Logs");
    expect(labels).toContain("System Health");
    expect(labels).toContain("API Keys");
    expect(labels).toContain("Test & Preview");
    expect(labels).toContain("GitHub Setup");
    expect(labels).toContain("Dev Tools");
  });
});

describe("topbarTitle", () => {
  it("returns Overview for root path", () => {
    expect(topbarTitle(DASHBOARD_BASE + "/")).toBe("Overview");
  });

  it("returns Projects for /projects", () => {
    expect(topbarTitle(DASHBOARD_BASE + "/projects")).toBe("Projects");
  });

  it("returns Profile for /settings", () => {
    expect(topbarTitle(DASHBOARD_BASE + "/settings")).toBe("Profile");
  });

  it("returns Project for project detail path", () => {
    expect(topbarTitle(DASHBOARD_BASE + "/projects/abc-123")).toBe("Project");
  });

  it("returns empty string for unknown path", () => {
    expect(topbarTitle(DASHBOARD_BASE + "/unknown")).toBe("");
  });
});
