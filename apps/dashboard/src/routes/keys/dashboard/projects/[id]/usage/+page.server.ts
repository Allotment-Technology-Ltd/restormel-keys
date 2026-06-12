import { redirect } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";
import { resolveLegacyDashboardRedirect } from "$lib/legacy-route-redirects";
import { DASHBOARD_BASE } from "$lib/dashboard-base";

/** KILL with redirect (D8 / redesign §2.3): the stub linked to Analytics anyway. */
export const load: PageServerLoad = ({ url, params }) => {
  throw redirect(
    308,
    resolveLegacyDashboardRedirect(url.pathname, url.search) ??
      `${DASHBOARD_BASE}/analytics?project=${encodeURIComponent(params.id)}`,
  );
};
