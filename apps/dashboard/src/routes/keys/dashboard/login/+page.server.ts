import { redirect } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";
import { safeDashboardRedirectPath } from "$lib/dashboard-entry";

/** Signed-in users should not see the login form again. */
export const load: PageServerLoad = async ({ locals, url }) => {
  if (locals.user?.uid) {
    throw redirect(302, safeDashboardRedirectPath(url.searchParams.get("redirect")));
  }
  return {};
};
