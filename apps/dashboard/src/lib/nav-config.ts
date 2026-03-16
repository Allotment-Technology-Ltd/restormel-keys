/**
 * Dashboard nav: canonical information architecture.
 * Single source for nav items and path → title mapping.
 */
import { base } from "$app/paths";

export type NavItem = {
  href: string;
  label: string;
  external?: boolean;
};

export const NAV_ITEMS: NavItem[] = [
  { href: base + "/", label: "Overview" },
  { href: base + "/projects", label: "Projects" },
  { href: base + "/access", label: "Access" },
  { href: base + "/integrations", label: "Provider Integrations" },
  { href: base + "/models", label: "Models" },
  { href: base + "/routes", label: "Routes" },
  { href: base + "/policies", label: "Policies" },
  { href: base + "/analytics", label: "Analytics" },
  { href: base + "/logs", label: "Logs & Traces" },
  { href: base + "/lifecycle", label: "Lifecycle & Migrations" },
  { href: base + "/billing", label: "Billing & Forecasting" },
  { href: "/keys/docs/", label: "Documentation", external: true },
  { href: base + "/settings", label: "Settings" },
];

const PATH_TO_TITLE: Record<string, string> = {
  [base + "/"]: "Overview",
  [base + "/projects"]: "Projects",
  [base + "/access"]: "Access",
  [base + "/integrations"]: "Provider Integrations",
  [base + "/models"]: "Models",
  [base + "/routes"]: "Routes",
  [base + "/policies"]: "Policies",
  [base + "/analytics"]: "Analytics",
  [base + "/logs"]: "Logs & Traces",
  [base + "/lifecycle"]: "Lifecycle & Migrations",
  [base + "/billing"]: "Billing & Forecasting",
  [base + "/settings"]: "Settings",
};

/** Title for topbar from pathname (exact match or segment). */
export function topbarTitle(pathname: string): string {
  if (PATH_TO_TITLE[pathname]) return PATH_TO_TITLE[pathname];
  if (pathname.startsWith(base + "/projects/") && pathname !== base + "/projects") {
    return "Project";
  }
  if (pathname.startsWith(base + "/integrations/") && pathname !== base + "/integrations") {
    return "Provider Integration";
  }
  if (pathname.startsWith(base + "/models/") && pathname !== base + "/models") {
    return "Model";
  }
  if (pathname.startsWith(base + "/projects/") && pathname.includes("/routes")) {
    if (pathname.endsWith("/routes")) return "Routes";
    return "Route";
  }
  if (pathname.startsWith(base + "/policies/") && pathname !== base + "/policies") {
    return "Policy";
  }
  return "";
}
