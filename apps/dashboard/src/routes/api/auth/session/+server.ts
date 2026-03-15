import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { getAdminAuth } from "$lib/server/firebase-admin";

const SESSION_COOKIE_NAME = "session";
const SESSION_MAX_AGE_SEC = 5 * 24 * 60 * 60; // 5 days

export const POST: RequestHandler = async ({ request, cookies }) => {
  const body = await request.json().catch(() => ({}));
  const idToken = typeof body.idToken === "string" ? body.idToken : null;
  if (!idToken) {
    return json({ error: "Missing idToken" }, { status: 400 });
  }
  try {
    const adminAuth = getAdminAuth();
    await adminAuth.verifyIdToken(idToken);
    const sessionCookie = await adminAuth.createSessionCookie(idToken, { expiresIn: SESSION_MAX_AGE_SEC });
    cookies.set(SESSION_COOKIE_NAME, sessionCookie, {
      path: "/",
      maxAge: SESSION_MAX_AGE_SEC,
      httpOnly: true,
      secure: true,
      sameSite: "lax",
    });
    return json({ ok: true });
  } catch (e) {
    // Auth errors (invalid/expired token) → 401; init/config errors → 503. Log for diagnostics; no tokens.
    const message = e instanceof Error ? e.message : "Invalid token";
    const status = message.includes("credential") || message.includes("initialization") ? 503 : 401;
    console.error("[auth/session] failed:", status, message.slice(0, 80));
    return json({ error: status === 503 ? "Auth not configured" : "Invalid token" }, { status });
  }
};
