/**
 * Dashboard nav: canonical information architecture.
 * Sidebar groups and path → title mapping.
 */
import { DASHBOARD_BASE } from "$lib/dashboard-base";

export type NavItem = {
  href: string;
  label: string;
};

export type NavGroupId = "build" | "monitor" | "developer";

export type NavGroup = {
  id: NavGroupId;
  label: string;
  items: NavItem[];
};

export const OVERVIEW_ITEM: NavItem = { href: DASHBOARD_BASE + "/", label: "Overview" };

export const NAV_GROUPS: NavGroup[] = [
  {
    id: "build",
    label: "Build",
    items: [
      { href: DASHBOARD_BASE + "/integrations", label: "Providers" },
      { href: DASHBOARD_BASE + "/routes", label: "Routes" },
      { href: DASHBOARD_BASE + "/policies", label: "Policies" },
      { href: DASHBOARD_BASE + "/models", label: "Models" },
    ],
  },
  {
    id: "monitor",
    label: "Monitor",
    items: [
      { href: DASHBOARD_BASE + "/analytics", label: "Analytics" },
      { href: DASHBOARD_BASE + "/logs", label: "Logs" },
      { href: DASHBOARD_BASE + "/healthcheck", label: "Healthcheck" },
    ],
  },
  {
    id: "developer",
    label: "Developer",
    items: [
      { href: DASHBOARD_BASE + "/access", label: "Access" },
      { href: DASHBOARD_BASE + "/sandbox", label: "Sandbox" },
      { href: DASHBOARD_BASE + "/copy-for-ci", label: "CI / CD" },
      { href: DASHBOARD_BASE + "/dev-tools", label: "Dev Tools" },
    ],
  },
];

const PATH_TO_TITLE: Record<string, string> = {
  [DASHBOARD_BASE + "/"]: "Overview",
  [DASHBOARD_BASE + "/projects"]: "Projects",
  [DASHBOARD_BASE + "/copy-for-ci"]: "CI / CD",
  [DASHBOARD_BASE + "/access"]: "Access",
  [DASHBOARD_BASE + "/integrations"]: "Providers",
  [DASHBOARD_BASE + "/dev-tools"]: "Dev Tools",
  [DASHBOARD_BASE + "/models"]: "Models",
  [DASHBOARD_BASE + "/healthcheck"]: "Healthcheck",
  [DASHBOARD_BASE + "/routes"]: "Routes",
  [DASHBOARD_BASE + "/policies"]: "Policies",
  [DASHBOARD_BASE + "/analytics"]: "Analytics",
  [DASHBOARD_BASE + "/logs"]: "Logs",
  [DASHBOARD_BASE + "/sandbox"]: "Sandbox",
  [DASHBOARD_BASE + "/settings"]: "Profile",
};

/** Title for topbar from pathname (exact match or segment). */
export function topbarTitle(pathname: string): string {
  if (PATH_TO_TITLE[pathname]) return PATH_TO_TITLE[pathname];
  if (pathname.startsWith(DASHBOARD_BASE + "/projects/") && pathname !== DASHBOARD_BASE + "/projects") {
    return "Project";
  }
  if (pathname.startsWith(DASHBOARD_BASE + "/integrations/") && pathname !== DASHBOARD_BASE + "/integrations") {
    return "Providers";
  }
  if (pathname.startsWith(DASHBOARD_BASE + "/dev-tools/") && pathname !== DASHBOARD_BASE + "/dev-tools") {
    return "Dev Tools";
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
