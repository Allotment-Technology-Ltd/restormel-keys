/**
 * EU-appropriate, minimal analytics consent gating.
 *
 * Policy (documented in docs/product/analytics-public-pages-spec.md):
 * -------------------------------------------------------------------
 * PostHog is initialised in *cookieless* / memory-only mode by default so that
 * NO identifying cookie or localStorage entry is written before the visitor has
 * made a choice. This is the "cookieless-until-consent" model: we still get
 * aggregate, non-persistent measurement (pageviews within a single page session)
 * without dropping a persistent identifier, which keeps us on the right side of
 * ePrivacy / GDPR for EU traffic without a hard cookie wall.
 *
 * - `unknown`  → no decision yet. PostHog runs in `memory` persistence, no
 *               cross-page/visit identity, autocapture off until decided.
 * - `granted`  → visitor opted in. We upgrade to `localStorage+cookie`
 *               persistence and enable autocapture for full analytics.
 * - `denied`   → visitor opted out. We call `posthog.opt_out_capturing()` so
 *               nothing further is sent, and persist only the choice itself.
 *
 * The choice is stored in a single first-party, non-essential-data cookie
 * (`rk_analytics_consent`) so we can honour it on subsequent visits without
 * re-prompting. That cookie holds an enum value only — no identifiers.
 *
 * This module is intentionally framework-light and SSR-safe: every function is a
 * no-op (returning a sensible default) when `window`/`document` is unavailable.
 * A consent BANNER/UI is deliberately out of scope for W5 (page-owner / layout
 * agents own UI); this module exposes the primitives they call.
 */

import { browser } from "$app/environment";

export type ConsentState = "unknown" | "granted" | "denied";

export const CONSENT_COOKIE = "rk_analytics_consent";
/** ~6 months — long enough to avoid nagging, short enough to re-confirm. */
const CONSENT_MAX_AGE_SECONDS = 60 * 60 * 24 * 182;

function readCookie(name: string): string | null {
  if (!browser || typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function writeCookie(name: string, value: string): void {
  if (!browser || typeof document === "undefined") return;
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${name}=${encodeURIComponent(value)}; Max-Age=${CONSENT_MAX_AGE_SECONDS}; Path=/; SameSite=Lax${secure}`;
}

/** Current consent decision, defaulting to `unknown` (cookieless mode). */
export function getConsentState(): ConsentState {
  const raw = readCookie(CONSENT_COOKIE);
  if (raw === "granted" || raw === "denied") return raw;
  return "unknown";
}

/** True only when the visitor has explicitly opted in. */
export function hasAnalyticsConsent(): boolean {
  return getConsentState() === "granted";
}

/** Persist a decision. Caller is responsible for (re)configuring PostHog. */
export function setConsentState(state: Exclude<ConsentState, "unknown">): void {
  writeCookie(CONSENT_COOKIE, state);
}
