import { redirect } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";
import { resolveLegacyDashboardRedirect } from "$lib/legacy-route-redirects";
import { HOME_HREF } from "$lib/nav-config";

/** R2 — `/activity` merged into the one Home (redesign §2.3). */
export const load: PageServerLoad = ({ url }) => {
  throw redirect(308, resolveLegacyDashboardRedirect(url.pathname, url.search) ?? HOME_HREF);
};
