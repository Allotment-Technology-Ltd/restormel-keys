import { error } from "@sveltejs/kit";
import type { EntryGenerator, PageServerLoad } from "./$types";
import { loadPublicRecords, loadPublicRecordBySlug } from "$lib/server/records/gate";
import { renderRecordBody } from "$lib/server/records/record-markdown";

// Build-time gate. Only PUBLIC + APPROVED legal records are enumerated for prerender; any other
// slug is never built (→ 404), so a non-public/non-approved record can never be served here.
// `sub-processors` has a dedicated route (published view of suppliers.yaml), so it's excluded.
export const prerender = true;

export const entries: EntryGenerator = () =>
  loadPublicRecords({ class: "legal" })
    .filter((r) => r.slug !== "sub-processors")
    .map((r) => ({ slug: r.slug }));

export const load: PageServerLoad = ({ params }) => {
  const rec = loadPublicRecordBySlug(params.slug);
  if (!rec || rec.class !== "legal" || rec.slug === "sub-processors") error(404, "Document not found");
  return {
    title: rec.title,
    effectiveDate: rec.effectiveDate,
    html: renderRecordBody(rec.body),
    versions: rec.versions,
  };
};
