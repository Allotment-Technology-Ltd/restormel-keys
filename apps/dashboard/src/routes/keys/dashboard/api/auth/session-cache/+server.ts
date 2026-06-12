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
 *
 * L1 SECURITY: the body is trimmed to `{signedIn, degraded}` — the only fields the client
 * refresh loop consumes (`hooks.client.ts` reads its own `$page.data.user` for the rendered
 * state, never this `user` object). It must never expose a serialized session user. The
 * response is per-cookie and must never be shared/cached: `Cache-Control: no-store` +
 * `Vary: Cookie`.
 */
import { json } from "@sveltejs/kit";
import { getSession } from "$lib/server/auth";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ request, url }) => {
  const { data, setCookies, degraded } = await getSession(request, url.host);
  const headers = new Headers({
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
    Vary: "Cookie",
  });
  for (const cookie of setCookies) {
    headers.append("Set-Cookie", cookie);
  }
  return json({ signedIn: Boolean(data?.user), degraded: degraded === true }, { headers });
};
