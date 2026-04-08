/**
 * Marketing site nav — module-first pillars (Keys | Testing | Integrations | Developers).
 * URLs stay canonical per docs/documentation-strategy.md.
 */
import { DASHBOARD_BASE } from "$lib/dashboard-base";

export const GITHUB_REPO_URL = "https://github.com/Allotment-Technology-Ltd/restormel-keys";

export type SiteNavLink = {
  href: string;
  label: string;
  external?: boolean;
  /** Accessible label for external links */
  ariaLabel?: string;
};

/** Normalize pathname for prefix checks */
export function normalizePath(pathname: string): string {
  return pathname.replace(/\/$/, "") || "/";
}

export const keysPillarLinks: SiteNavLink[] = [
  { href: "/keys", label: "Overview" },
  { href: "/keys/docs", label: "Documentation" },
  { href: DASHBOARD_BASE, label: "Dashboard" },
  { href: "/keys/pricing", label: "Pricing" },
  { href: "/keys/use-cases", label: "Use cases" },
];

export const testingPillarLinks: SiteNavLink[] = [
  { href: "/testing", label: "Overview" },
  { href: "/testing/docs", label: "Documentation" },
  { href: "/testing/dashboard", label: "Testing dashboard" },
];

/** Developers bucket — API portal URL filled in by consumer (Zuplo). */
export function developerLinks(portalUrl: string): SiteNavLink[] {
  return [
    {
      href: portalUrl,
      label: "API portal",
      external: true,
      ariaLabel: "API portal, opens in new tab",
    },
    {
      href: GITHUB_REPO_URL,
      label: "GitHub",
      external: true,
      ariaLabel: "Restormel Keys on GitHub, opens in new tab",
    },
  ];
}

export function isKeysPillarActive(path: string): boolean {
  const p = normalizePath(path);
  return p.startsWith("/keys") || p.startsWith(DASHBOARD_BASE);
}

export function isTestingPillarActive(path: string): boolean {
  return normalizePath(path).startsWith("/testing");
}

export function isIntegrationsActive(path: string): boolean {
  const p = normalizePath(path);
  return p === "/integrations" || p.startsWith("/integrations/");
}

/** Active state for a child link inside a pillar dropdown */
export function isLinkActive(path: string, href: string): boolean {
  const p = normalizePath(path);
  const h = normalizePath(href);
  if (h === "/keys") return p === "/keys";
  if (h === "/testing") return p === "/testing";
  return p === h || p.startsWith(h + "/");
}
