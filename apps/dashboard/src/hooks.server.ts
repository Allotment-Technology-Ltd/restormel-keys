/**
 * Neon Auth session. Populates event.locals.user (uid, email).
 * Adds X-Session-Cookie for proxy when response sets cookie.
 */
import type { Handle } from "@sveltejs/kit";
import { getSession } from "$lib/server/auth";
import { upsertUser } from "$lib/server/db";

export const handle: Handle = async ({ event, resolve }) => {
  try {
    const { data: session } = await getSession(event.request, event.url.host);
    if (session?.user) {
      event.locals.user = {
        uid: session.user.id,
        email: session.user.email ?? null,
      };
      try {
        await upsertUser(session.user.id, session.user.email ?? null);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "";
        if (msg) console.error("[db] upsertUser:", msg.slice(0, 100));
      }
    } else {
      event.locals.user = undefined;
    }
  } catch (e) {
    event.locals.user = undefined;
    const msg = e instanceof Error ? e.message : "";
    if (msg && !msg.includes("not configured")) console.error("[auth] getSession:", msg.slice(0, 100));
  }

  const response = await resolve(event);

  const setCookie = response.headers.get("Set-Cookie");
  if (setCookie) {
    const headers = new Headers(response.headers);
    headers.set("X-Session-Cookie", setCookie);
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  }
  return response;
};

export const config = {
  runtime: "nodejs",
};
