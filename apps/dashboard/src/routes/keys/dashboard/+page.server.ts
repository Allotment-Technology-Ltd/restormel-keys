import { redirect } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";
import { HOME_HREF } from "$lib/nav-config";
import { resolveLegacyDashboardRedirect } from "$lib/legacy-route-redirects";

/** Dashboard root → the one Home (redesign §2.3: redirect → `/home`), query preserved. */
export const load: PageServerLoad = async ({ url }) => {
  throw redirect(308, resolveLegacyDashboardRedirect(url.pathname, url.search) ?? HOME_HREF);
};
