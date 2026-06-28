import { error, redirect } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";
import { resolveLegacyDashboardRedirect } from "$lib/legacy-route-redirects";
import { INGEST_FLOW_HREF } from "$lib/nav-config";
import { MVP_MODULE_DEFAULTS } from "$lib/module-flags-types";

/**
 * RES-113 PR-G — `/build` (M1) journey section-alias. Additive verb-spine route
 * surfaced ONLY under the journey nav (onboardingJourney ON), where it resolves to
 * the M1 ingest guided flow (reskinned under the same flag, PR-C). With the flag
 * OFF this route does not exist (404) — preserving the pre-PR-G behaviour
 * byte-for-byte, so the supersede cut stays fully reversible. Query string preserved.
 */
export const load: PageServerLoad = ({ url, locals }) => {
  const moduleFlags = locals?.moduleFlags ?? MVP_MODULE_DEFAULTS;
  if (!moduleFlags.onboardingJourney) throw error(404);
  throw redirect(308, resolveLegacyDashboardRedirect(url.pathname, url.search) ?? INGEST_FLOW_HREF);
};
