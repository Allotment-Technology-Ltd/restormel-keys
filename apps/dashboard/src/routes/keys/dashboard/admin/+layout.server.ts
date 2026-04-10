import { redirect } from "@sveltejs/kit";
import type { LayoutServerLoad } from "./$types";
import { DASHBOARD_BASE } from "$lib/dashboard-base";

export const load: LayoutServerLoad = async ({ locals }) => {
  if (!locals.user?.isServiceAdmin) {
    const base = DASHBOARD_BASE.endsWith("/") ? DASHBOARD_BASE.slice(0, -1) : DASHBOARD_BASE;
    throw redirect(302, `${base}/settings`);
  }
  return {};
};
