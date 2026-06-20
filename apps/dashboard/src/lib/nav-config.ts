/**
 * Dashboard nav — north-star IA (docs/design/keys-northstar-redesign-2026-06.md §2.2).
 *
 * One product, one home: six top-level work sections (the product loop read
 * top-to-bottom), two collapsed groups (Foundation, Observe), then Testing.
 * The Connect hub is dissolved — there is no hub tab strip; sections are
 * intents, not modules.
 */
import { DASHBOARD_BASE } from "$lib/dashboard-base";

import type { ModuleFlags } from "$lib/module-flags-types";

export type NavItem = {
  href: string;
  label: string;
};

export type NavGroupId = "foundation" | "observe";

export type NavGroup = {
  id: NavGroupId;
  label: string;
  items: NavItem[];
  /** When false, group starts collapsed (persisted in localStorage). */
  defaultOpen?: boolean;
  /** Show coming-soon placeholder instead of nav links (Observe when monitor flag off). */
  comingSoon?: boolean;
};

// ── Canonical section URLs (redesign §2.2) ─────────────────────────────────
export const HOME_HREF = DASHBOARD_BASE + "/home";
export const SOURCES_HREF = DASHBOARD_BASE + "/sources";
/** The ingest guided flow (the relocated setup wizard — a flow, not a place; not in nav). */
export const INGEST_FLOW_HREF = SOURCES_HREF + "/ingest";
export const RUNS_HREF = DASHBOARD_BASE + "/runs";
export const CLAIMS_HREF = DASHBOARD_BASE + "/claims";
export const CLAIMS_MEMORY_HREF = CLAIMS_HREF + "/memory";
export const PROVE_HREF = DASHBOARD_BASE + "/prove";
export const AGENTS_HREF = DASHBOARD_BASE + "/agents";
export const TESTING_HUB_HREF = DASHBOARD_BASE + "/testing";
/** The per-stage ingest-routes view, rehomed under Routes (§2.3 `/connect/models` → MOVE). */
export const INGEST_ROUTES_HREF = DASHBOARD_BASE + "/routes/ingestion";

/**
 * Phase 3 Stage 1 — the verified-query Answer Console (the Prove "Proof" tab).
 * North Star = verified answers at query time, so this is the dashboard's default
 * landing. `/home` remains the operator masthead, reachable from the work nav.
 */
export const ANSWER_CONSOLE_HREF = PROVE_HREF + "/proof";

/** Workspace landing (login + dashboard root). Phase 3 Stage 1: the Answer Console. */
export const WORKSPACE_HOME_HREF = ANSWER_CONSOLE_HREF;

/** Primary work destinations — the golden path, top of the sidebar. */
export const WORK_NAV_ITEMS: NavItem[] = [
  { href: HOME_HREF, label: "Home" },
  { href: SOURCES_HREF, label: "Sources" },
  { href: RUNS_HREF, label: "Runs" },
  { href: CLAIMS_HREF, label: "Claims" },
  { href: PROVE_HREF, label: "Prove" },
  { href: AGENTS_HREF, label: "Agents" },
];

/** Testing keeps its own hub below the collapsed groups (§2.2). */
export const TESTING_NAV_ITEM: NavItem = { href: TESTING_HUB_HREF, label: "Testing" };

export const NAV_GROUPS: NavGroup[] = [
  {
    id: "foundation",
    label: "Foundation",
    defaultOpen: false,
    items: [
      { href: DASHBOARD_BASE + "/integrations", label: "Connections" },
      { href: DASHBOARD_BASE + "/access", label: "Gateway keys" },
      { href: DASHBOARD_BASE + "/routes", label: "Routes" },
      { href: DASHBOARD_BASE + "/policies", label: "Guard rails" },
      { href: DASHBOARD_BASE + "/projects", label: "Projects" },
      { href: DASHBOARD_BASE + "/models", label: "Model catalog" },
      { href: DASHBOARD_BASE + "/sandbox", label: "Request tester" },
    ],
  },
  {
    id: "observe",
    label: "Observe",
    defaultOpen: false,
    items: [
      // Traces leads Observe: the verified-query surface ("what my app actually asked"),
      // the same entity the Answer Console produces (Phase 3 Stage 5).
      { href: DASHBOARD_BASE + "/traces", label: "Traces" },
      { href: DASHBOARD_BASE + "/logs", label: "Logs" },
      { href: DASHBOARD_BASE + "/analytics", label: "Usage" },
      { href: DASHBOARD_BASE + "/healthcheck", label: "Health" },
    ],
  },
];

/** Sidebar active state for primary work nav items (section prefixes). */
export function isWorkNavActive(pathname: string, href: string): boolean {
  if (href === TESTING_HUB_HREF) {
    return (
      pathname === TESTING_HUB_HREF ||
      pathname.startsWith(TESTING_HUB_HREF + "/") ||
      pathname === DASHBOARD_BASE + "/copy-for-ci"
    );
  }
  return pathname === href || pathname.startsWith(href + "/");
}

/** Whether a collapsible group contains the current path. */
export function navGroupContainsPath(group: NavGroup, pathname: string): boolean {
  return group.items.some(
    (item) => pathname === item.href || pathname.startsWith(item.href + "/")
  );
}

/** Initial expand state for collapsible sidebar groups. */
export function defaultNavGroupsOpen(): Record<NavGroupId, boolean> {
  return Object.fromEntries(
    NAV_GROUPS.map((g) => [g.id, g.defaultOpen !== false])
  ) as Record<NavGroupId, boolean>;
}

/**
 * Merge persisted localStorage with new group ids.
 * Legacy keys from older IAs migrate forward:
 *  - "keys" (Configure, pre-R2) and its ancestors "ready"/"build"/"connect" → foundation
 *  - "observe"/"monitor" → observe
 * ("tools"/"embed"/"suite"/"quality" had no successor group — they are ignored.)
 */
export function hydrateNavGroupsOpen(stored: Record<string, unknown> | null): Record<NavGroupId, boolean> {
  const defaults = defaultNavGroupsOpen();
  if (!stored) return defaults;
  const bool = (key: string, fallback: boolean) =>
    typeof stored[key] === "boolean" ? (stored[key] as boolean) : fallback;

  const legacyFoundationOpen =
    stored.keys === true || stored.ready === true || stored.build === true || stored.connect === true;

  return {
    foundation: bool("foundation", legacyFoundationOpen ? true : defaults.foundation),
    observe: bool("observe", bool("monitor", defaults.observe)),
  };
}

const PATH_TO_TITLE: Record<string, string> = {
  [HOME_HREF]: "Home",
  [SOURCES_HREF]: "Sources",
  [INGEST_FLOW_HREF]: "Ingest",
  [RUNS_HREF]: "Runs",
  [CLAIMS_HREF]: "Claims",
  [CLAIMS_MEMORY_HREF]: "Memory inbox",
  [PROVE_HREF]: "Prove",
  [AGENTS_HREF]: "Agents",
  [TESTING_HUB_HREF]: "Testing",
  [DASHBOARD_BASE + "/"]: "Home",
  [DASHBOARD_BASE + "/projects"]: "Projects",
  [DASHBOARD_BASE + "/copy-for-ci"]: "CI snippets",
  [DASHBOARD_BASE + "/access"]: "Gateway keys",
  [DASHBOARD_BASE + "/integrations"]: "Connections",
  [DASHBOARD_BASE + "/graph"]: "Graph",
  [DASHBOARD_BASE + "/dev-tools"]: "CLI & agents",
  [DASHBOARD_BASE + "/cli/connect"]: "Connect CLI",
  [DASHBOARD_BASE + "/models"]: "Model catalog",
  [DASHBOARD_BASE + "/healthcheck"]: "Health",
  [DASHBOARD_BASE + "/routes"]: "Routes",
  [INGEST_ROUTES_HREF]: "Ingest routes",
  [DASHBOARD_BASE + "/policies"]: "Guard rails",
  [DASHBOARD_BASE + "/analytics"]: "Usage",
  [DASHBOARD_BASE + "/logs"]: "Logs",
  [DASHBOARD_BASE + "/traces"]: "Traces",
  [DASHBOARD_BASE + "/sandbox"]: "Request tester",
  [DASHBOARD_BASE + "/settings"]: "Profile",
};

/** Title for topbar from pathname (exact match or segment). */
export function topbarTitle(pathname: string): string {
  if (PATH_TO_TITLE[pathname]) return PATH_TO_TITLE[pathname];
  if (pathname.startsWith(RUNS_HREF + "/")) {
    return "Run";
  }
  if (pathname.startsWith(DASHBOARD_BASE + "/projects/") && pathname.includes("/routes")) {
    if (pathname.endsWith("/routes")) return "Routes";
    return "Route";
  }
  if (pathname.startsWith(DASHBOARD_BASE + "/projects/") && pathname !== DASHBOARD_BASE + "/projects") {
    return "Project";
  }
  if (pathname.startsWith(DASHBOARD_BASE + "/integrations/") && pathname !== DASHBOARD_BASE + "/integrations") {
    return "Connection";
  }
  if (pathname.startsWith(DASHBOARD_BASE + "/dev-tools/") && pathname !== DASHBOARD_BASE + "/dev-tools") {
    return "CLI & agents";
  }
  if (pathname.startsWith(DASHBOARD_BASE + "/models/") && pathname !== DASHBOARD_BASE + "/models") {
    return "Model";
  }
  if (pathname.startsWith(DASHBOARD_BASE + "/policies/") && pathname !== DASHBOARD_BASE + "/policies") {
    return "Guard rail";
  }
  if (pathname.startsWith(DASHBOARD_BASE + "/cli/")) {
    return "Connect CLI";
  }
  return "";
}

/** Filter primary work nav by suite module flags (the six work sections are Connect). */
export function filterWorkNavForModuleFlags(flags: ModuleFlags): NavItem[] {
  // Home always shows. The five Connect work sections require the connect module.
  const connectSections = new Set([SOURCES_HREF, RUNS_HREF, CLAIMS_HREF, PROVE_HREF, AGENTS_HREF]);
  return WORK_NAV_ITEMS.filter((item) => {
    if (connectSections.has(item.href)) return flags.connect;
    return true;
  });
}

/** Testing hub nav entry, gated by the testing module flag. */
export function filterTestingNavForModuleFlags(flags: ModuleFlags): NavItem | null {
  return flags.testing ? TESTING_NAV_ITEM : null;
}

/** Hide guard-rails when module off; Observe shows coming soon when monitor off. */
export function filterNavGroupsForModuleFlags(groups: NavGroup[], flags: ModuleFlags): NavGroup[] {
  return groups
    .map((g) => {
      if (g.id === "observe" && !flags.monitor) {
        return { ...g, items: [], comingSoon: true };
      }
      return {
        ...g,
        items: g.items.filter((item) => {
          if (item.href === DASHBOARD_BASE + "/policies") return flags.guardrails;
          return true;
        }),
      };
    })
    .filter((g) => g.items.length > 0 || g.comingSoon);
}
