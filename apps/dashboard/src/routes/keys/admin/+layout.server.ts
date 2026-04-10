import { redirect } from "@sveltejs/kit";
import type { LayoutServerLoad } from "./$types";
import { DASHBOARD_BASE } from "$lib/dashboard-base";

export const load: LayoutServerLoad = async ({ locals, url }) => {
  const dash = DASHBOARD_BASE.endsWith("/") ? DASHBOARD_BASE.slice(0, -1) : DASHBOARD_BASE;
  if (!locals.user || locals.user.authType !== "session") {
    throw redirect(302, `${dash}/login?redirect=${encodeURIComponent(url.pathname)}`);
  }
  if (!locals.user.isServiceAdmin) {
    throw redirect(302, `${dash}/`);
  }
  return {};
};
