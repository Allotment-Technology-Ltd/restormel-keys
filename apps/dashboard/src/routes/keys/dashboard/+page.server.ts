import { redirect } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";
import { WORKSPACE_HOME_HREF } from "$lib/nav-config";
import { resolveLegacyDashboardRedirect } from "$lib/legacy-route-redirects";

/**
 * Dashboard root → the default landing. Phase 3 Stage 1 makes the verified Answer
 * Console (`/prove/proof`) the workspace landing; query string preserved.
 */
export const load: PageServerLoad = async ({ url }) => {
  throw redirect(308, resolveLegacyDashboardRedirect(url.pathname, url.search) ?? WORKSPACE_HOME_HREF);
};
