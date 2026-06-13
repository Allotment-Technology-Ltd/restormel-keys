/**
 * Marketing site nav — Phase 2 W4 IA.
 * Developers dropdown removed; Dashboard + API reference are first-class.
 */
import { describe, it, expect } from "vitest";
import {
  GITHUB_REPO_URL,
  GITHUB_DISCUSSIONS_URL,
  SUITE_DOCS_HREF,
  API_REFERENCE_HREF,
  productNavLinks,
  companyNavLinks,
  capabilityLinksFromModules,
  keysPillarLinks,
  normalizePath,
  isProductNavActive,
  isCompanyNavActive,
  isKeysPillarActive,
  isLinkActive,
  isDocsHubActive,
  isIntegrationsActive,
} from "./site-nav";
import { DASHBOARD_BASE } from "$lib/dashboard-base";

describe("constants", () => {
  it("GITHUB_REPO_URL is the canonical GitHub URL", () => {
    expect(GITHUB_REPO_URL).toMatch(/^https:\/\/github\.com\//);
    expect(GITHUB_REPO_URL).toContain("restormel-keys");
  });

  it("GITHUB_DISCUSSIONS_URL derives from GITHUB_REPO_URL", () => {
    expect(GITHUB_DISCUSSIONS_URL).toBe(`${GITHUB_REPO_URL}/discussions`);
  });

  it("API_REFERENCE_HREF is the in-site Scalar path", () => {
    expect(API_REFERENCE_HREF).toBe("/keys/docs/api-reference");
  });

  it("SUITE_DOCS_HREF is /docs", () => {
    expect(SUITE_DOCS_HREF).toBe("/docs");
  });

  it("GITHUB_REPO_URL is the sole GitHub reference (no developerLinks export)", () => {
    // developerLinks was removed — GITHUB_REPO_URL is now only used directly in the footer.
    // This test documents the contract: GitHub is footer-only.
    expect(GITHUB_REPO_URL).toBeDefined();
    // productNavLinks must not contain any external GitHub link
    const ghInProduct = productNavLinks.filter((l) => l.href.includes("github.com"));
    expect(ghInProduct).toHaveLength(0);
  });
});

describe("productNavLinks", () => {
  it("includes Dashboard as a link", () => {
    const labels = productNavLinks.map((l) => l.label);
    expect(labels).toContain("Dashboard");
  });

  it("includes API reference as a link", () => {
    const item = productNavLinks.find((l) => l.label === "API reference");
    expect(item).toBeDefined();
    expect(item?.href).toBe(API_REFERENCE_HREF);
  });

  it("does NOT include an API portal external link", () => {
    const external = productNavLinks.filter((l) => l.external);
    expect(external).toHaveLength(0);
  });

  it("does NOT include a GitHub link", () => {
    const ghLinks = productNavLinks.filter((l) => l.href.includes("github.com"));
    expect(ghLinks).toHaveLength(0);
  });

  it("Dashboard href points to DASHBOARD_BASE", () => {
    const item = productNavLinks.find((l) => l.label === "Dashboard");
    expect(item?.href).toBe(DASHBOARD_BASE);
  });
});

describe("companyNavLinks", () => {
  it("contains Early access, Roadmap, and Changelog", () => {
    const labels = companyNavLinks.map((l) => l.label);
    expect(labels).toContain("Early access");
    expect(labels).toContain("Roadmap");
    expect(labels).toContain("Changelog");
  });
});

describe("normalizePath", () => {
  it("strips trailing slash", () => {
    expect(normalizePath("/foo/")).toBe("/foo");
  });

  it("returns / for empty or bare slash", () => {
    expect(normalizePath("/")).toBe("/");
    expect(normalizePath("")).toBe("/");
  });
});

describe("isProductNavActive", () => {
  it("activates on /", () => {
    expect(isProductNavActive("/")).toBe(true);
  });

  it("activates on /product", () => {
    expect(isProductNavActive("/product")).toBe(true);
  });

  it("activates on /use-cases", () => {
    expect(isProductNavActive("/use-cases")).toBe(true);
  });

  it("activates on /docs subtree", () => {
    expect(isProductNavActive("/docs")).toBe(true);
    expect(isProductNavActive("/docs/some-guide")).toBe(true);
  });

  it("activates on API reference path", () => {
    expect(isProductNavActive(API_REFERENCE_HREF)).toBe(true);
    expect(isProductNavActive(API_REFERENCE_HREF + "/endpoints")).toBe(true);
  });

  it("activates on /keys subtree", () => {
    expect(isProductNavActive("/keys")).toBe(true);
    expect(isProductNavActive("/keys/pricing")).toBe(true);
  });

  it("activates on DASHBOARD_BASE subtree", () => {
    expect(isProductNavActive(DASHBOARD_BASE)).toBe(true);
    expect(isProductNavActive(DASHBOARD_BASE + "/home")).toBe(true);
  });

  it("does NOT activate on /founders", () => {
    expect(isProductNavActive("/founders")).toBe(false);
  });
});

describe("isCompanyNavActive", () => {
  it("activates on /roadmap and /changelog", () => {
    expect(isCompanyNavActive("/roadmap")).toBe(true);
    expect(isCompanyNavActive("/changelog")).toBe(true);
  });

  it("does NOT activate on /", () => {
    expect(isCompanyNavActive("/")).toBe(false);
  });
});

describe("isDocsHubActive", () => {
  it("activates on /docs and sub-paths", () => {
    expect(isDocsHubActive("/docs")).toBe(true);
    expect(isDocsHubActive("/docs/overview")).toBe(true);
  });

  it("does NOT activate on /keys/docs", () => {
    expect(isDocsHubActive("/keys/docs")).toBe(false);
  });
});

describe("isIntegrationsActive", () => {
  it("activates on /integrations and sub-paths", () => {
    expect(isIntegrationsActive("/integrations")).toBe(true);
    expect(isIntegrationsActive("/integrations/stripe")).toBe(true);
  });

  it("does NOT activate on /", () => {
    expect(isIntegrationsActive("/")).toBe(false);
  });
});

describe("isLinkActive", () => {
  it("matches / exactly", () => {
    expect(isLinkActive("/", "/")).toBe(true);
    expect(isLinkActive("/product", "/")).toBe(false);
  });

  it("matches /product exactly", () => {
    expect(isLinkActive("/product", "/product")).toBe(true);
    expect(isLinkActive("/product/sub", "/product")).toBe(false);
  });

  it("matches /use-cases exactly", () => {
    expect(isLinkActive("/use-cases", "/use-cases")).toBe(true);
    expect(isLinkActive("/use-cases/ai", "/use-cases")).toBe(false);
  });

  it("matches /docs subtree for SUITE_DOCS_HREF", () => {
    expect(isLinkActive("/docs", SUITE_DOCS_HREF)).toBe(true);
    expect(isLinkActive("/docs/guide", SUITE_DOCS_HREF)).toBe(true);
    expect(isLinkActive("/keys/docs", SUITE_DOCS_HREF)).toBe(false);
  });

  it("matches API reference subtree", () => {
    expect(isLinkActive(API_REFERENCE_HREF, API_REFERENCE_HREF)).toBe(true);
    expect(isLinkActive(API_REFERENCE_HREF + "/endpoints", API_REFERENCE_HREF)).toBe(true);
    expect(isLinkActive("/keys/docs/other", API_REFERENCE_HREF)).toBe(false);
  });

  it("matches /keys exactly (not sub-paths)", () => {
    expect(isLinkActive("/keys", "/keys")).toBe(true);
    expect(isLinkActive("/keys/pricing", "/keys")).toBe(false);
  });
});

describe("isKeysPillarActive", () => {
  it("activates on /keys and DASHBOARD_BASE", () => {
    expect(isKeysPillarActive("/keys")).toBe(true);
    expect(isKeysPillarActive(DASHBOARD_BASE)).toBe(true);
    expect(isKeysPillarActive(DASHBOARD_BASE + "/home")).toBe(true);
  });
});

describe("capabilityLinksFromModules", () => {
  it("maps suite modules to SiteNavLinks", () => {
    const fakeModules = [
      { href: "/keys", navLabel: "Keys" },
      { href: "/testing", navLabel: "Testing" },
    ] as Parameters<typeof capabilityLinksFromModules>[0];
    const links = capabilityLinksFromModules(fakeModules);
    expect(links).toEqual([
      { href: "/keys", label: "Keys" },
      { href: "/testing", label: "Testing" },
    ]);
  });
});
