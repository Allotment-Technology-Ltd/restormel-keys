/**
 * Dashboard nav — north-star IA (docs/design/keys-northstar-redesign-2026-06.md §2.2),
 * collapsed to depth by Phase 3 Stage 6 ("the operator desk becomes depth").
 *
 * The verified-query product is the hero. The primary work nav now leads with the
 * four verified-query surfaces — Answer Console (home) · Sources/health · Traces ·
 * Keys & Routing — and the operator/audit desk (Home masthead · Runs · Claims/
 * Stamping · Prove-audit · Agents) is demoted into a collapsed "Operator" group:
 * still reachable when an answer is wrong or for an auditor, but no longer a
 * primary destination. The Connect hub stays dissolved — sections are intents,
 * not modules.
 */
import { DASHBOARD_BASE } from "$lib/dashboard-base";

import type { ModuleFlags } from "$lib/module-flags-types";

export type NavItem = {
  href: string;
  label: string;
};

export type NavGroupId = "operator" | "foundation" | "observe";

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
/** Phase 3 Stage 5 — Traces ("what my app actually asked"), promoted to a lead surface. */
export const TRACES_HREF = DASHBOARD_BASE + "/traces";
/** Gateway keys (the "Keys & Routing" lead surface; Routes lives under Foundation). */
export const ACCESS_HREF = DASHBOARD_BASE + "/access";
export const ROUTES_HREF = DASHBOARD_BASE + "/routes";

/**
 * Phase 3 Stage 1 — the verified-query Answer Console (the Prove "Proof" tab).
 * North Star = verified answers at query time, so this is the dashboard's default
 * landing AND the first primary destination (Phase 3 Stage 6).
 */
export const ANSWER_CONSOLE_HREF = PROVE_HREF + "/proof";

/** Workspace landing (login + dashboard root). Phase 3 Stage 1: the Answer Console. */
export const WORKSPACE_HOME_HREF = ANSWER_CONSOLE_HREF;

/**
 * Primary work destinations (Phase 3 Stage 6) — lead with the verified-query
 * product surfaces. The operator/audit desk (Home, Runs, Claims, Prove, Agents)
 * is demoted to the collapsed "Operator" group below, not deleted.
 *  1. Answer Console — the hero (verified answers at query time).
 *  2. Sources — watched background sources + health (Stage 3).
 *  3. Traces — "what my app actually asked" (Stage 5).
 *  4. Keys & Routing — gateway keys + routes (the binding layer).
 */
export const WORK_NAV_ITEMS: NavItem[] = [
  { href: ANSWER_CONSOLE_HREF, label: "Answer Console" },
  { href: SOURCES_HREF, label: "Sources" },
  { href: TRACES_HREF, label: "Traces" },
  { href: ACCESS_HREF, label: "Keys & Routing" },
];

/** Testing keeps its own hub below the collapsed groups (§2.2). */
export const TESTING_NAV_ITEM: NavItem = { href: TESTING_HUB_HREF, label: "Testing" };

export const NAV_GROUPS: NavGroup[] = [
  {
    // Phase 3 Stage 6 — the operator / audit desk, demoted to depth. These are the
    // surfaces you reach when an answer is wrong, or for an auditor; not primary
    // destinations. Preserved in full (same spirit as the route builder kept as
    // "advanced"): demoted, never deleted.
    id: "operator",
    label: "Operator",
    defaultOpen: false,
    items: [
      { href: HOME_HREF, label: "Operator home" },
      { href: RUNS_HREF, label: "Runs" },
      { href: CLAIMS_HREF, label: "Stamping desk" },
      { href: PROVE_HREF, label: "Prove (audit)" },
      { href: AGENTS_HREF, label: "Agents" },
    ],
  },
  {
    id: "foundation",
    label: "Foundation",
    defaultOpen: false,
    items: [
      { href: DASHBOARD_BASE + "/integrations", label: "Connections" },
      { href: ROUTES_HREF, label: "Routes" },
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
      // Traces is promoted to a primary work surface (Phase 3 Stage 6); Observe
      // keeps the operational telemetry below it.
      { href: DASHBOARD_BASE + "/logs", label: "Logs" },
      { href: DASHBOARD_BASE + "/analytics", label: "Usage" },
      { href: DASHBOARD_BASE + "/healthcheck", label: "Health" },
    ],
  },
];

/**
 * Phase 3 Stage 6 — the Answer Console (`/prove/proof`) and the demoted
 * Prove-audit desk (`/prove`) share a path prefix. The Answer Console owns the
 * `/prove/proof` subtree; Prove-audit owns the rest of `/prove`. This keeps the
 * top-level Answer Console highlight from also lighting up the Operator group.
 */
function matchesNavHref(pathname: string, href: string): boolean {
  if (href === PROVE_HREF) {
    // Prove-audit: everything under /prove EXCEPT the Answer Console subtree.
    if (pathname === ANSWER_CONSOLE_HREF || pathname.startsWith(ANSWER_CONSOLE_HREF + "/")) {
      return false;
    }
    return pathname === PROVE_HREF || pathname.startsWith(PROVE_HREF + "/");
  }
  return pathname === href || pathname.startsWith(href + "/");
}

/** Sidebar active state for primary work nav items (section prefixes). */
export function isWorkNavActive(pathname: string, href: string): boolean {
  if (href === TESTING_HUB_HREF) {
    return (
      pathname === TESTING_HUB_HREF ||
      pathname.startsWith(TESTING_HUB_HREF + "/") ||
      pathname === DASHBOARD_BASE + "/copy-for-ci"
    );
  }
  return matchesNavHref(pathname, href);
}

/** Whether a collapsible group contains the current path. */
export function navGroupContainsPath(group: NavGroup, pathname: string): boolean {
  return group.items.some((item) => matchesNavHref(pathname, item.href));
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
 *  - "operator" is new in Phase 3 Stage 6 (the demoted desk); no legacy successor.
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
    operator: bool("operator", defaults.operator),
    foundation: bool("foundation", legacyFoundationOpen ? true : defaults.foundation),
    observe: bool("observe", bool("monitor", defaults.observe)),
  };
}

const PATH_TO_TITLE: Record<string, string> = {
  [HOME_HREF]: "Operator home",
  [SOURCES_HREF]: "Sources",
  [INGEST_FLOW_HREF]: "Ingest",
  [RUNS_HREF]: "Runs",
  [CLAIMS_HREF]: "Stamping desk",
  [CLAIMS_MEMORY_HREF]: "Memory inbox",
  [ANSWER_CONSOLE_HREF]: "Answer Console",
  [PROVE_HREF]: "Prove",
  [AGENTS_HREF]: "Agents",
  [TRACES_HREF]: "Traces",
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

/**
 * Filter primary work nav by suite module flags (Phase 3 Stage 6 lead surfaces).
 * Answer Console (the verified-query home) and Keys & Routing always show; the
 * verified-corpus surfaces (Sources, Traces) require the connect module.
 */
export function filterWorkNavForModuleFlags(flags: ModuleFlags): NavItem[] {
  const connectSections = new Set([SOURCES_HREF, TRACES_HREF]);
  return WORK_NAV_ITEMS.filter((item) => {
    if (connectSections.has(item.href)) return flags.connect;
    return true;
  });
}

/** Testing hub nav entry, gated by the testing module flag. */
export function filterTestingNavForModuleFlags(flags: ModuleFlags): NavItem | null {
  return flags.testing ? TESTING_NAV_ITEM : null;
}

/**
 * Hide guard-rails when module off; Observe shows coming soon when monitor off.
 * In the demoted Operator group (Phase 3 Stage 6) the Connect operator surfaces
 * (Runs, Stamping desk, Prove-audit, Agents) require the connect module; the
 * operator masthead (`/home`) always shows.
 */
export function filterNavGroupsForModuleFlags(groups: NavGroup[], flags: ModuleFlags): NavGroup[] {
  const operatorConnectSurfaces = new Set([RUNS_HREF, CLAIMS_HREF, PROVE_HREF, AGENTS_HREF]);
  return groups
    .map((g) => {
      if (g.id === "observe" && !flags.monitor) {
        return { ...g, items: [], comingSoon: true };
      }
      return {
        ...g,
        items: g.items.filter((item) => {
          if (item.href === DASHBOARD_BASE + "/policies") return flags.guardrails;
          if (g.id === "operator" && operatorConnectSurfaces.has(item.href)) return flags.connect;
          return true;
        }),
      };
    })
    .filter((g) => g.items.length > 0 || g.comingSoon);
}
