import { redirect } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";
import { DASHBOARD_BASE } from "$lib/dashboard-base";

/** Signed-in users use the canonical Testing hub inside the Keys dashboard. */
export const load: PageServerLoad = async ({ locals }) => {
  if (locals.user) {
    throw redirect(302, `${DASHBOARD_BASE}/testing`);
  }
  return {};
};
