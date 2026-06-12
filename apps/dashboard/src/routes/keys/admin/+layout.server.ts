import { redirect } from "@sveltejs/kit";
import type { LayoutServerLoad } from "./$types";
import { DASHBOARD_BASE } from "$lib/dashboard-base";
import { sessionUser } from "$lib/server/session-user";

export const load: LayoutServerLoad = async ({ locals, url }) => {
  const dash = DASHBOARD_BASE.endsWith("/") ? DASHBOARD_BASE.slice(0, -1) : DASHBOARD_BASE;
  const user = sessionUser(locals);
  // W4.6a: don't bounce to login when auth verification merely errored — surface the
  // degraded state instead of silently signing the operator out on an infra blip.
  if (!user) {
    if (locals.authDegraded) {
      return { authDegraded: true };
    }
    throw redirect(302, `${dash}/login?redirect=${encodeURIComponent(url.pathname)}`);
  }
  if (!user.isServiceAdmin) {
    throw redirect(302, `${dash}/`);
  }
  return { authDegraded: false };
};
