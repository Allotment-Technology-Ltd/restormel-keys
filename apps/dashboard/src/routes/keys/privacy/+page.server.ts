import { error } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";
import { loadPublicRecordBySlug } from "$lib/server/records/gate";
import { renderRecordBody } from "$lib/server/records/record-markdown";

// Renders the migrated legal record (legal/privacy-policy.md) at the original URL. Build-time
// gated: only served if the record is public + approved.
export const prerender = true;

export const load: PageServerLoad = () => {
  const rec = loadPublicRecordBySlug("privacy-policy");
  if (!rec) error(404, "Not found");
  return { title: rec.title, effectiveDate: rec.effectiveDate, html: renderRecordBody(rec.body) };
};
