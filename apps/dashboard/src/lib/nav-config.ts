/**
 * Dashboard nav: canonical information architecture.
 * Single source for nav items and path → title mapping.
 */
import { DASHBOARD_BASE } from "$lib/dashboard-base";

export type NavItem = {
  href: string;
  label: string;
  external?: boolean;
};

export const NAV_ITEMS: NavItem[] = [
  { href: DASHBOARD_BASE + "/", label: "Overview" },
  { href: DASHBOARD_BASE + "/projects", label: "Projects" },
  { href: DASHBOARD_BASE + "/access", label: "Access" },
  { href: DASHBOARD_BASE + "/integrations", label: "Integrations" },
  { href: DASHBOARD_BASE + "/models", label: "Models" },
  { href: DASHBOARD_BASE + "/healthcheck", label: "Healthcheck" },
  { href: DASHBOARD_BASE + "/routes", label: "Routes" },
  { href: DASHBOARD_BASE + "/policies", label: "Policies" },
  { href: DASHBOARD_BASE + "/analytics", label: "Analytics" },
  { href: DASHBOARD_BASE + "/logs", label: "Logs & Traces" },
  { href: DASHBOARD_BASE + "/lifecycle", label: "Lifecycle & Migrations" },
  { href: DASHBOARD_BASE + "/billing", label: "Billing & Forecasting" },
  { href: DASHBOARD_BASE + "/sandbox", label: "Sandbox" },
  { href: "/keys/docs", label: "Documentation", external: true },
  { href: DASHBOARD_BASE + "/settings", label: "Settings" },
];

const PATH_TO_TITLE: Record<string, string> = {
  [DASHBOARD_BASE + "/"]: "Overview",
  [DASHBOARD_BASE + "/projects"]: "Projects",
  [DASHBOARD_BASE + "/access"]: "Access",
  [DASHBOARD_BASE + "/integrations"]: "Integrations",
  [DASHBOARD_BASE + "/models"]: "Models",
  [DASHBOARD_BASE + "/healthcheck"]: "Healthcheck",
  [DASHBOARD_BASE + "/routes"]: "Routes",
  [DASHBOARD_BASE + "/policies"]: "Policies",
  [DASHBOARD_BASE + "/analytics"]: "Analytics",
  [DASHBOARD_BASE + "/logs"]: "Logs & Traces",
  [DASHBOARD_BASE + "/lifecycle"]: "Lifecycle & Migrations",
  [DASHBOARD_BASE + "/billing"]: "Billing & Forecasting",
  [DASHBOARD_BASE + "/sandbox"]: "Sandbox",
  [DASHBOARD_BASE + "/settings"]: "Settings",
};

/** Title for topbar from pathname (exact match or segment). */
export function topbarTitle(pathname: string): string {
  if (PATH_TO_TITLE[pathname]) return PATH_TO_TITLE[pathname];
  if (pathname.startsWith(DASHBOARD_BASE + "/projects/") && pathname !== DASHBOARD_BASE + "/projects") {
    return "Project";
  }
  if (pathname.startsWith(DASHBOARD_BASE + "/integrations/") && pathname !== DASHBOARD_BASE + "/integrations") {
    return "Integration";
  }
  if (pathname.startsWith(DASHBOARD_BASE + "/models/") && pathname !== DASHBOARD_BASE + "/models") {
    return "Model";
  }
  if (pathname.startsWith(DASHBOARD_BASE + "/projects/") && pathname.includes("/routes")) {
    if (pathname.endsWith("/routes")) return "Routes";
    return "Route";
  }
  if (pathname.startsWith(DASHBOARD_BASE + "/policies/") && pathname !== DASHBOARD_BASE + "/policies") {
    return "Policy";
  }
  return "";
}
