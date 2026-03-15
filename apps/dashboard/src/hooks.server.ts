/**
 * Firebase Auth session verification. Session cookie is set by POST /api/auth/session (after client login).
 * No raw keys or secrets in logs. Any auth/config error clears the session and continues so the app never 500s.
 */
import type { Handle } from "@sveltejs/kit";
import { getAdminAuth } from "$lib/server/firebase-admin";

const SESSION_COOKIE_NAME = "session";

export const handle: Handle = async ({ event, resolve }) => {
  try {
    const token = event.cookies.get(SESSION_COOKIE_NAME);
    if (token) {
      try {
        const adminAuth = getAdminAuth();
        const decoded = await adminAuth.verifySessionCookie(token, true);
        event.locals.user = {
          uid: decoded.uid,
          email: decoded.email ?? null,
        };
      } catch {
        event.locals.user = undefined;
        event.cookies.delete(SESSION_COOKIE_NAME, { path: "/" });
      }
    } else {
      event.locals.user = undefined;
    }
  } catch (e) {
    event.locals.user = undefined;
    try {
      event.cookies.delete(SESSION_COOKIE_NAME, { path: "/" });
    } catch {
      // ignore
    }
    const msg = e instanceof Error ? e.message : "";
    if (msg && !msg.includes("not configured")) console.error("[auth] session hook:", msg.slice(0, 100));
  }

  return resolve(event);
};

export const config = {
  runtime: "nodejs",
};
