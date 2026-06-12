/**
 * W4.6a — ONE signed-in convention for dashboard session-page surfaces.
 *
 * Before this helper the dashboard expressed "is this a signed-in human?" three
 * different ways across ~20 load/endpoint sites:
 *   - `!locals.user`                      (bare presence — also true for bearer keys)
 *   - `locals.user.authType !== "session"`(presence + session, negated)
 *   - `authType === "session"`            (presence + session, positive)
 * When `locals.user` was undefined these surfaces degraded differently
 * (SignInNotice vs redirect vs partial render), producing the "patchwork" UX
 * where one part of the dashboard reads signed-in and another reads signed-out.
 *
 * This module is the single source of truth for the SESSION-PAGE question. It is
 * deliberately NOT used to gate the gateway/management Bearer-key API semantics —
 * those endpoints branch on `authType === "gateway_key" | "management_key"` to
 * resolve project/workspace scope and must keep doing so (see
 * `dashboard-project-api-scope.ts`). Use `sessionUser` / `requireSessionUser`
 * only where the surface is for a signed-in human operating their own dashboard.
 *
 * Conventions:
 *   - `sessionUser(locals)`        → the session user, or `null`. Use in loads that
 *                                    render a signed-out state in place (SignInNotice,
 *                                    welcome panel) rather than redirecting.
 *   - `requireSessionUser(locals)` → the session user, or throws 401 (endpoints) /
 *                                    the caller redirects (loads). Use where a
 *                                    signed-out request must not proceed.
 *   - `isSignedInSession(locals)`  → boolean, for `{#if}`-style branching and the
 *                                    home hub `signedInForHub` flag.
 *
 * A request authenticated via a Gateway or Management Bearer key is NOT a session
 * user: these helpers return `null` / `false` for it, matching the prior
 * `authType !== "session"` semantics exactly.
 */
import { error } from "@sveltejs/kit";

/** The shape `locals.user` carries when (and only when) `authType === "session"`. */
export type SessionUser = NonNullable<App.Locals["user"]> & { authType: "session" };

/**
 * The session user for this request, or `null` when the request is signed-out or
 * authenticated by a Bearer key. This is the canonical "is a human signed in?" read.
 */
export function sessionUser(locals: App.Locals): SessionUser | null {
  const u = locals.user;
  if (!u || u.authType !== "session") return null;
  return u as SessionUser;
}

/** True when the request is an authenticated session (human), not a Bearer key. */
export function isSignedInSession(locals: App.Locals): boolean {
  return sessionUser(locals) !== null;
}

/**
 * The session user, or throw a 401 (`@sveltejs/kit` `error`). For endpoints/loads
 * that must not run for a signed-out or key-authenticated request. Loads that want
 * to redirect to login instead should branch on `sessionUser(locals)` returning null.
 */
export function requireSessionUser(locals: App.Locals): SessionUser {
  const u = sessionUser(locals);
  if (!u) {
    throw error(401, "Sign in required");
  }
  return u;
}

/**
 * W4.6a SECURITY — fail-CLOSED service-admin gate for the ADMIN page-load tree.
 *
 * The `/keys/admin` layout already redirects/503s before child loads run, but the admin
 * child pages serialize sensitive data (user emails, founders requests, operator emails).
 * Defense-in-depth: each admin child load calls this so NO future layout change can fail
 * them open. Mirrors the admin API endpoints' operator gate (`sessionUser` + `isServiceAdmin`)
 * but throws so SvelteKit never serializes page data for an unverified request:
 *   - degraded auth (cookie-bearing request, verification couldn't complete) → 503,
 *     NEVER a fall-through to rendering — matches the layout's fail-closed posture.
 *   - signed-out or non-admin session → 403.
 */
export function requireServiceAdminSession(locals: App.Locals): SessionUser {
  const u = sessionUser(locals);
  if (!u) {
    if (locals.authDegraded) {
      throw error(503, "Couldn't verify your session right now. Please try again in a moment.");
    }
    throw error(403, "Service admin access required");
  }
  if (!u.isServiceAdmin) {
    throw error(403, "Service admin access required");
  }
  return u;
}
