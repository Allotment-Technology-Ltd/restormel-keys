/**
 * Cached Neon Auth session refresh for dashboard client hooks.
 * Uses getSession() server cache + last-known-good fallback instead of raw Neon proxy.
 *
 * W4.6a: the response carries a `signedIn` boolean and a `degraded` flag so the client
 * refresh loop (`hooks.client.ts`) can detect an auth-state CHANGE (signed-in→out or
 * vice versa) and call `invalidateAll()`, keeping the shell (layout data) and the page
 * load in agreement instead of one saying signed-in while the other says signed-out.
 * `degraded` means verification could not complete — the client must NOT treat that as
 * a sign-out.
 */
import { json } from "@sveltejs/kit";
import { getSession } from "$lib/server/auth";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ request, url }) => {
  const { data, setCookies, degraded } = await getSession(request, url.host);
  const headers = new Headers({ "Content-Type": "application/json" });
  for (const cookie of setCookies) {
    headers.append("Set-Cookie", cookie);
  }
  return json(
    { user: data?.user ?? null, signedIn: Boolean(data?.user), degraded: degraded === true },
    { headers },
  );
};
