import { redirect } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";
import { DASHBOARD_BASE } from "$lib/dashboard-base";

/** Redirect typo URL copy-for-cli → copy-for-ci (CI = continuous integration). */
export const load: PageServerLoad = () => {
  throw redirect(302, DASHBOARD_BASE + "/copy-for-ci");
};
