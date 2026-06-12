/**
 * W4.6a — auth-change detection for the client session-refresh loop.
 *
 * The dashboard shell renders `$page.data.user` (layout data) which persists across
 * client-side navigations, while page loads re-check auth. A mid-session expiry (or a
 * sign-in in another tab) can therefore leave the shell saying signed-in while a page
 * says signed-out (or vice versa). The 4-minute session refresh polls
 * `/keys/dashboard/api/auth/session-cache`; when that poll reports an auth state that
 * disagrees with what the client currently has rendered, we trigger `invalidateAll()`
 * so the shell and every page load re-run against the new truth and agree again.
 *
 * Pure + side-effect-free so it can be unit-tested without a browser.
 */

/** The auth signal returned by the session-cache endpoint. */
export type SessionCacheSignal = {
  /** True when Neon Auth resolved a session user this poll. */
  signedIn: boolean;
  /**
   * True when verification could NOT complete (infra blip). A degraded poll is NOT a
   * sign-out signal — never invalidate on it (would flap the shell on every blip).
   */
  degraded?: boolean;
};

/**
 * Decide whether the client should call `invalidateAll()` after a session-cache poll.
 *
 * @param currentlySignedIn what the client currently has rendered (e.g. `Boolean($page.data.user)`)
 * @param signal            the session-cache poll result
 * @returns true only when the poll reports a DEFINITE auth-state change vs. what is rendered.
 */
export function shouldInvalidateOnSessionPoll(
  currentlySignedIn: boolean,
  signal: SessionCacheSignal,
): boolean {
  // Verification couldn't complete — don't treat as a change; keep current render.
  if (signal.degraded) return false;
  return signal.signedIn !== currentlySignedIn;
}
