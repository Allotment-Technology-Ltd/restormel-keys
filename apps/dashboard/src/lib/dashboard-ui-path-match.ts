/**
 * Pure path → UI section mapping (shared by server redirects and client link filtering).
 */
import { DASHBOARD_BASE } from "$lib/dashboard-base";
import type { DashboardUiSection } from "$lib/dashboard-ui-sections";

const BASE = DASHBOARD_BASE.endsWith("/") ? DASHBOARD_BASE.slice(0, -1) : DASHBOARD_BASE;

export function segmentsToDashboardUiSection(segments: string[]): DashboardUiSection | null {
  const first = segments[0];
  if (!first || first === "login" || first === "logout" || first === "api" || first === "settings") {
    return null;
  }
  if (first === "policies") return "policies";
  if (first === "routes") return "routes";
  if (first === "models") return "models";
  if (first === "integrations") return "providers";
  if (first === "analytics") return "analytics";
  if (first === "logs") return "logs";
  if (first === "healthcheck") return "healthcheck";
  if (first === "sandbox") return "sandbox";
  if (first === "copy-for-ci") return "copy-for-ci";
  if (first === "dev-tools") return "dev-tools";
  if (first === "billing") return "billing";
  if (first === "lifecycle") return "models";
  if (first === "projects" && segments.length >= 3 && segments[2] === "routes") return "routes";
  if (first === "projects") return "projects";
  return null;
}

export function pathnameToDashboardUiSection(pathname: string): DashboardUiSection | null {
  if (!pathname.startsWith(BASE)) return null;
  const rest = pathname.slice(BASE.length).replace(/^\//, "");
  const segments = rest.split("/").filter(Boolean);
  return segmentsToDashboardUiSection(segments);
}

/** Dashboard href (optional query string) → section. */
export function hrefToDashboardUiSection(href: string): DashboardUiSection | null {
  const pathOnly = href.trim().split("?")[0];
  return pathnameToDashboardUiSection(pathOnly);
}

export function isDashboardHrefUiHidden(href: string | null | undefined, hidden: Iterable<string>): boolean {
  if (!href) return false;
  const s = hrefToDashboardUiSection(href);
  if (!s) return false;
  const set = hidden instanceof Set ? hidden : new Set(hidden);
  return set.has(s);
}
