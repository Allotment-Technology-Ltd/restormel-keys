/**
 * R5: /access/audit → /prove/audit (D5 approved: audit log is a proof artefact).
 * This 308 permanent redirect keeps deep links from /access working.
 * The audit content now lives in Prove / Audit tab.
 */
import { redirect } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";
import { DASHBOARD_BASE } from "$lib/dashboard-base";

export const load: PageServerLoad = ({ url }) => {
  const search = url.search && url.search !== "?" ? url.search : "";
  throw redirect(308, DASHBOARD_BASE + "/prove/audit" + search);
};
