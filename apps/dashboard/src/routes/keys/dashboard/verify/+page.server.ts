import { redirect } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";
import { resolveLegacyDashboardRedirect } from "$lib/legacy-route-redirects";
import { CLAIMS_HREF } from "$lib/nav-config";

/**
 * RES-113 PR-G — `/verify` (M2) journey section-alias. Additive verb-spine route
 * surfaced only via the journey nav (onboardingJourney ON). Resolves to the M2
 * make-ready / stamping desk (claim triage + trust gates). Query string preserved.
 */
export const load: PageServerLoad = ({ url }) => {
  throw redirect(308, resolveLegacyDashboardRedirect(url.pathname, url.search) ?? CLAIMS_HREF);
};
