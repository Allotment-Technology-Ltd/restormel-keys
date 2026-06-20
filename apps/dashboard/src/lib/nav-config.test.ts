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
  type NavItem,
  type NavGroup,
} from "./nav-config";
import { DASHBOARD_BASE } from "$lib/dashboard-base";
import { MVP_MODULE_DEFAULTS } from "$lib/module-flags-types";

describe("sidebar nav (Phase 3 Stage 6 — operator desk collapsed to depth)", () => {
  it("leads the work nav with the four verified-query surfaces", () => {
    // Stage 6: Answer Console (home) · Sources · Traces · Keys & Routing.
    expect(WORK_NAV_ITEMS.map((i) => i.label)).toEqual([
      "Answer Console",
      "Sources",
      "Traces",
      "Keys & Routing",
    ]);
    expect(WORK_NAV_ITEMS.map((i) => i.href)).toEqual([
      DASHBOARD_BASE + "/prove/proof",
      SOURCES_HREF,
      DASHBOARD_BASE + "/traces",
      DASHBOARD_BASE + "/access",
    ]);
  });

  it("demotes the operator/audit surfaces out of the primary work nav", () => {
    const workHrefs = WORK_NAV_ITEMS.map((i) => i.href);
    // Runs, Claims/Stamping, Prove-audit, Agents and the operator Home are no
    // longer primary destinations (they live in the collapsed Operator group).
    expect(workHrefs).not.toContain(HOME_HREF);
    expect(workHrefs).not.toContain(RUNS_HREF);
    expect(workHrefs).not.toContain(CLAIMS_HREF);
    expect(workHrefs).not.toContain(PROVE_HREF);
    expect(workHrefs).not.toContain(AGENTS_HREF);
  });

  it("workspace landing is the verified Answer Console (Phase 3 Stage 1)", () => {
    // Stage 1 makes the verified-query surface the default landing (North Star =
    // verified answers at query time); Stage 6 makes it the first work item too.
    expect(WORKSPACE_HOME_HREF).toBe(DASHBOARD_BASE + "/prove/proof");
    expect(WORK_NAV_ITEMS[0].href).toBe(WORKSPACE_HOME_HREF);
  });

  it("has three collapsed groups: Operator (demoted desk), Foundation, Observe", () => {
    expect(NAV_GROUPS.map((g) => g.id)).toEqual(["operator", "foundation", "observe"]);
    expect(NAV_GROUPS.map((g) => g.label)).toEqual(["Operator", "Foundation", "Observe"]);
  });

  it("Operator group preserves the demoted desk (Home masthead, Runs, Stamping, Prove-audit, Agents)", () => {
    const operator = NAV_GROUPS.find((g) => g.id === "operator")!;
    expect(operator.items.map((i) => [i.label, i.href])).toEqual([
      ["Operator home", HOME_HREF],
      ["Runs", RUNS_HREF],
      ["Stamping desk", CLAIMS_HREF],
      ["Prove (audit)", PROVE_HREF],
      ["Agents", AGENTS_HREF],
    ]);
  });

  it("Foundation keeps configuration depth (Routes stays; Gateway keys promoted to top-level)", () => {
    const foundation = NAV_GROUPS.find((g) => g.id === "foundation")!;
    expect(foundation.items.map((i) => [i.label, i.href])).toEqual([
      ["Connections", DASHBOARD_BASE + "/integrations"],
      ["Routes", DASHBOARD_BASE + "/routes"],
      ["Guard rails", DASHBOARD_BASE + "/policies"],
      ["Projects", DASHBOARD_BASE + "/projects"],
      ["Model catalog", DASHBOARD_BASE + "/models"],
      ["Request tester", DASHBOARD_BASE + "/sandbox"],
    ]);
  });

  it("Observe drops Traces (promoted to a lead surface) and keeps telemetry", () => {
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
    // The Connect hub IA is fully dissolved from nav: model advisory is now a lens of the
    // unified Models page (/models?view=rank), so NO nav href may point under /connect.
    // (The /connect/model-advisory route still exists, but only as a 308 redirect to that lens.)
    expect(allHrefs.filter((h) => h.includes("/connect"))).toEqual([]);
    // Graph-module stub is out of nav (D8); dev-tools merges into Agents in R5.
    expect(allHrefs.filter((h) => h.endsWith("/graph") || h.includes("/dev-tools"))).toEqual([]);
  });

  it("Testing lives below the groups, not in the work zone", () => {
    expect(TESTING_NAV_ITEM).toEqual({ href: TESTING_HUB_HREF, label: "Testing" });
    expect(WORK_NAV_ITEMS.map((i) => i.label)).not.toContain("Testing");
  });

  it("collapses all groups by default (incl. the demoted Operator group)", () => {
    expect(defaultNavGroupsOpen().operator).toBe(false);
    expect(defaultNavGroupsOpen().foundation).toBe(false);
    expect(defaultNavGroupsOpen().observe).toBe(false);
  });

  it("migrates legacy localStorage group keys (keys→foundation, monitor→observe)", () => {
    expect(hydrateNavGroupsOpen({ keys: true }).foundation).toBe(true);
    expect(hydrateNavGroupsOpen({ build: true }).foundation).toBe(true);
    expect(hydrateNavGroupsOpen({ connect: true }).foundation).toBe(true);
    expect(hydrateNavGroupsOpen({ monitor: true }).observe).toBe(true);
    expect(hydrateNavGroupsOpen({ keys: false, monitor: false })).toEqual({
      operator: false,
      foundation: false,
      observe: false,
    });
    // New keys win over legacy ones.
    expect(hydrateNavGroupsOpen({ foundation: false, keys: true }).foundation).toBe(false);
    // The Operator group key round-trips (new in Stage 6, no legacy successor).
    expect(hydrateNavGroupsOpen({ operator: true }).operator).toBe(true);
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

  it("keeps Answer Console (/prove/proof) and Prove-audit (/prove) highlights disjoint", () => {
    const answer = DASHBOARD_BASE + "/prove/proof";
    // On the Answer Console: the Answer Console lights up, Prove-audit does NOT.
    expect(isWorkNavActive(answer, answer)).toBe(true);
    expect(isWorkNavActive(answer, PROVE_HREF)).toBe(false);
    expect(isWorkNavActive(answer + "/run-1", answer)).toBe(true);
    // On the Prove-audit desk: Prove-audit lights up, Answer Console does NOT.
    expect(isWorkNavActive(PROVE_HREF, PROVE_HREF)).toBe(true);
    expect(isWorkNavActive(PROVE_HREF, answer)).toBe(false);
    expect(isWorkNavActive(PROVE_HREF + "/history", PROVE_HREF)).toBe(true);
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

  it("detects active path inside the demoted Operator group", () => {
    const operator = NAV_GROUPS.find((g) => g.id === "operator")!;
    expect(navGroupContainsPath(operator, RUNS_HREF + "/job-1")).toBe(true);
    expect(navGroupContainsPath(operator, CLAIMS_MEMORY_HREF)).toBe(true);
    expect(navGroupContainsPath(operator, PROVE_HREF)).toBe(true);
    // The Answer Console subtree belongs to the work nav, not the Operator group.
    expect(navGroupContainsPath(operator, DASHBOARD_BASE + "/prove/proof")).toBe(false);
  });

  it("gates the verified-corpus work surfaces on the connect flag; Answer Console + Keys always show", () => {
    const withConnect = filterWorkNavForModuleFlags({ ...MVP_MODULE_DEFAULTS, connect: true });
    expect(withConnect.map((i) => i.label)).toEqual([
      "Answer Console",
      "Sources",
      "Traces",
      "Keys & Routing",
    ]);
    const withoutConnect = filterWorkNavForModuleFlags({ ...MVP_MODULE_DEFAULTS, connect: false });
    expect(withoutConnect.map((i) => i.label)).toEqual(["Answer Console", "Keys & Routing"]);
  });

  it("gates the Operator desk's Connect surfaces on the connect flag; Operator home always shows", () => {
    const withConnect = filterNavGroupsForModuleFlags(NAV_GROUPS, { ...MVP_MODULE_DEFAULTS, connect: true });
    const opOn = withConnect.find((g) => g.id === "operator");
    expect(opOn?.items.map((i) => i.label)).toEqual([
      "Operator home",
      "Runs",
      "Stamping desk",
      "Prove (audit)",
      "Agents",
    ]);
    const withoutConnect = filterNavGroupsForModuleFlags(NAV_GROUPS, { ...MVP_MODULE_DEFAULTS, connect: false });
    const opOff = withoutConnect.find((g) => g.id === "operator");
    expect(opOff?.items.map((i) => i.label)).toEqual(["Operator home"]);
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

  it("shows Observe links when monitor flag on (Traces is now a lead surface)", () => {
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

/**
 * Navigation pending-state derivation (nav-pending-fix, ux-contracts §3).
 *
 * The layout derives `pendingHref` from `$navigating.to?.url.pathname` using the
 * same `isWorkNavActive` logic as the active highlight. These tests replicate the
 * layout's derivation logic in pure form so we can assert the contract without a
 * browser / Svelte component harness.
 */
function derivePendingHref(
  dest: string,
  workNavForUi: NavItem[],
  testingNavForUi: NavItem | null,
  navGroupsForLayout: NavGroup[],
): string | null {
  for (const item of workNavForUi) {
    if (isWorkNavActive(dest, item.href)) return item.href;
  }
  if (testingNavForUi && isWorkNavActive(dest, testingNavForUi.href)) return testingNavForUi.href;
  for (const group of navGroupsForLayout) {
    for (const item of group.items) {
      if (dest === item.href || dest.startsWith(item.href + "/")) return item.href;
    }
  }
  return null;
}

function derivePendingLabel(
  dest: string,
  workNavForUi: NavItem[],
  testingNavForUi: NavItem | null,
  navGroupsForLayout: NavGroup[],
): string | null {
  for (const item of workNavForUi) {
    if (isWorkNavActive(dest, item.href)) return item.label;
  }
  if (testingNavForUi && isWorkNavActive(dest, testingNavForUi.href)) return testingNavForUi.label;
  for (const group of navGroupsForLayout) {
    for (const item of group.items) {
      if (dest === item.href || dest.startsWith(item.href + "/")) return item.label;
    }
  }
  return null;
}

describe("navigation pending-state derivation (nav-pending-fix)", () => {
  const workNav = WORK_NAV_ITEMS;
  const testingNav = TESTING_NAV_ITEM;
  const groups = NAV_GROUPS;

  it("resolves Sources as the pending item when navigating to /sources", () => {
    expect(derivePendingHref(SOURCES_HREF, workNav, testingNav, groups)).toBe(SOURCES_HREF);
    expect(derivePendingLabel(SOURCES_HREF, workNav, testingNav, groups)).toBe("Sources");
  });

  it("resolves Sources as the pending item when navigating to a sub-route of /sources", () => {
    const dest = SOURCES_HREF + "/ingest";
    expect(derivePendingHref(dest, workNav, testingNav, groups)).toBe(SOURCES_HREF);
    expect(derivePendingLabel(dest, workNav, testingNav, groups)).toBe("Sources");
  });

  it("resolves Runs when navigating to /runs", () => {
    expect(derivePendingHref(RUNS_HREF, workNav, testingNav, groups)).toBe(RUNS_HREF);
    expect(derivePendingLabel(RUNS_HREF, workNav, testingNav, groups)).toBe("Runs");
  });

  it("resolves Runs for a run console sub-path", () => {
    const dest = RUNS_HREF + "/job-123";
    expect(derivePendingHref(dest, workNav, testingNav, groups)).toBe(RUNS_HREF);
  });

  it("resolves the demoted Stamping desk when navigating to /claims", () => {
    expect(derivePendingHref(CLAIMS_HREF, workNav, testingNav, groups)).toBe(CLAIMS_HREF);
    expect(derivePendingLabel(CLAIMS_HREF, workNav, testingNav, groups)).toBe("Stamping desk");
  });

  it("resolves Claims for /claims/memory", () => {
    expect(derivePendingHref(CLAIMS_MEMORY_HREF, workNav, testingNav, groups)).toBe(CLAIMS_HREF);
  });

  it("resolves the demoted Operator home when navigating to /home", () => {
    expect(derivePendingHref(HOME_HREF, workNav, testingNav, groups)).toBe(HOME_HREF);
    expect(derivePendingLabel(HOME_HREF, workNav, testingNav, groups)).toBe("Operator home");
  });

  it("resolves the Answer Console (not Prove-audit) when navigating to /prove/proof", () => {
    const answer = DASHBOARD_BASE + "/prove/proof";
    expect(derivePendingHref(answer, workNav, testingNav, groups)).toBe(answer);
    expect(derivePendingLabel(answer, workNav, testingNav, groups)).toBe("Answer Console");
  });

  it("resolves Testing when navigating to the testing hub", () => {
    expect(derivePendingHref(TESTING_HUB_HREF, workNav, testingNav, groups)).toBe(TESTING_HUB_HREF);
    expect(derivePendingLabel(TESTING_HUB_HREF, workNav, testingNav, groups)).toBe("Testing");
  });

  it("resolves Testing for /copy-for-ci (CI snippets, alias of testing hub)", () => {
    const dest = DASHBOARD_BASE + "/copy-for-ci";
    expect(derivePendingHref(dest, workNav, testingNav, groups)).toBe(TESTING_HUB_HREF);
  });

  it("resolves a Foundation group item when navigating to /integrations", () => {
    const dest = DASHBOARD_BASE + "/integrations";
    expect(derivePendingHref(dest, workNav, testingNav, groups)).toBe(DASHBOARD_BASE + "/integrations");
    expect(derivePendingLabel(dest, workNav, testingNav, groups)).toBe("Connections");
  });

  it("resolves a Foundation item for a sub-path of /routes", () => {
    const dest = DASHBOARD_BASE + "/routes/some-config";
    expect(derivePendingHref(dest, workNav, testingNav, groups)).toBe(DASHBOARD_BASE + "/routes");
  });

  it("returns null for an unmatched path", () => {
    expect(derivePendingHref("/unmatched/path", workNav, testingNav, groups)).toBeNull();
    expect(derivePendingLabel("/unmatched/path", workNav, testingNav, groups)).toBeNull();
  });

  it("does not mark the current-page item as pending (layout guard)", () => {
    // The layout only applies .nav-link-pending when the resolved pendingHref is
    // DIFFERENT from the current active item. This test verifies the derivation
    // itself correctly resolves (the layout guard is separate logic).
    // If we're on /sources and navigating to /sources, derivation still returns
    // SOURCES_HREF — the layout's `!isWorkNavActive(currentPath, item.href)` guard
    // then prevents the pending class from being applied.
    const dest = SOURCES_HREF;
    expect(derivePendingHref(dest, workNav, testingNav, groups)).toBe(SOURCES_HREF);
    // Simulate the layout guard: current path === SOURCES_HREF.
    const isPending = derivePendingHref(dest, workNav, testingNav, groups) === SOURCES_HREF
      && !isWorkNavActive(SOURCES_HREF, SOURCES_HREF);
    expect(isPending).toBe(false); // Correct — no pending pulse on self-nav.
  });
});

describe("topbarTitle", () => {
  it("titles the work + demoted-desk sections", () => {
    expect(topbarTitle(HOME_HREF)).toBe("Operator home");
    expect(topbarTitle(SOURCES_HREF)).toBe("Sources");
    expect(topbarTitle(RUNS_HREF)).toBe("Runs");
    expect(topbarTitle(CLAIMS_HREF)).toBe("Stamping desk");
    expect(topbarTitle(PROVE_HREF)).toBe("Prove");
    expect(topbarTitle(DASHBOARD_BASE + "/prove/proof")).toBe("Answer Console");
    expect(topbarTitle(AGENTS_HREF)).toBe("Agents");
    expect(topbarTitle(DASHBOARD_BASE + "/traces")).toBe("Traces");
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
