import type { PageServerLoad } from "./$types";
import { redirect } from "@sveltejs/kit";
import { DASHBOARD_BASE } from "$lib/dashboard-base";

export const load: PageServerLoad = async ({ locals, url }) => {
  if (!locals.user) {
    throw redirect(302, `${DASHBOARD_BASE}/login?redirect=${encodeURIComponent(url.pathname)}`);
  }
  return {};
};
