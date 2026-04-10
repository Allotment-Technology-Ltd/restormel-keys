/**
 * GitHub releases for the canonical repo (marketing changelog). 1h in-memory cache.
 * Optional GITHUB_TOKEN for higher API rate limits. No response bodies logged.
 */
import { GITHUB_REPO_URL } from "$lib/site-nav";
import { renderReleaseMarkdown } from "$lib/server/changelog-markdown";

const TTL_MS = 60 * 60 * 1000;
const PER_PAGE = 100;

export type ChangelogRelease = {
  tag: string;
  name: string;
  publishedLabel: string;
  bodyHtml: string;
  url: string;
};

type CacheEntry = { releases: ChangelogRelease[]; expiresAt: number };

let cache: CacheEntry | null = null;

function parseOwnerRepo(repoUrl: string): { owner: string; repo: string } | null {
  const m = repoUrl.trim().match(/github\.com\/([^/]+)\/([^/#?]+)/i);
  if (!m) return null;
  return { owner: m[1], repo: m[2].replace(/\.git$/i, "") };
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function formatPublishedLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const day = String(d.getUTCDate()).padStart(2, "0");
  const mon = MONTHS[d.getUTCMonth()] ?? "";
  const year = d.getUTCFullYear();
  return `${day} ${mon} ${year}`;
}

interface GhRelease {
  tag_name?: string;
  name?: string;
  published_at?: string | null;
  body?: string | null;
  draft?: boolean;
  html_url?: string;
}

async function fetchReleasesFromGitHub(owner: string, repo: string): Promise<ChangelogRelease[]> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "restormel-dashboard-changelog",
  };
  const token = (process.env.GITHUB_TOKEN ?? "").trim();
  if (token) headers.Authorization = `Bearer ${token}`;

  const url = `https://api.github.com/repos/${owner}/${repo}/releases?per_page=${PER_PAGE}`;
  const res = await fetch(url, { headers, signal: AbortSignal.timeout(20_000) });
  if (!res.ok) return [];

  const raw = (await res.json().catch(() => [])) as unknown;
  if (!Array.isArray(raw)) return [];

  const out: ChangelogRelease[] = [];
  for (const item of raw) {
    const r = item as GhRelease;
    if (r.draft || !r.published_at || !r.tag_name) continue;
    const publishedLabel = formatPublishedLabel(r.published_at);
    if (!publishedLabel) continue;
    out.push({
      tag: r.tag_name,
      name: (r.name && r.name.trim()) || r.tag_name,
      publishedLabel,
      bodyHtml: renderReleaseMarkdown(r.body ?? ""),
      url: r.html_url ?? `${GITHUB_REPO_URL}/releases/tag/${encodeURIComponent(r.tag_name)}`,
    });
  }

  return out;
}

/**
 * Newest releases first. Empty array when the API fails or there are no published releases.
 */
export async function getChangelogReleases(): Promise<ChangelogRelease[]> {
  const now = Date.now();
  if (cache && cache.expiresAt > now) return cache.releases;

  const parsed = parseOwnerRepo(GITHUB_REPO_URL);
  let releases: ChangelogRelease[] = [];
  if (parsed) {
    try {
      releases = await fetchReleasesFromGitHub(parsed.owner, parsed.repo);
    } catch {
      releases = [];
    }
  }

  cache = { releases, expiresAt: now + TTL_MS };
  return releases;
}
