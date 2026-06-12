import { env } from "$env/dynamic/private";
import type { PageServerLoad } from "./$types";
import {
  DEFAULT_KEYS_GITHUB_REPO_FULL_NAME,
  DEFAULT_KEYS_NPM_PACKAGE,
  depsDevPackageUrl,
  fetchLibrariesIoDependentRepos,
  fetchNpmVersionDownloadsLastWeek,
  githubNetworkDependentsUrl,
  librariesIoPackageUrl,
  npmPackageWebUrl,
} from "$lib/server/npm-package-insights";
import { requireServiceAdminSession } from "$lib/server/session-user";

export const load: PageServerLoad = async ({ fetch, locals }) => {
  // W4.6a SECURITY: defense-in-depth — admin-only surface; gate before any work even if
  // the layout gate were ever changed.
  requireServiceAdminSession(locals);
  const packageName = (env.RESTORMEL_NPM_INSIGHTS_PACKAGE ?? DEFAULT_KEYS_NPM_PACKAGE).trim() || DEFAULT_KEYS_NPM_PACKAGE;
  const githubRepoFullName =
    (env.RESTORMEL_NPM_INSIGHTS_GITHUB_REPO ?? DEFAULT_KEYS_GITHUB_REPO_FULL_NAME).trim() ||
    DEFAULT_KEYS_GITHUB_REPO_FULL_NAME;

  const [versionDownloads, dependents] = await Promise.all([
    fetchNpmVersionDownloadsLastWeek(packageName, fetch),
    fetchLibrariesIoDependentRepos(packageName, githubRepoFullName, fetch, {
      apiKey: env.LIBRARIES_IO_API_KEY,
    }),
  ]);

  return {
    packageName,
    githubRepoFullName,
    versionDownloads,
    dependents,
    links: {
      npm: npmPackageWebUrl(packageName),
      githubDependents: githubNetworkDependentsUrl(githubRepoFullName),
      depsDev: depsDevPackageUrl(packageName),
      librariesIo: librariesIoPackageUrl(packageName),
    },
  };
};
