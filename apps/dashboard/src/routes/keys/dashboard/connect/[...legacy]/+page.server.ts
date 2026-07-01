import { redirect } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";
import { AGENTS_WIRING_HREF, CONNECT_HUB_HREF, HOME_HREF } from "$lib/nav-config";
import { resolveLegacyDashboardRedirect } from "$lib/legacy-route-redirects";
import { MVP_MODULE_DEFAULTS } from "$lib/module-flags-types";

/**
 * R2 — the Connect hub is dissolved (redesign §2.3). Every `/connect/*` URL
 * 308-redirects to its new top-level section, query params preserved.
 * Redirects are for external/bookmark traffic; in-app links use the new URLs.
 *
 * RES-113 PR-G — the journey IA re-consolidates Connect (M4): with
 * `onboardingJourney` ON the BARE `/connect` path is the Connect nav destination
 * and 308s to the M4 wiring surface. With the flag OFF this branch is skipped and
 * the legacy `/connect → /home` (and every `/connect/*` sub-redirect) behaviour is
 * unchanged byte-for-byte.
 */
export const load: PageServerLoad = ({ url, locals }) => {
  const moduleFlags = locals?.moduleFlags ?? MVP_MODULE_DEFAULTS;
  if (
    moduleFlags.onboardingJourney &&
    (url.pathname === CONNECT_HUB_HREF || url.pathname === CONNECT_HUB_HREF + "/")
  ) {
    throw redirect(308, AGENTS_WIRING_HREF + (url.search ?? ""));
  }
  const target = resolveLegacyDashboardRedirect(url.pathname, url.search);
  throw redirect(308, target ?? HOME_HREF);
};
