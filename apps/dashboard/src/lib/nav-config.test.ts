/**
 * Nav config: north-star IA (redesign §2.2) and topbar titles.
 */
import { describe, it, expect } from "vitest";
import {
  NAV_GROUPS,
  WORK_NAV_ITEMS,
  TESTING_NAV_ITEM,
  HOME_HREF,
  SOURCES_HREF,
  RUNS_HREF,
  CLAIMS_HREF,
  CLAIMS_MEMORY_HREF,
  PROVE_HREF,
  AGENTS_HREF,
  TESTING_HUB_HREF,
  INGEST_ROUTES_HREF,
  WORKSPACE_HOME_HREF,
  topbarTitle,
  defaultNavGroupsOpen,
  hydrateNavGroupsOpen,
  isWorkNavActive,
  navGroupContainsPath,
  filterWorkNavForModuleFlags,
  filterTestingNavForModuleFlags,
  filterNavGroupsForModuleFlags,
} from "./nav-config";
import { DASHBOARD_BASE } from "$lib/dashboard-base";
import { MVP_MODULE_DEFAULTS } from "$lib/module-flags-types";

describe("sidebar nav (§2.2)", () => {
  it("orders the six work sections as the product loop", () => {
    expect(WORK_NAV_ITEMS.map((i) => i.label)).toEqual([
      "Home",
      "Sources",
      "Runs",
      "Claims",
      "Prove",
      "Agents",
    ]);
    expect(WORK_NAV_ITEMS.map((i) => i.href)).toEqual([
      HOME_HREF,
      SOURCES_HREF,
      RUNS_HREF,
      CLAIMS_HREF,
      PROVE_HREF,
      AGENTS_HREF,
    ]);
  });

  it("login landing (workspace home) is /home", () => {
    expect(WORKSPACE_HOME_HREF).toBe(DASHBOARD_BASE + "/home");
  });

  it("has exactly two collapsed groups: Foundation and Observe", () => {
    expect(NAV_GROUPS.map((g) => g.id)).toEqual(["foundation", "observe"]);
    expect(NAV_GROUPS.map((g) => g.label)).toEqual(["Foundation", "Observe"]);
  });

  it("Foundation matches §2.2 exactly (incl. Projects and Request tester)", () => {
    const foundation = NAV_GROUPS.find((g) => g.id === "foundation")!;
    expect(foundation.items.map((i) => [i.label, i.href])).toEqual([
      ["Connections", DASHBOARD_BASE + "/integrations"],
      ["Gateway keys", DASHBOARD_BASE + "/access"],
      ["Routes", DASHBOARD_BASE + "/routes"],
      ["Guard rails", DASHBOARD_BASE + "/policies"],
      ["Projects", DASHBOARD_BASE + "/projects"],
      ["Model catalog", DASHBOARD_BASE + "/models"],
      ["Request tester", DASHBOARD_BASE + "/sandbox"],
    ]);
  });

  it("Observe matches §2.2 exactly", () => {
    const observe = NAV_GROUPS.find((g) => g.id === "observe")!;
    expect(observe.items.map((i) => [i.label, i.href])).toEqual([
      ["Logs", DASHBOARD_BASE + "/logs"],
      ["Usage", DASHBOARD_BASE + "/analytics"],
      ["Health", DASHBOARD_BASE + "/healthcheck"],
    ]);
  });

  it("does not link any dissolved /connect URL anywhere", () => {
    const allHrefs = [
      ...WORK_NAV_ITEMS.map((i) => i.href),
      TESTING_NAV_ITEM.href,
      ...NAV_GROUPS.flatMap((g) => g.items.map((i) => i.href)),
    ];
    expect(allHrefs.filter((h) => h.includes("/connect"))).toEqual([]);
    // Graph-module stub is out of nav (D8); dev-tools merges into Agents in R5.
    expect(allHrefs.filter((h) => h.endsWith("/graph") || h.includes("/dev-tools"))).toEqual([]);
  });

  it("Testing lives below the groups, not in the work zone", () => {
    expect(TESTING_NAV_ITEM).toEqual({ href: TESTING_HUB_HREF, label: "Testing" });
    expect(WORK_NAV_ITEMS.map((i) => i.label)).not.toContain("Testing");
  });

  it("collapses both groups by default", () => {
    expect(defaultNavGroupsOpen().foundation).toBe(false);
    expect(defaultNavGroupsOpen().observe).toBe(false);
  });

  it("migrates legacy localStorage group keys (keys→foundation, monitor→observe)", () => {
    expect(hydrateNavGroupsOpen({ keys: true }).foundation).toBe(true);
    expect(hydrateNavGroupsOpen({ build: true }).foundation).toBe(true);
    expect(hydrateNavGroupsOpen({ connect: true }).foundation).toBe(true);
    expect(hydrateNavGroupsOpen({ monitor: true }).observe).toBe(true);
    expect(hydrateNavGroupsOpen({ keys: false, monitor: false })).toEqual({
      foundation: false,
      observe: false,
    });
    // New keys win over legacy ones.
    expect(hydrateNavGroupsOpen({ foundation: false, keys: true }).foundation).toBe(false);
    expect(hydrateNavGroupsOpen(null)).toEqual(defaultNavGroupsOpen());
  });

  it("highlights sections on their sub-routes", () => {
    expect(isWorkNavActive(RUNS_HREF + "/job-1", RUNS_HREF)).toBe(true);
    expect(isWorkNavActive(CLAIMS_MEMORY_HREF, CLAIMS_HREF)).toBe(true);
    expect(isWorkNavActive(SOURCES_HREF + "/ingest", SOURCES_HREF)).toBe(true);
    expect(isWorkNavActive(DASHBOARD_BASE + "/routes", RUNS_HREF)).toBe(false);
    expect(isWorkNavActive(HOME_HREF, HOME_HREF)).toBe(true);
    expect(isWorkNavActive(CLAIMS_HREF, HOME_HREF)).toBe(false);
  });

  it("highlights Testing hub on CI snippets path", () => {
    expect(isWorkNavActive(TESTING_HUB_HREF, TESTING_HUB_HREF)).toBe(true);
    expect(isWorkNavActive(DASHBOARD_BASE + "/copy-for-ci", TESTING_HUB_HREF)).toBe(true);
  });

  it("detects active path inside the Foundation group", () => {
    const foundation = NAV_GROUPS.find((g) => g.id === "foundation")!;
    expect(navGroupContainsPath(foundation, DASHBOARD_BASE + "/routes")).toBe(true);
    expect(navGroupContainsPath(foundation, INGEST_ROUTES_HREF)).toBe(true);
    expect(navGroupContainsPath(foundation, CLAIMS_HREF)).toBe(false);
  });

  it("gates the five Connect sections on the connect flag; Home always shows", () => {
    const withConnect = filterWorkNavForModuleFlags({ ...MVP_MODULE_DEFAULTS, connect: true });
    expect(withConnect.map((i) => i.label)).toEqual(["Home", "Sources", "Runs", "Claims", "Prove", "Agents"]);
    const withoutConnect = filterWorkNavForModuleFlags({ ...MVP_MODULE_DEFAULTS, connect: false });
    expect(withoutConnect.map((i) => i.label)).toEqual(["Home"]);
  });

  it("gates Testing nav on the testing flag", () => {
    expect(filterTestingNavForModuleFlags({ ...MVP_MODULE_DEFAULTS, testing: true })).toEqual(TESTING_NAV_ITEM);
    expect(filterTestingNavForModuleFlags({ ...MVP_MODULE_DEFAULTS, testing: false })).toBeNull();
  });

  it("keeps Observe group with comingSoon when monitor flag off", () => {
    const filtered = filterNavGroupsForModuleFlags(NAV_GROUPS, { ...MVP_MODULE_DEFAULTS, monitor: false });
    const observe = filtered.find((g) => g.id === "observe");
    expect(observe?.comingSoon).toBe(true);
    expect(observe?.items).toEqual([]);
  });

  it("shows Observe links when monitor flag on", () => {
    const filtered = filterNavGroupsForModuleFlags(NAV_GROUPS, { ...MVP_MODULE_DEFAULTS, monitor: true });
    const observe = filtered.find((g) => g.id === "observe");
    expect(observe?.comingSoon).toBeUndefined();
    expect(observe?.items.map((i) => i.label)).toEqual(["Logs", "Usage", "Health"]);
  });

  it("hides Guard rails when guardrails flag off", () => {
    const filtered = filterNavGroupsForModuleFlags(NAV_GROUPS, { ...MVP_MODULE_DEFAULTS, guardrails: false });
    const foundation = filtered.find((g) => g.id === "foundation");
    expect(foundation?.items.map((i) => i.label)).not.toContain("Guard rails");
  });
});

describe("topbarTitle", () => {
  it("titles the six work sections", () => {
    expect(topbarTitle(HOME_HREF)).toBe("Home");
    expect(topbarTitle(SOURCES_HREF)).toBe("Sources");
    expect(topbarTitle(RUNS_HREF)).toBe("Runs");
    expect(topbarTitle(CLAIMS_HREF)).toBe("Claims");
    expect(topbarTitle(PROVE_HREF)).toBe("Prove");
    expect(topbarTitle(AGENTS_HREF)).toBe("Agents");
  });

  it("titles section detail pages", () => {
    expect(topbarTitle(RUNS_HREF + "/job-42")).toBe("Run");
    expect(topbarTitle(CLAIMS_MEMORY_HREF)).toBe("Memory inbox");
    expect(topbarTitle(SOURCES_HREF + "/ingest")).toBe("Ingest");
    expect(topbarTitle(INGEST_ROUTES_HREF)).toBe("Ingest routes");
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

  it("returns Request tester for /sandbox (relabelled per §2.3)", () => {
    expect(topbarTitle(DASHBOARD_BASE + "/sandbox")).toBe("Request tester");
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
