/**
 * Nav config: scope-first workspace IA and topbar title.
 */
import { describe, it, expect } from "vitest";
import {
  NAV_GROUPS,
  WORK_NAV_ITEMS,
  WORKSPACE_HOME_HREF,
  CONNECT_HUB_HREF,
  TESTING_HUB_HREF,
  topbarTitle,
  defaultNavGroupsOpen,
  hydrateNavGroupsOpen,
  isConnectHubRoot,
  isWorkNavActive,
  navGroupContainsPath,
  filterNavGroupsForModuleFlags,
} from "./nav-config";
import { DASHBOARD_BASE } from "$lib/dashboard-base";
import { MVP_MODULE_DEFAULTS } from "$lib/module-flags-types";

describe("sidebar nav", () => {
  it("orders work nav as overview then product hubs", () => {
    expect(WORK_NAV_ITEMS.map((i) => i.label)).toEqual(["Overview", "Connect", "Testing"]);
  });

  it("does not duplicate Connect sub-routes in sidebar groups", () => {
    expect(NAV_GROUPS.map((g) => g.id)).toEqual(["keys", "observe", "tools"]);
    const connectHrefs = NAV_GROUPS.flatMap((g) =>
      g.items.filter((i) => i.href.includes("/connect")).map((i) => i.href)
    );
    expect(connectHrefs).toEqual([]);
  });

  it("uses operator-model group labels", () => {
    expect(NAV_GROUPS.map((g) => g.label)).toEqual(["Configure", "Monitor", "More"]);
  });

  it("contains expected grouped labels without duplicate work items", () => {
    const labels = NAV_GROUPS.flatMap((group) => group.items.map((item) => item.label));
    expect(labels).toContain("Connections");
    expect(labels).toContain("Routes");
    expect(labels).toContain("Guard rails");
    expect(labels).toContain("Model catalog");
    expect(labels).toContain("Usage");
    expect(labels).toContain("Logs");
    expect(labels).toContain("Health");
    expect(labels).toContain("Gateway keys");
    expect(labels).toContain("Try a request");
    expect(labels).not.toContain("CI snippets");
    expect(labels).toContain("CLI & agents");
    expect(labels).not.toContain("Testing");
    expect(labels).not.toContain("Overview");
    expect(labels).toContain("Graph");
  });

  it("collapses secondary groups by default", () => {
    expect(defaultNavGroupsOpen().keys).toBe(false);
    expect(defaultNavGroupsOpen().observe).toBe(false);
    expect(defaultNavGroupsOpen().tools).toBe(false);
  });

  it("migrates legacy localStorage group keys", () => {
    const open = hydrateNavGroupsOpen({ build: true, quality: true, embed: true, connect: true, suite: true });
    expect(open.keys).toBe(true);
    expect(open.tools).toBe(true);
  });

  it("detects Connect hub root only on exact path", () => {
    expect(isConnectHubRoot(CONNECT_HUB_HREF)).toBe(true);
    expect(isConnectHubRoot(CONNECT_HUB_HREF + "/pipeline")).toBe(false);
  });

  it("highlights Connect on all connect sub-routes", () => {
    expect(isWorkNavActive(CONNECT_HUB_HREF + "/pipeline", CONNECT_HUB_HREF)).toBe(true);
    expect(isWorkNavActive(DASHBOARD_BASE + "/routes", CONNECT_HUB_HREF)).toBe(false);
  });

  it("highlights Testing hub on CI snippets path", () => {
    expect(isWorkNavActive(TESTING_HUB_HREF, TESTING_HUB_HREF)).toBe(true);
    expect(isWorkNavActive(DASHBOARD_BASE + "/copy-for-ci", TESTING_HUB_HREF)).toBe(true);
  });

  it("highlights Overview only on activity path", () => {
    expect(isWorkNavActive(WORKSPACE_HOME_HREF, WORKSPACE_HOME_HREF)).toBe(true);
    expect(isWorkNavActive(CONNECT_HUB_HREF, WORKSPACE_HOME_HREF)).toBe(false);
  });

  it("detects active path inside configure group", () => {
    const keys = NAV_GROUPS.find((g) => g.id === "keys")!;
    expect(navGroupContainsPath(keys, DASHBOARD_BASE + "/routes")).toBe(true);
    expect(navGroupContainsPath(keys, CONNECT_HUB_HREF)).toBe(false);
  });

  it("keeps Monitor group with comingSoon when monitor flag off", () => {
    const filtered = filterNavGroupsForModuleFlags(NAV_GROUPS, { ...MVP_MODULE_DEFAULTS, monitor: false });
    const observe = filtered.find((g) => g.id === "observe");
    expect(observe?.comingSoon).toBe(true);
    expect(observe?.items).toEqual([]);
    expect(observe?.label).toBe("Monitor");
  });

  it("shows Monitor links when monitor flag on", () => {
    const filtered = filterNavGroupsForModuleFlags(NAV_GROUPS, { ...MVP_MODULE_DEFAULTS, monitor: true });
    const observe = filtered.find((g) => g.id === "observe");
    expect(observe?.comingSoon).toBeUndefined();
    expect(observe?.items.map((i) => i.label)).toEqual(["Usage", "Logs", "Health"]);
  });
});

describe("topbarTitle", () => {
  it("returns Overview for workspace home", () => {
    expect(topbarTitle(WORKSPACE_HOME_HREF)).toBe("Overview");
  });

  it("returns Connect for hub root path", () => {
    expect(topbarTitle(CONNECT_HUB_HREF)).toBe("Connect");
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

  it("returns Connect CLI for cli connect path", () => {
    expect(topbarTitle(DASHBOARD_BASE + "/cli/connect")).toBe("Connect CLI");
  });

  it("returns Routes for /routes", () => {
    expect(topbarTitle(DASHBOARD_BASE + "/routes")).toBe("Routes");
  });
});
