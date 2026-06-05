import { redirect } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";
import { buildPostAuthLocation } from "$lib/server/auth-return-cookie";
import { safeDashboardRedirectPath } from "$lib/dashboard-entry";
import { isUseCaseId } from "$lib/content/use-cases";

/** Signed-in users should not see the login form again. */
export const load: PageServerLoad = async ({ locals, url }) => {
  if (locals.user?.uid) {
    const template = url.searchParams.get("template");
    const location = buildPostAuthLocation(
      url.origin,
      {
        redirect: safeDashboardRedirectPath(url.searchParams.get("redirect")),
        template: template && isUseCaseId(template) ? template : undefined,
      },
      safeDashboardRedirectPath(null),
    );
    throw redirect(302, location);
  }
  return {};
};
