/**
 * Server-only helpers: npm registry download breakdown + Libraries.io dependent repos.
 * Pass apiKey from `$env/dynamic/private` in route loaders (never expose to the client).
 */

export const DEFAULT_KEYS_NPM_PACKAGE = "@restormel/keys";
export const DEFAULT_KEYS_GITHUB_REPO_FULL_NAME = "Allotment-Technology-Ltd/restormel-keys";

export type NpmVersionRow = { version: string; downloads: number; isLatest: boolean };

export type NpmVersionDownloadsLoad =
  | { ok: true; package: string; rows: NpmVersionRow[]; totalDownloads: number }
  | { ok: false; error: string };

export type DependentRepo = {
  fullName: string;
  repoUrl: string;
  description: string | null;
  language: string | null;
  stars: number;
  pushedAt: string | null;
};

export type LibrariesIoDependentsLoad =
  | {
      ok: true;
      repos: DependentRepo[];
      externalRepos: DependentRepo[];
      monorepoFullName: string;
      pagesFetched: number;
      truncated: boolean;
    }
  | { ok: false; error: string; status?: number };

export type NpmLatestLoad = { ok: true; version: string } | { ok: false; error: string };

/** URL path segment for Libraries.io npm API (scoped packages must be percent-encoded). */
export function librariesIoNpmPathSegment(packageName: string): string {
  return encodeURIComponent(packageName.trim());
}

function semverSegmentNumeric(part: string): number {
  const m = /^(\d+)/.exec(part.trim());
  return m ? parseInt(m[1], 10) : 0;
}

/** Descending sort for typical numeric semver segments (x.y.z). */
export function compareSemverDesc(a: string, b: string): number {
  const pa = a.split(".").map(semverSegmentNumeric);
  const pb = b.split(".").map(semverSegmentNumeric);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const da = pa[i] ?? 0;
    const db = pb[i] ?? 0;
    if (da !== db) return db - da;
  }
  return 0;
}

export function partitionMonorepo(
  repos: DependentRepo[],
  monorepoFullName: string
): { externalRepos: DependentRepo[] } {
  const norm = monorepoFullName.trim().toLowerCase();
  const externalRepos = repos.filter((r) => r.fullName.toLowerCase() !== norm);
  return { externalRepos };
}

function githubRepoUrl(fullName: string): string {
  return `https://github.com/${fullName}`;
}

export async function fetchNpmLatestVersion(
  packageName: string,
  requestFetch: typeof fetch
): Promise<NpmLatestLoad> {
  const url = `https://registry.npmjs.org/${encodeURIComponent(packageName)}/latest`;
  try {
    const res = await requestFetch(url, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) {
      return { ok: false, error: `npm registry returned ${res.status}` };
    }
    const body = (await res.json()) as { version?: string };
    const v = body.version?.trim();
    if (!v) return { ok: false, error: "npm registry: missing version" };
    return { ok: true, version: v };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown error";
    return { ok: false, error: msg };
  }
}

export async function fetchNpmVersionDownloadsLastWeek(
  packageName: string,
  requestFetch: typeof fetch
): Promise<NpmVersionDownloadsLoad> {
  const versionsUrl = `https://api.npmjs.org/versions/${encodeURIComponent(packageName)}/last-week`;
  try {
    const [res, latestRes] = await Promise.all([
      requestFetch(versionsUrl, {
        headers: { accept: "application/json" },
        signal: AbortSignal.timeout(12_000),
      }),
      fetchNpmLatestVersion(packageName, requestFetch),
    ]);
    if (!res.ok) {
      return { ok: false, error: `npm downloads API returned ${res.status}` };
    }
    const body = (await res.json()) as { package?: string; downloads?: Record<string, number> };
    const downloads = body.downloads;
    if (!downloads || typeof downloads !== "object") {
      return { ok: false, error: "npm downloads API: unexpected shape" };
    }
    const versions = Object.keys(downloads);
    const latest = latestRes.ok ? latestRes.version : null;

    let total = 0;
    const rows: NpmVersionRow[] = versions.map((version) => {
      const n = downloads[version] ?? 0;
      total += n;
      return {
        version,
        downloads: n,
        isLatest: latest !== null && version === latest,
      };
    });
    rows.sort((x, y) => {
      if (y.downloads !== x.downloads) return y.downloads - x.downloads;
      return compareSemverDesc(x.version, y.version);
    });
    return { ok: true, package: body.package ?? packageName, rows, totalDownloads: total };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown error";
    return { ok: false, error: msg };
  }
}

type LibrariesIoRepoJson = {
  full_name?: string;
  description?: string | null;
  language?: string | null;
  stargazers_count?: number;
  pushed_at?: string | null;
};

function mapLibrariesIoRepo(raw: LibrariesIoRepoJson): DependentRepo | null {
  const fullName = raw.full_name?.trim();
  if (!fullName) return null;
  return {
    fullName,
    repoUrl: githubRepoUrl(fullName),
    description: raw.description ?? null,
    language: raw.language ?? null,
    stars: typeof raw.stargazers_count === "number" ? raw.stargazers_count : 0,
    pushedAt: raw.pushed_at ?? null,
  };
}

const LIBRARIES_IO_MAX_PAGES = 8;
const LIBRARIES_IO_PER_PAGE = 100;

export async function fetchLibrariesIoDependentRepos(
  packageName: string,
  monorepoFullName: string,
  requestFetch: typeof fetch,
  options?: { apiKey?: string }
): Promise<LibrariesIoDependentsLoad> {
  const pathSeg = librariesIoNpmPathSegment(packageName);
  const apiKey = options?.apiKey?.trim();
  const seen = new Set<string>();
  const repos: DependentRepo[] = [];
  let pagesFetched = 0;
  let truncated = false;

  try {
    for (let page = 1; page <= LIBRARIES_IO_MAX_PAGES; page++) {
      const q = new URLSearchParams({ per_page: String(LIBRARIES_IO_PER_PAGE), page: String(page) });
      if (apiKey) q.set("api_key", apiKey);
      const url = `https://libraries.io/api/npm/${pathSeg}/dependent_repositories?${q.toString()}`;
      const res = await requestFetch(url, {
        headers: { accept: "application/json" },
        signal: AbortSignal.timeout(15_000),
      });
      if (res.status === 429) {
        return { ok: false, error: "Libraries.io rate limit (429). Set LIBRARIES_IO_API_KEY or retry later.", status: 429 };
      }
      if (!res.ok) {
        return {
          ok: false,
          error: `Libraries.io returned ${res.status}`,
          status: res.status,
        };
      }
      const chunk = (await res.json()) as LibrariesIoRepoJson[];
      if (!Array.isArray(chunk) || chunk.length === 0) break;
      pagesFetched += 1;
      for (const raw of chunk) {
        const row = mapLibrariesIoRepo(raw);
        if (row && !seen.has(row.fullName)) {
          seen.add(row.fullName);
          repos.push(row);
        }
      }
      if (chunk.length < LIBRARIES_IO_PER_PAGE) break;
    }
    if (pagesFetched >= LIBRARIES_IO_MAX_PAGES) truncated = true;

    const { externalRepos } = partitionMonorepo(repos, monorepoFullName);
    externalRepos.sort((a, b) => b.stars - a.stars || a.fullName.localeCompare(b.fullName));

    return {
      ok: true,
      repos,
      externalRepos,
      monorepoFullName,
      pagesFetched,
      truncated,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown error";
    return { ok: false, error: msg };
  }
}

export function npmPackageWebUrl(packageName: string): string {
  return `https://www.npmjs.com/package/${encodeURIComponent(packageName)}`;
}

export function githubNetworkDependentsUrl(repoFullName: string): string {
  const [owner, repo] = repoFullName.split("/");
  if (!owner || !repo) return "https://github.com/";
  return `https://github.com/${owner}/${repo}/network/dependents`;
}

export function depsDevPackageUrl(packageName: string): string {
  return `https://deps.dev/npm/${encodeURIComponent(packageName)}`;
}

export function librariesIoPackageUrl(packageName: string): string {
  return `https://libraries.io/npm/${encodeURIComponent(packageName)}`;
}
