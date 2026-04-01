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
    label: "Set Up",
    items: [
      { href: DASHBOARD_BASE + "/integrations", label: "Connections" },
      { href: DASHBOARD_BASE + "/routes", label: "Rules" },
      { href: DASHBOARD_BASE + "/policies", label: "Guard Rails" },
      { href: DASHBOARD_BASE + "/models", label: "Model Catalog" },
    ],
  },
  {
    id: "monitor",
    label: "Monitor",
    items: [
      { href: DASHBOARD_BASE + "/analytics", label: "Usage & Analytics" },
      { href: DASHBOARD_BASE + "/logs", label: "Logs" },
      { href: DASHBOARD_BASE + "/healthcheck", label: "System Health" },
    ],
  },
  {
    id: "developer",
    label: "Advanced",
    items: [
      { href: DASHBOARD_BASE + "/access", label: "Gateway keys" },
      { href: DASHBOARD_BASE + "/sandbox", label: "Test & Preview" },
      { href: DASHBOARD_BASE + "/copy-for-ci", label: "GitHub Setup" },
      { href: DASHBOARD_BASE + "/dev-tools", label: "Dev Tools" },
    ],
  },
];

const PATH_TO_TITLE: Record<string, string> = {
  [DASHBOARD_BASE + "/"]: "Overview",
  [DASHBOARD_BASE + "/projects"]: "Projects",
  [DASHBOARD_BASE + "/copy-for-ci"]: "GitHub Setup",
  [DASHBOARD_BASE + "/access"]: "Gateway keys",
  [DASHBOARD_BASE + "/integrations"]: "Connections",
  [DASHBOARD_BASE + "/dev-tools"]: "Dev Tools",
  [DASHBOARD_BASE + "/cli/connect"]: "Connect CLI",
  [DASHBOARD_BASE + "/models"]: "Model Catalog",
  [DASHBOARD_BASE + "/healthcheck"]: "System Health",
  [DASHBOARD_BASE + "/routes"]: "Rules",
  [DASHBOARD_BASE + "/policies"]: "Guard Rails",
  [DASHBOARD_BASE + "/analytics"]: "Usage & Analytics",
  [DASHBOARD_BASE + "/logs"]: "Logs",
  [DASHBOARD_BASE + "/sandbox"]: "Test & Preview",
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
    return "Dev Tools";
  }
  if (pathname.startsWith(DASHBOARD_BASE + "/models/") && pathname !== DASHBOARD_BASE + "/models") {
    return "Model";
  }
  if (pathname.startsWith(DASHBOARD_BASE + "/projects/") && pathname.includes("/routes")) {
    if (pathname.endsWith("/routes")) return "Rules";
    return "Rule";
  }
  if (pathname.startsWith(DASHBOARD_BASE + "/policies/") && pathname !== DASHBOARD_BASE + "/policies") {
    return "Guard Rail";
  }
  if (pathname.startsWith(DASHBOARD_BASE + "/cli/")) {
    return "Connect CLI";
  }
  return "";
}
