import { redirect } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";
import { DASHBOARD_BASE } from "$lib/dashboard-base";

/** Perform Neon Auth sign-out (POST), then return to overview. */
export const load: PageServerLoad = async ({ fetch, url }) => {
  // Neon Auth expects POST /sign-out; GET /sign-out returns 404.
  await fetch(`${DASHBOARD_BASE}/api/auth/sign-out`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  throw redirect(302, `${url.origin}${DASHBOARD_BASE}/`);
};
