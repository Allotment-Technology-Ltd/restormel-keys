import { redirect } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";
import { JOURNEY_WORKSPACE_HOME_HREF, WORKSPACE_HOME_HREF } from "$lib/nav-config";
import { resolveLegacyDashboardRedirect } from "$lib/legacy-route-redirects";
import { MVP_MODULE_DEFAULTS } from "$lib/module-flags-types";

/**
 * Dashboard root → the default landing. The landing is flag-resolved (RES-113
 * PR-G): with `onboardingJourney` OFF the verified Answer Console (`/prove/proof`)
 * stays the workspace landing (Phase 3 Stage 1, byte-for-byte); ON the persistent
 * journey Home (`/home`) leads (REC-ADR-021 §3). Query string preserved either way.
 */
export const load: PageServerLoad = async ({ url, locals }) => {
  const moduleFlags = locals?.moduleFlags ?? MVP_MODULE_DEFAULTS;
  if (moduleFlags.onboardingJourney) {
    throw redirect(308, JOURNEY_WORKSPACE_HOME_HREF + (url.search ?? ""));
  }
  throw redirect(308, resolveLegacyDashboardRedirect(url.pathname, url.search) ?? WORKSPACE_HOME_HREF);
};
