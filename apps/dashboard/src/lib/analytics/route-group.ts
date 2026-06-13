/**
 * Map a pathname to a coarse, PII-free `RouteGroup` for analytics segmentation.
 *
 * Used both by the enriched-pageview handler and the outbound-link handler in
 * hooks.client.ts, and exported for any page-owner that wants to tag an event
 * with its originating group. Order matters — most specific prefixes first.
 */
import type { RouteGroup } from "./events";

export function routeGroupForPath(pathname: string): RouteGroup {
  const p = pathname.toLowerCase();

  if (p === "/" || p === "/keys" || p === "/keys/") return "home";

  // Docs across every product surface.
  if (
    p.startsWith("/docs") ||
    p.startsWith("/keys/docs") ||
    p.startsWith("/graph/docs") ||
    p.startsWith("/connect/docs")
  ) {
    return "docs";
  }

  if (p.startsWith("/pricing") || p.startsWith("/keys/pricing")) return "pricing";
  if (p.startsWith("/founders")) return "founders";
  if (p.startsWith("/integrations") || p.startsWith("/keys/v1/catalog")) return "integrations";
  if (p.startsWith("/graph")) return "graph";
  if (p.startsWith("/testing")) return "testing";
  if (p.startsWith("/connect")) return "connect";

  if (p.startsWith("/keys/dashboard")) return "dashboard";
  if (p.startsWith("/keys/auth")) return "auth";
  if (p.startsWith("/keys/admin")) return "admin";

  if (
    p.startsWith("/keys/privacy") ||
    p.startsWith("/keys/terms") ||
    p.startsWith("/keys/refund-policy")
  ) {
    return "legal";
  }

  // Remaining /keys/* marketing-ish pages (use-cases, product, etc.) and the
  // marketing route group.
  if (p.startsWith("/keys") || p.startsWith("/product") || p.startsWith("/use-cases")) {
    return "marketing";
  }

  return "other";
}
