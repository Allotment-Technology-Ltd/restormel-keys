import { redirect } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";
import { DASHBOARD_BASE } from "$lib/dashboard-base";

export const load: PageServerLoad = async ({ locals, url }) => {
  if (!locals.user || locals.user.authType !== "session") {
    throw redirect(302, `${DASHBOARD_BASE}/login?redirect=${encodeURIComponent(url.pathname)}`);
  }
  if (locals.user.foundersCircleApproved || locals.user.isServiceAdmin) {
    throw redirect(302, `${DASHBOARD_BASE}/`);
  }
  return { user: locals.user };
};
