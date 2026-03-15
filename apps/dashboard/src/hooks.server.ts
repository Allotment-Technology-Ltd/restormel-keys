/**
 * Firebase Auth session verification. Session cookie is set by POST /api/auth/session (after client login).
 * No raw keys or secrets in logs.
 */
import type { Handle } from "@sveltejs/kit";
import { getAdminAuth } from "$lib/server/firebase-admin";

const SESSION_COOKIE_NAME = "session";
const SESSION_MAX_AGE_DAYS = 5;

export const handle: Handle = async ({ event, resolve }) => {
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

  return resolve(event);
};

export const config = {
  runtime: "nodejs",
};
