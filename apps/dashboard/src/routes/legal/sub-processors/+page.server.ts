import type { PageServerLoad } from "./$types";
import { loadPublicRecordBySlug } from "$lib/server/records/gate";
import { renderRecordBody } from "$lib/server/records/record-markdown";
import { loadSubProcessors } from "$lib/server/records/subprocessors";

// Published view of governance/suppliers.yaml. The intro framing comes from the gated public
// record (legal/sub-processors.md); the live list comes from suppliers.yaml (public fields only).
export const prerender = true;

export const load: PageServerLoad = () => {
  const rec = loadPublicRecordBySlug("sub-processors");
  return {
    title: rec?.title ?? "Sub-processors",
    effectiveDate: rec?.effectiveDate ?? "",
    introHtml: rec ? renderRecordBody(rec.body) : "",
    subprocessors: loadSubProcessors(),
    versions: rec?.versions ?? [],
  };
};
