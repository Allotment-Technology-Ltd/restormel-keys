import type { PageServerLoad } from "./$types";
import { loadPublicRecords } from "$lib/server/records/gate";

// Build-time gate: the index of published legal documents is prerendered from the
// PUBLIC record set only. internal/confidential/restricted are filtered before render,
// so they never reach the static output or the client bundle.
export const prerender = true;

export const load: PageServerLoad = () => {
  const records = loadPublicRecords({ class: "legal" }).map((r) => ({
    slug: r.slug,
    title: r.title,
    effectiveDate: r.effectiveDate,
    versionCount: r.versions.length,
  }));
  return { records };
};
