/**
 * Cached Neon Auth session refresh for dashboard client hooks.
 * Uses getSession() server cache + 429 stale fallback instead of raw Neon proxy.
 */
import { json } from "@sveltejs/kit";
import { getSession } from "$lib/server/auth";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ request, url }) => {
  const { data, setCookies } = await getSession(request, url.host);
  const headers = new Headers({ "Content-Type": "application/json" });
  for (const cookie of setCookies) {
    headers.append("Set-Cookie", cookie);
  }
  return json({ user: data?.user ?? null }, { headers });
};
