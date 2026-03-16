import { redirect } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";
import { base } from "$app/paths";

/** Perform Neon Auth sign-out (POST), then return to overview. */
export const load: PageServerLoad = async ({ fetch, url }) => {
  // Neon Auth expects POST /sign-out; GET /sign-out returns 404.
  await fetch(`${base}/api/auth/sign-out`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  throw redirect(302, `${url.origin}${base}/`);
};
