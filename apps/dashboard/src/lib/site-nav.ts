/**
 * Marketing site nav — suite-first IA (Theme L).
 * URLs stay canonical per docs/documentation-strategy.md.
 */
import { DASHBOARD_BASE } from "$lib/dashboard-base";
import type { SuiteModule } from "$lib/suite/suite-modules";

export const GITHUB_REPO_URL = "https://github.com/Allotment-Technology-Ltd/restormel-keys";

export const GITHUB_DISCUSSIONS_URL = `${GITHUB_REPO_URL}/discussions`;

export const SUITE_DOCS_HREF = "/docs";

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

/** Primary marketing nav — Product dropdown */
export const productNavLinks: SiteNavLink[] = [
  { href: "/", label: "Suite overview" },
  { href: "/product", label: "Capabilities" },
  { href: "/use-cases", label: "Use cases" },
  { href: SUITE_DOCS_HREF, label: "Documentation" },
  { href: DASHBOARD_BASE, label: "Dashboard" },
];

export const companyNavLinks: SiteNavLink[] = [
  { href: "/founders", label: "Early access" },
  { href: "/roadmap", label: "Roadmap" },
  { href: "/changelog", label: "Changelog" },
];

/** Footer / SEO deep links — capabilities filtered by module flags. */
export function capabilityLinksFromModules(modules: SuiteModule[]): SiteNavLink[] {
  return modules.map((m) => ({
    href: m.href,
    label: m.navLabel,
  }));
}

/** @deprecated Use capabilityLinksFromModules — kept for gradual migration */
export const keysPillarLinks: SiteNavLink[] = [
  { href: "/keys", label: "Overview" },
  { href: "/keys/docs", label: "Keys docs" },
  { href: DASHBOARD_BASE, label: "Dashboard" },
  { href: "/keys/pricing", label: "Pricing" },
  { href: "/keys/use-cases", label: "Use cases" },
];

export const testingPillarLinks: SiteNavLink[] = [
  { href: "/testing", label: "Overview" },
  { href: "/testing/docs", label: "Testing docs" },
  { href: DASHBOARD_BASE + "/testing", label: "Testing hub" },
];

export const graphPillarLinks: SiteNavLink[] = [
  { href: "/graph", label: "Overview" },
  { href: "/graph/docs", label: "Graph docs" },
  { href: "/graph/docs/integration/sveltekit", label: "SvelteKit guide" },
];

export const connectPillarLinks: SiteNavLink[] = [
  { href: "/connect", label: "Overview" },
  { href: "/connect/docs", label: "Documentation" },
  { href: DASHBOARD_BASE + "/home", label: "Dashboard" },
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
      ariaLabel: "Restormel on GitHub, opens in new tab",
    },
  ];
}

export function isProductNavActive(path: string): boolean {
  const p = normalizePath(path);
  return (
    p === "/" ||
    p === "/product" ||
    p === "/use-cases" ||
    p.startsWith(SUITE_DOCS_HREF) ||
    p.startsWith("/keys") ||
    p.startsWith("/testing") ||
    p.startsWith("/graph") ||
    p.startsWith("/connect") ||
    p.startsWith(DASHBOARD_BASE)
  );
}

export function isCompanyNavActive(path: string): boolean {
  const p = normalizePath(path);
  return p === "/roadmap" || p === "/changelog";
}

export function isKeysPillarActive(path: string): boolean {
  const p = normalizePath(path);
  return p.startsWith("/keys") || p.startsWith(DASHBOARD_BASE);
}

export function isTestingPillarActive(path: string): boolean {
  return normalizePath(path).startsWith("/testing");
}

export function isGraphPillarActive(path: string): boolean {
  return normalizePath(path).startsWith("/graph");
}

export function isConnectPillarActive(path: string): boolean {
  return normalizePath(path).startsWith("/connect");
}

export function isIntegrationsActive(path: string): boolean {
  const p = normalizePath(path);
  return p === "/integrations" || p.startsWith("/integrations/");
}

export function isDocsHubActive(path: string): boolean {
  const p = normalizePath(path);
  return p === SUITE_DOCS_HREF || p.startsWith(SUITE_DOCS_HREF + "/");
}

/** Active state for a child link inside a nav dropdown */
export function isLinkActive(path: string, href: string): boolean {
  const p = normalizePath(path);
  const h = normalizePath(href);
  if (h === "/") return p === "/";
  if (h === "/product") return p === "/product";
  if (h === "/use-cases") return p === "/use-cases";
  if (h === SUITE_DOCS_HREF) return p === SUITE_DOCS_HREF || p.startsWith(SUITE_DOCS_HREF + "/");
  if (h === "/keys") return p === "/keys";
  if (h === "/testing") return p === "/testing";
  if (h === "/graph") return p === "/graph";
  if (h === "/connect") return p === "/connect";
  return p === h || p.startsWith(h + "/");
}
