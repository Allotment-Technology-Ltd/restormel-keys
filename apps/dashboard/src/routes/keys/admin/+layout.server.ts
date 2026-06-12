import { error, redirect } from "@sveltejs/kit";
import type { LayoutServerLoad } from "./$types";
import { DASHBOARD_BASE } from "$lib/dashboard-base";
import { sessionUser } from "$lib/server/session-user";

export const load: LayoutServerLoad = async ({ locals, url }) => {
  const dash = DASHBOARD_BASE.endsWith("/") ? DASHBOARD_BASE.slice(0, -1) : DASHBOARD_BASE;
  const user = sessionUser(locals);
  if (!user) {
    // W4.6a SECURITY: the ADMIN tree is fail-CLOSED. Under degraded auth (Neon Auth
    // 5xx/429/throw for a cookie-bearing request) we CANNOT confirm the operator is a
    // service admin, so we must NOT serve admin pages — a forged `__Secure-x=1` cookie
    // during an auth-infra blip would otherwise hand a stranger the full admin surface
    // (user emails, founders requests, operator emails). THROW so SvelteKit never
    // serializes child-page data; a 503 (honest "couldn't verify your session") rather
    // than a silent login redirect that would mask the outage. (Plain dashboard pages
    // render their own degraded retry banner instead; the admin tree does not.)
    if (locals.authDegraded) {
      throw error(503, "Couldn't verify your session right now. Please try again in a moment.");
    }
    throw redirect(302, `${dash}/login?redirect=${encodeURIComponent(url.pathname)}`);
  }
  if (!user.isServiceAdmin) {
    throw redirect(302, `${dash}/`);
  }
  return {};
};
