/**
 * Dashboard nav — scope-first IA aligned with SUITE-OPERATOR-MODEL.
 *
 * Sidebar order: workspace context → primary work hubs → configure/monitor/more groups.
 * Multi-step flows use in-hub tabs (dashboard-hub-nav), not duplicate sidebar links.
 */
import { DASHBOARD_BASE } from "$lib/dashboard-base";
import { moduleById } from "$lib/suite/suite-modules";

import type { ModuleFlags } from "$lib/module-flags-types";

export type NavItem = {
  href: string;
  label: string;
};

export type NavGroupId = "keys" | "observe" | "tools";

export type NavGroup = {
  id: NavGroupId;
  label: string;
  items: NavItem[];
  /** When false, group starts collapsed (persisted in localStorage). */
  defaultOpen?: boolean;
  /** Show coming-soon placeholder instead of nav links (Monitor when flag off). */
  comingSoon?: boolean;
};

export const WORKSPACE_HOME_HREF = DASHBOARD_BASE + "/activity";
export const CONNECT_HUB_HREF = DASHBOARD_BASE + "/connect";
export const TESTING_HUB_HREF = DASHBOARD_BASE + "/testing";

/** Primary work destinations — always visible below project context. */
export const WORK_NAV_ITEMS: NavItem[] = [
  { href: WORKSPACE_HOME_HREF, label: "Overview" },
  { href: CONNECT_HUB_HREF, label: "Connect" },
  { href: TESTING_HUB_HREF, label: "Testing" },
];

/** @deprecated Use WORK_NAV_ITEMS */
export const HUB_ROOT_ITEMS: NavItem[] = WORK_NAV_ITEMS.filter((i) => i.href !== WORKSPACE_HOME_HREF);

/** @deprecated Use WORKSPACE_HOME_HREF or WORK_NAV_ITEMS */
export const OVERVIEW_ITEM: NavItem = WORK_NAV_ITEMS.find((i) => i.href === CONNECT_HUB_HREF) ?? WORK_NAV_ITEMS[1];

const graphMod = moduleById("graph");

export const NAV_GROUPS: NavGroup[] = [
  {
    id: "keys",
    label: "Configure",
    defaultOpen: false,
    items: [
      { href: DASHBOARD_BASE + "/integrations", label: "Connections" },
      { href: DASHBOARD_BASE + "/access", label: "Gateway keys" },
      { href: DASHBOARD_BASE + "/routes", label: "Routes" },
      { href: DASHBOARD_BASE + "/policies", label: "Guard rails" },
      { href: DASHBOARD_BASE + "/models", label: "Model catalog" },
    ],
  },
  {
    id: "observe",
    label: "Monitor",
    defaultOpen: false,
    items: [
      { href: DASHBOARD_BASE + "/analytics", label: "Usage" },
      { href: DASHBOARD_BASE + "/logs", label: "Logs" },
      { href: DASHBOARD_BASE + "/healthcheck", label: "Health" },
    ],
  },
  {
    id: "tools",
    label: "More",
    defaultOpen: false,
    items: [
      { href: DASHBOARD_BASE + "/sandbox", label: "Try a request" },
      { href: DASHBOARD_BASE + "/dev-tools", label: "CLI & agents" },
      { href: DASHBOARD_BASE + "/graph", label: graphMod.product.replace("Restormel ", "") },
    ],
  },
];

/** True when pathname is the Connect hub home (not a sub-route). Used for hub tab "Home". */
export function isConnectHubRoot(pathname: string): boolean {
  return pathname === CONNECT_HUB_HREF;
}

/** Sidebar active state for primary work nav items. */
export function isWorkNavActive(pathname: string, href: string): boolean {
  if (href === WORKSPACE_HOME_HREF) return pathname === WORKSPACE_HOME_HREF;
  if (href === CONNECT_HUB_HREF) {
    return pathname === CONNECT_HUB_HREF || pathname.startsWith(CONNECT_HUB_HREF + "/");
  }
  if (href === TESTING_HUB_HREF) {
    return pathname === TESTING_HUB_HREF || pathname === DASHBOARD_BASE + "/copy-for-ci";
  }
  return pathname === href;
}

/** @deprecated Use isWorkNavActive */
export function isHubRootActive(pathname: string, href: string): boolean {
  return isWorkNavActive(pathname, href);
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

/** Merge persisted localStorage with new group ids (legacy keys from older IA). */
export function hydrateNavGroupsOpen(stored: Record<string, unknown> | null): Record<NavGroupId, boolean> {
  const defaults = defaultNavGroupsOpen();
  if (!stored) return defaults;
  const bool = (key: string, fallback: boolean) =>
    typeof stored[key] === "boolean" ? (stored[key] as boolean) : fallback;

  const legacySuiteOpen =
    stored.quality === true || stored.connect === true || stored.embed === true || stored.suite === true;
  const legacyKeysOpen = stored.ready === true || stored.build === true || stored.connect === true;

  return {
    keys: bool("keys", legacyKeysOpen ? true : defaults.keys),
    observe: bool("observe", bool("monitor", defaults.observe)),
    tools: bool("tools", bool("embed", legacySuiteOpen ? true : defaults.tools)),
  };
}

const PATH_TO_TITLE: Record<string, string> = {
  [WORKSPACE_HOME_HREF]: "Overview",
  [CONNECT_HUB_HREF]: "Connect",
  [TESTING_HUB_HREF]: "Testing",
  [DASHBOARD_BASE + "/"]: "Overview",
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
  [DASHBOARD_BASE + "/policies"]: "Guard rails",
  [DASHBOARD_BASE + "/analytics"]: "Usage",
  [DASHBOARD_BASE + "/logs"]: "Logs",
  [DASHBOARD_BASE + "/sandbox"]: "Try a request",
  [DASHBOARD_BASE + "/settings"]: "Profile",
};

/** Title for topbar from pathname (exact match or segment). */
export function topbarTitle(pathname: string): string {
  if (PATH_TO_TITLE[pathname]) return PATH_TO_TITLE[pathname];
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
  if (pathname.startsWith(DASHBOARD_BASE + "/projects/") && pathname.includes("/routes")) {
    if (pathname.endsWith("/routes")) return "Routes";
    return "Route";
  }
  if (pathname.startsWith(DASHBOARD_BASE + "/policies/") && pathname !== DASHBOARD_BASE + "/policies") {
    return "Guard rail";
  }
  if (pathname.startsWith(DASHBOARD_BASE + "/cli/")) {
    return "Connect CLI";
  }
  if (pathname.startsWith(DASHBOARD_BASE + "/connect/")) {
    if (pathname.startsWith(DASHBOARD_BASE + "/connect/ingest")) return "Connect · Runs";
    if (pathname.startsWith(DASHBOARD_BASE + "/connect/pipeline")) return "Connect · Pipeline";
    if (pathname.startsWith(DASHBOARD_BASE + "/connect/graph")) return "Connect · Graph";
    if (pathname.startsWith(DASHBOARD_BASE + "/connect/mcp")) return "Connect · MCP";
    if (pathname.startsWith(DASHBOARD_BASE + "/connect/models")) return "Connect · Models";
    return "Connect";
  }
  return "";
}

/** Filter primary work nav by suite module flags. */
export function filterWorkNavForModuleFlags(flags: ModuleFlags): NavItem[] {
  return WORK_NAV_ITEMS.filter((item) => {
    if (item.href === CONNECT_HUB_HREF) return flags.connect;
    if (item.href === TESTING_HUB_HREF) return flags.testing;
    return true;
  });
}

/** Hide graph dev-tools link and guard-rails when modules off; Monitor shows coming soon when off. */
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
          if (item.href === DASHBOARD_BASE + "/graph") return flags.graph !== "disabled";
          return true;
        }),
      };
    })
    .filter((g) => g.items.length > 0 || g.comingSoon);
}
