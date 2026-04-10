import type { PageServerLoad } from "./$types";
import { getChangelogReleases } from "$lib/server/github-releases";

export const load: PageServerLoad = async ({ setHeaders }) => {
  setHeaders({
    "cache-control": "public, max-age=0, s-maxage=3600",
  });

  const releases = await getChangelogReleases();
  return { releases };
};
