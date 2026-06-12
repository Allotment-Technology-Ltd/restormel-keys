import { redirect } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";
import { HOME_HREF } from "$lib/nav-config";
import { resolveLegacyDashboardRedirect } from "$lib/legacy-route-redirects";

/**
 * R2 — the Connect hub is dissolved (redesign §2.3). Every `/connect/*` URL
 * 308-redirects to its new top-level section, query params preserved.
 * Redirects are for external/bookmark traffic; in-app links use the new URLs.
 */
export const load: PageServerLoad = ({ url }) => {
  const target = resolveLegacyDashboardRedirect(url.pathname, url.search);
  throw redirect(308, target ?? HOME_HREF);
};
