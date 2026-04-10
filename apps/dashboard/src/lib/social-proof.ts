/**
 * Social proof — shared constants and shield URLs (client-safe).
 * NPM download totals aggregate these published packages (prompt asked for @restormel/testing; npm uses @restormel/testing-core).
 */
import { GITHUB_REPO_URL } from "$lib/site-nav";

export type SocialProofMetrics = {
  stars: number;
  /** Sum of last-30-day downloads across {@link SOCIAL_PROOF_NPM_PACKAGES}. */
  npmDownloads30d: number;
};

/** Published packages whose download counts are summed for the homepage metric. */
export const SOCIAL_PROOF_NPM_PACKAGES = [
  "@restormel/keys",
  "@restormel/graph-core",
  "@restormel/testing-core",
] as const;

/** Primary package page for the npm shields badge link. */
export const NPM_PACKAGE_KEYS_URL = "https://www.npmjs.com/package/@restormel/keys";

export function githubRepoPathFromUrl(repoUrl: string): string {
  return repoUrl.replace(/^https?:\/\/github\.com\//i, "").replace(/\/$/, "");
}

export function socialProofShieldStarsUrl(repoUrl: string = GITHUB_REPO_URL): string {
  const path = githubRepoPathFromUrl(repoUrl);
  return `https://img.shields.io/github/stars/${path}?style=flat&logo=github&label=stars`;
}

/** Representative npm badge (Keys); live homepage total sums multiple packages. */
export function socialProofShieldNpmKeysUrl(): string {
  return "https://img.shields.io/npm/dm/@restormel/keys?style=flat&logo=npm&label=npm%20downloads";
}

export function formatCount(n: number): string {
  return new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 }).format(n);
}

export { GITHUB_REPO_URL };
