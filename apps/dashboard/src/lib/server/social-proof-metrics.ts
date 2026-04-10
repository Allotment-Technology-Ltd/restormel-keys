/**
 * Fetches GitHub stars + aggregated npm downloads (rolling 30 days) with a 1h in-memory cache.
 * No secrets logged. Optional GITHUB_TOKEN increases API rate limits.
 */
import {
  GITHUB_REPO_URL,
  githubRepoPathFromUrl,
  SOCIAL_PROOF_NPM_PACKAGES,
  type SocialProofMetrics,
} from "$lib/social-proof";

const TTL_MS = 60 * 60 * 1000;

type CacheEntry = { value: SocialProofMetrics | null; expiresAt: number };

let cache: CacheEntry | null = null;

function rolling30DayRangeUtc(): { start: string; end: string } {
  const end = new Date();
  const start = new Date(end.getTime());
  start.setUTCDate(start.getUTCDate() - 29);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { start: iso(start), end: iso(end) };
}

async function fetchGitHubStars(ownerRepo: string): Promise<number | null> {
  const [owner, repo] = ownerRepo.split("/");
  if (!owner || !repo) return null;

  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "restormel-dashboard-social-proof",
  };
  const token = (process.env.GITHUB_TOKEN ?? "").trim();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
    headers,
    signal: AbortSignal.timeout(12_000),
  });
  if (!res.ok) return null;

  const body = (await res.json().catch(() => ({}))) as { stargazers_count?: number };
  const n = body.stargazers_count;
  return typeof n === "number" && Number.isFinite(n) ? n : null;
}

async function fetchNpmDownloads30d(pkg: string, start: string, end: string): Promise<number | null> {
  const enc = encodeURIComponent(pkg);
  const url = `https://api.npmjs.org/downloads/point/${start}:${end}/${enc}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(12_000) });
  if (!res.ok) return null;
  const body = (await res.json().catch(() => ({}))) as { downloads?: number; error?: string };
  if (body.error || typeof body.downloads !== "number" || !Number.isFinite(body.downloads)) return null;
  return body.downloads;
}

async function fetchAggregatedMetrics(): Promise<SocialProofMetrics | null> {
  const ownerRepo = githubRepoPathFromUrl(GITHUB_REPO_URL);
  const { start, end } = rolling30DayRangeUtc();

  const [stars, ...npmParts] = await Promise.all([
    fetchGitHubStars(ownerRepo),
    ...SOCIAL_PROOF_NPM_PACKAGES.map((pkg) => fetchNpmDownloads30d(pkg, start, end)),
  ]);

  if (stars == null || stars < 1) return null;

  let npmDownloads30d = 0;
  for (const d of npmParts) {
    if (d == null || d < 0) return null;
    npmDownloads30d += d;
  }
  if (npmDownloads30d < 1) return null;

  return { stars, npmDownloads30d };
}

/**
 * Returns live metrics or null (fetch failure or zero/invalid). Cached 1h including null results.
 */
export async function getSocialProofMetrics(): Promise<SocialProofMetrics | null> {
  const now = Date.now();
  if (cache && cache.expiresAt > now) return cache.value;

  let value: SocialProofMetrics | null = null;
  try {
    value = await fetchAggregatedMetrics();
  } catch {
    value = null;
  }

  cache = { value, expiresAt: now + TTL_MS };
  return value;
}
