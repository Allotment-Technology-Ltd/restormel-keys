import { redirect } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";
import { resolveLegacyDashboardRedirect } from "$lib/legacy-route-redirects";
import { INGEST_FLOW_HREF } from "$lib/nav-config";

/**
 * RES-113 PR-G — `/build` (M1) journey section-alias. Additive verb-spine route
 * surfaced only via the journey nav (onboardingJourney ON). Resolves to the M1
 * ingest guided flow, which reskins under the flag (PR-C). Query string preserved.
 */
export const load: PageServerLoad = ({ url }) => {
  throw redirect(308, resolveLegacyDashboardRedirect(url.pathname, url.search) ?? INGEST_FLOW_HREF);
};
