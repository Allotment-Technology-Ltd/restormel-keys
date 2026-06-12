/**
 * One contextual doc link for the dashboard topbar (replaces cross-product link sprawl).
 */
import { DASHBOARD_BASE } from "$lib/dashboard-base";

export type ContextualHelpLink = { label: string; href: string };

const BASE = DASHBOARD_BASE.replace(/\/$/, "");

const CONNECT_SECTION_PREFIXES = ["/home", "/sources", "/runs", "/claims", "/prove", "/agents"];

export function contextualHelpForPath(pathname: string): ContextualHelpLink {
  if (CONNECT_SECTION_PREFIXES.some((p) => pathname === BASE + p || pathname.startsWith(BASE + p + "/"))) {
    return { label: "First graph guide", href: "/keys/docs/guides/connect-first-graph-onboarding" };
  }
  if (pathname.startsWith(BASE + "/testing") || pathname.startsWith(BASE + "/copy-for-ci")) {
    return { label: "Testing docs", href: "/testing/docs" };
  }
  if (pathname.startsWith(BASE + "/graph")) {
    return { label: "Graph docs", href: "/graph/docs" };
  }
  return { label: "Keys docs", href: "/keys/docs" };
}

export const SUITE_MAP_LINK: ContextualHelpLink = {
  label: "Suite map",
  href: "/docs/operator-model",
};
