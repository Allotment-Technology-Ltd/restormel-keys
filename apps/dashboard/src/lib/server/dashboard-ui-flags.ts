/**
 * Dashboard UI feature flags: hide advanced sections from nav and block page loads.
 * REST API and CLI are unchanged — operators can still use HTTP routes and scripts.
 */
import { DASHBOARD_BASE } from "$lib/dashboard-base";
import { type DashboardUiSection, DASHBOARD_UI_SECTION_SET } from "$lib/dashboard-ui-sections";
import { pathnameToDashboardUiSection } from "$lib/dashboard-ui-path-match";
import type { NavGroup } from "$lib/nav-config";

const BASE = DASHBOARD_BASE.endsWith("/") ? DASHBOARD_BASE.slice(0, -1) : DASHBOARD_BASE;

export type { DashboardUiSection };
export { DASHBOARD_UI_SECTIONS } from "$lib/dashboard-ui-sections";

function parseCsv(value: string | undefined): Set<DashboardUiSection> {
  const out = new Set<DashboardUiSection>();
  for (const part of (value ?? "").split(",")) {
    const s = part.trim().toLowerCase();
    if (DASHBOARD_UI_SECTION_SET.has(s)) out.add(s as DashboardUiSection);
  }
  return out;
}

/** Sections to hide in the dashboard UI (empty = show everything). */
export function parseDashboardUiHidden(): Set<DashboardUiSection> {
  return parseCsv(process.env.RESTORMEL_DASHBOARD_UI_HIDDEN);
}

function navHrefToSection(href: string): DashboardUiSection | null {
  const norm = href.endsWith("/") && href.length > BASE.length + 1 ? href.slice(0, -1) : href;
  if (norm === `${BASE}/integrations`) return "providers";
  if (norm === `${BASE}/routes`) return "routes";
  if (norm === `${BASE}/policies`) return "policies";
  if (norm === `${BASE}/models`) return "models";
  if (norm === `${BASE}/analytics`) return "analytics";
  if (norm === `${BASE}/logs`) return "logs";
  if (norm === `${BASE}/healthcheck`) return "healthcheck";
  if (norm === `${BASE}/sandbox`) return "sandbox";
  if (norm === `${BASE}/copy-for-ci`) return "copy-for-ci";
  if (norm === `${BASE}/dev-tools`) return "dev-tools";
  return null;
}

/** Drop hidden items; remove empty nav groups. */
export function filterNavGroupsForDashboardUi(groups: NavGroup[], hidden: Set<DashboardUiSection>): NavGroup[] {
  return groups
    .map((g) => ({
      ...g,
      items: g.items.filter((item) => {
        const s = navHrefToSection(item.href);
        return s === null || !hidden.has(s);
      }),
    }))
    .filter((g) => g.items.length > 0 || g.comingSoon);
}

const SECTION_LABELS: Record<DashboardUiSection, string> = {
  policies: "Guard Rails",
  routes: "Routes",
  models: "Model Catalog",
  providers: "Connections",
  analytics: "Usage",
  logs: "Logs",
  healthcheck: "System Health",
  sandbox: "Test & Preview",
  "copy-for-ci": "GitHub Setup",
  "dev-tools": "Dev Tools",
  billing: "Billing",
  projects: "Projects",
};

export function dashboardUiSectionLabel(section: DashboardUiSection): string {
  return SECTION_LABELS[section] ?? section;
}

/** If pathname is under a hidden UI section, return that section (for redirect). */
export function pathnameToHiddenDashboardSection(
  pathname: string,
  hidden: Set<DashboardUiSection>
): DashboardUiSection | null {
  const section = pathnameToDashboardUiSection(pathname);
  return section && hidden.has(section) ? section : null;
}

export function parseUiSectionHiddenParam(raw: string | null): DashboardUiSection | null {
  if (!raw) return null;
  const s = raw.trim().toLowerCase();
  return DASHBOARD_UI_SECTION_SET.has(s) ? (s as DashboardUiSection) : null;
}
