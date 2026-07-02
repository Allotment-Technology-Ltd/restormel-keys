/**
 * R2 — orphan crawl assertion (redesign §2.1 principle 4):
 * "A surface is reachable by nav OR by a ledger link; an orphan is a bug."
 *
 * Walks every `+page.svelte` route under /keys/dashboard and asserts each URL
 * is reachable from the sidebar nav, the ⌘K palette registry, the account
 * menu, or a documented in-page link — or is an explicitly classified
 * redirect / out-of-nav functional page. Adding a page route without wiring
 * it into one of these fails this test.
 */
import { describe, it, expect } from "vitest";
import { readdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { DASHBOARD_BASE } from "$lib/dashboard-base";
import {
  NAV_GROUPS,
  TESTING_NAV_ITEM,
  WORK_NAV_ITEMS,
  resolveWorkNavForModuleFlags,
  resolveNavGroupsForModuleFlags,
} from "$lib/nav-config";
import { MVP_MODULE_DEFAULTS } from "$lib/module-flags-types";
import { NAV_COMMANDS } from "$lib/command-palette";

const ROUTES_DIR = fileURLToPath(new URL("../routes/keys/dashboard", import.meta.url));

/** Collect route URL patterns (relative to DASHBOARD_BASE) that render a page. */
function collectPageRoutes(dir: string, prefix = ""): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      // Route groups/params keep their bracket syntax in the pattern.
      out.push(...collectPageRoutes(full, `${prefix}/${entry}`));
    } else if (entry === "+page.svelte") {
      out.push(prefix === "" ? "/" : prefix);
    }
  }
  return out;
}

/** Pages reachable from chrome the layout always renders. */
const NAV_HREFS = new Set(
  [...WORK_NAV_ITEMS, TESTING_NAV_ITEM, ...NAV_GROUPS.flatMap((g) => g.items)].map((i) => i.href),
);
const PALETTE_HREFS = new Set(NAV_COMMANDS.map((c) => c.url.split("?")[0]));
/** Account menu (UserMenu.svelte) destinations. */
const ACCOUNT_MENU_HREFS = new Set(
  ["/settings", "/billing", "/logout"].map((p) => DASHBOARD_BASE + p),
);

/**
 * Everything else must be one of:
 *  - reachable via a documented in-page link ("page-link", with the source page), or
 *  - a redirect-only / auth / out-of-nav functional route, or
 *  - an explicitly tracked placeholder.
 */
const ROUTE_CLASSIFICATION: Record<string, { kind: string; via: string }> = {
  "/": { kind: "redirect", via: "+page.server.ts → 308 /home (§2.3 'one home')" },
  "/copy-for-cli": { kind: "redirect", via: "+page.server.ts → /copy-for-ci (typo alias)" },
  "/login": { kind: "auth", via: "auth entry (layout welcome + redirects)" },
  "/logout": { kind: "auth", via: "account menu" },
  "/cli/connect": { kind: "out-of-nav functional", via: "CLI device-code approval flow (§2.3 KEEP out-of-nav)" },
  "/copy-for-ci": { kind: "page-link", via: "Testing hub tab (TESTING_HUB_TABS)" },
  "/access/audit": { kind: "redirect", via: "+page.server.ts → 308 /prove/audit (R5 D5; deep link kept from /access)" },
  "/connect/model-advisory": { kind: "redirect", via: "+page.server.ts → 308 /models?view=rank (unified Models page, rank lens)" },
  "/sources/ingest": { kind: "page-link", via: "Home journey CTAs + palette action:start-ingest-flow (flows are not places — §2.1)" },
  "/claims/memory": { kind: "page-link", via: "palette nav:claims-memory + dev-tools/mcp memory-inbox links (R3 inbox strip mounts it on Home)" },
  "/routes/ingestion": { kind: "page-link", via: "ledger fix links (run-preflight/journey fixHrefs) + palette nav:ingest-routes" },
  "/runs/[id]": { kind: "page-link", via: "runs list rows (runs/+page.svelte)" },
  "/integrations/[id]": { kind: "page-link", via: "connections list (integrations/+page.svelte)" },
  "/models/[id]": { kind: "page-link", via: "model catalog 'Open full page' (models/+page.svelte)" },
  "/policies/[id]": { kind: "page-link", via: "guard-rails list (policies/+page.svelte)" },
  "/projects/[id]": { kind: "page-link", via: "projects list (projects/+page.svelte)" },
  "/projects/[id]/routes": { kind: "page-link", via: "project detail (projects/[id]/+page.svelte)" },
  "/projects/[id]/routes/[routeId]": { kind: "page-link", via: "project routes list + ledger fix links (route builder)" },
  "/graph": { kind: "placeholder", via: "D8: out of nav; route remains as Graph-module placeholder until Phase 6" },
  "/dev-tools": { kind: "redirect", via: "+page.server.ts → 308 /agents/catalogs (R5 MERGE-INTO)" },
  "/dev-tools/cli": { kind: "redirect", via: "+page.server.ts → 308 /agents/catalogs (R5 MERGE-INTO)" },
  "/dev-tools/mcp": { kind: "redirect", via: "+page.server.ts → 308 /agents/catalogs (R5 MERGE-INTO)" },
  "/dev-tools/aaif": { kind: "redirect", via: "+page.server.ts → 308 /agents/catalogs (R5 MERGE-INTO)" },
  // R5: Agents hub tabs — reachable from /agents (nav item) via AGENTS_HUB_TABS
  "/agents/wiring": { kind: "page-link", via: "AGENTS_HUB_TABS[0] — /agents nav item hub strip (R5)" },
  "/agents/catalogs": { kind: "page-link", via: "AGENTS_HUB_TABS[1] — /agents nav item hub strip (R5)" },
  // R5: Prove hub tabs — reachable from /prove (nav item) via PROVE_HUB_TABS
  "/prove/proof": { kind: "page-link", via: "PROVE_HUB_TABS[0] — /prove nav item hub strip (R5)" },
  "/prove/traces": { kind: "page-link", via: "PROVE_HUB_TABS[1] — /prove nav item hub strip (R5)" },
  "/prove/audit": { kind: "page-link", via: "PROVE_HUB_TABS[2] — /prove nav item hub strip + /access deep-link (R5 D5)" },
  "/prove/share": { kind: "page-link", via: "PROVE_HUB_TABS[3] — /prove nav item hub strip; gated on W4.3 STOP (R5)" },
  // RES-113 PR-6b: /verify renders a real page under the journey nav only. It is
  // reachable from the flag-ON chrome (resolveJourneyNav's unconditional "Verify"
  // tab, asserted by the journey manifest below) + the Home Verify tiles;
  // flag-OFF the +page.server.ts 404s, so it can never orphan the legacy chrome
  // this crawl checks.
  "/verify": { kind: "page-link", via: "journey nav Verify tab (resolveJourneyNav, onboardingJourney ON) + Home Verify tiles; flag-OFF → 404" },
};

describe("R2 orphan crawl (route manifest)", () => {
  const routes = collectPageRoutes(ROUTES_DIR).map((r) => (r === "/" ? "/" : r));

  it("found the dashboard routes", () => {
    expect(routes.length).toBeGreaterThan(30);
  });

  it.each(routes.map((r) => [r] as [string]))("%s is reachable (nav / palette / account menu / classified link)", (route) => {
    const href = route === "/" ? DASHBOARD_BASE : DASHBOARD_BASE + route;
    const reachable =
      NAV_HREFS.has(href) ||
      PALETTE_HREFS.has(href) ||
      ACCOUNT_MENU_HREFS.has(href) ||
      route in ROUTE_CLASSIFICATION;
    expect(reachable, `orphan route: ${route} — add a nav/palette/page link or classify it`).toBe(true);
  });

  it("classification table has no stale rows (deleted routes)", () => {
    for (const route of Object.keys(ROUTE_CLASSIFICATION)) {
      expect(routes, `classified route no longer exists: ${route}`).toContain(route);
    }
  });

  it("the six D8 kills stay dead", () => {
    const killed = [
      "/connect/ingest/new",
      "/lifecycle",
      "/projects/[id]/usage",
      "/admin",
      "/admin/users",
      "/admin/package-registry",
    ];
    for (const route of killed) {
      expect(existsSync(join(ROUTES_DIR, ...route.slice(1).split("/"), "+page.svelte"))).toBe(false);
    }
    // /prototype/brutalist-dashboard (outside the dashboard tree)
    expect(existsSync(join(ROUTES_DIR, "../../prototype"))).toBe(false);
  });
});

/**
 * RES-113 PR-G — the flag-gated IA re-spine, proven in BOTH states.
 *
 * Flag OFF: the live IA is the north-star one (asserted by the suite above, which
 * uses the OFF constants). Flag ON: the journey verb spine must have no dead nav
 * links — every Home·Build·Verify·Connect destination resolves to a real route
 * (a rendered `+page.svelte` OR a `+page.server.ts` redirect alias), and the M0–M4
 * milestone hubs the nav surfaces all exist at their canonical routes.
 */
describe("RES-113 journey IA route manifest (onboardingJourney ON)", () => {
  const ON = { ...MVP_MODULE_DEFAULTS, onboardingJourney: true, connect: true };

  /** A dashboard href is served if its route dir has a +page.svelte or +page.server.ts. */
  function routeIsServed(href: string): boolean {
    const rel = href.slice(DASHBOARD_BASE.length).replace(/^\//, "");
    const segs = rel === "" ? [] : rel.split("/");
    const dir = join(ROUTES_DIR, ...segs);
    if (existsSync(join(dir, "+page.svelte")) || existsSync(join(dir, "+page.server.ts"))) {
      return true;
    }
    // Walk the route dir and its ancestors for a catch-all ([...rest]) child that
    // serves the path — e.g. /connect is served by connect/[...legacy]/+page.server.ts.
    for (let i = segs.length; i >= 0; i--) {
      const ancestor = join(ROUTES_DIR, ...segs.slice(0, i));
      try {
        const hasCatchAll = readdirSync(ancestor).some(
          (e) =>
            e.startsWith("[...") &&
            statSync(join(ancestor, e)).isDirectory() &&
            existsSync(join(ancestor, e, "+page.server.ts")),
        );
        if (hasCatchAll) return true;
      } catch {
        // ancestor dir may not exist — keep walking up
      }
    }
    return false;
  }

  it("every journey primary-nav destination resolves to a real route (no dead links)", () => {
    const journeyNav = resolveWorkNavForModuleFlags(ON);
    expect(journeyNav.map((i) => i.label)).toEqual(["Home", "Build", "Verify", "Connect"]);
    for (const item of journeyNav) {
      expect(routeIsServed(item.href), `journey nav dead link: ${item.href}`).toBe(true);
    }
  });

  it("every journey Settings-group destination resolves to a real route", () => {
    const groups = resolveNavGroupsForModuleFlags(ON);
    for (const group of groups) {
      for (const item of group.items) {
        expect(routeIsServed(item.href), `journey settings dead link: ${item.href}`).toBe(true);
      }
    }
  });

  it("the M0–M4 milestone hubs the journey nav surfaces exist at their canonical routes", () => {
    // M0 Explore → /prove/proof; M1 Build → /sources/ingest; M2 Verify → /claims;
    // M4 Connect → /agents/wiring (the catch-all aliases /connect onto this when ON).
    const hubs = [
      DASHBOARD_BASE + "/prove/proof",
      DASHBOARD_BASE + "/sources/ingest",
      DASHBOARD_BASE + "/claims",
      DASHBOARD_BASE + "/agents/wiring",
    ];
    for (const hub of hubs) {
      expect(routeIsServed(hub), `missing milestone hub route: ${hub}`).toBe(true);
    }
  });

  it("the new verb-spine routes stay OUT of the flag-OFF live nav (flag-gated)", () => {
    const offNav = resolveWorkNavForModuleFlags({ ...MVP_MODULE_DEFAULTS, onboardingJourney: false });
    const offHrefs = offNav.map((i) => i.href);
    expect(offHrefs).toEqual(WORK_NAV_ITEMS.map((i) => i.href));
    expect(offHrefs).not.toContain(DASHBOARD_BASE + "/build");
    expect(offHrefs).not.toContain(DASHBOARD_BASE + "/verify");
  });
});
