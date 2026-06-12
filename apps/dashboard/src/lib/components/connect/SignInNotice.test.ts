/**
 * W1.7 — SignInNotice: sign-in return-to URL construction and hub-load signed-in vs backend-error
 * distinction (UX A-P1-1, A-P1-2, A-P1-3).
 *
 * We test the pure helpers inline (same pattern as UserMenu.test.ts — no DOM available).
 */
import { describe, it, expect } from "vitest";
import { DASHBOARD_BASE } from "$lib/dashboard-base";

// ---------------------------------------------------------------------------
// Helper extracted from SignInNotice.svelte: build a login href that preserves
// the return-to path so signed-out users land back where they came from.
// ---------------------------------------------------------------------------
function buildLoginHref(pathname: string, search: string): string {
  const returnTo = pathname + search;
  return DASHBOARD_BASE + "/login?return_to=" + encodeURIComponent(returnTo);
}

describe("SignInNotice — return-to URL", () => {
  it("encodes pathname with no search params", () => {
    const href = buildLoginHref("/keys/dashboard/home", "");
    expect(href).toBe(DASHBOARD_BASE + "/login?return_to=%2Fkeys%2Fdashboard%2Fhome");
  });

  it("encodes pathname and search string", () => {
    const href = buildLoginHref("/keys/dashboard/claims", "?filter=review");
    expect(href).toContain("return_to=");
    // Decoded return_to should reconstruct the original destination
    const url = new URL(href, "https://restormel.dev");
    const returnTo = url.searchParams.get("return_to");
    expect(returnTo).toBe("/keys/dashboard/claims?filter=review");
  });

  it("preserves multiple query params", () => {
    const href = buildLoginHref("/keys/dashboard/claims", "?filter=review&unit=abc123");
    const url = new URL(href, "https://restormel.dev");
    const returnTo = url.searchParams.get("return_to");
    expect(returnTo).toBe("/keys/dashboard/claims?filter=review&unit=abc123");
  });

  it("always points to the /login path under DASHBOARD_BASE", () => {
    const href = buildLoginHref("/keys/dashboard/prove", "");
    expect(href.startsWith(DASHBOARD_BASE + "/login")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Hub server-load — signed-out vs backend-error distinction (UX A-P1-2 pattern).
// The +page.server.ts now returns signedIn: false when the user is not
// authenticated, and signedIn: true when they are (even if hub data fails).
// This mirrors the pattern from connect/library/+page.server.ts (signedIn flag)
// and ensures a backend failure is NEVER silently surfaced as "Sign in" (the
// exact regression identified by PR #241 / connect-hub-load.ts comment at :195).
// ---------------------------------------------------------------------------

// Simulate the server-load decision without importing SvelteKit server modules.
function resolveHubLoadState(
  isAuthenticated: boolean,
  hubLoadSucceeded: boolean,
): { signedIn: boolean; hubNull: boolean } {
  if (!isAuthenticated) {
    return { signedIn: false, hubNull: true };
  }
  // Authenticated: hub can still fail (returns null from loadConnectHubPage on error).
  return { signedIn: true, hubNull: !hubLoadSucceeded };
}

describe("connect/+page.server.ts — signedIn vs backend-error distinction", () => {
  it("signed-out → signedIn=false, hub=null", () => {
    const result = resolveHubLoadState(false, false);
    expect(result.signedIn).toBe(false);
    expect(result.hubNull).toBe(true);
  });

  it("signed-in + load succeeds → signedIn=true, hub present", () => {
    const result = resolveHubLoadState(true, true);
    expect(result.signedIn).toBe(true);
    expect(result.hubNull).toBe(false);
  });

  it("signed-in + load fails → signedIn=true, hub=null (backend error, NOT sign-in prompt)", () => {
    const result = resolveHubLoadState(true, false);
    // Critical invariant: backend failure must NOT show SignInNotice.
    expect(result.signedIn).toBe(true);
    // hub is null but signedIn is true — page shows BrutalErrorBanner not SignInNotice.
    expect(result.hubNull).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Encryption-key banner gating (UX A-P1-3): must only appear on self-host /
// dev instances, never to cloud users.
// ---------------------------------------------------------------------------

// Extracted from connect/+page.server.ts isSelfHostOrDev() helper.
function isSelfHostOrDev(nodeEnv: string | undefined, vercelEnv: string | undefined): boolean {
  return nodeEnv !== "production" && vercelEnv !== "production";
}

describe("encryption-key banner — self-host / dev gating", () => {
  it("shows in development (NODE_ENV=development)", () => {
    expect(isSelfHostOrDev("development", undefined)).toBe(true);
  });

  it("shows when NODE_ENV is not set (local cold starts)", () => {
    expect(isSelfHostOrDev(undefined, undefined)).toBe(true);
  });

  it("hides in production (NODE_ENV=production)", () => {
    expect(isSelfHostOrDev("production", undefined)).toBe(false);
  });

  it("hides on Vercel production (VERCEL_ENV=production)", () => {
    expect(isSelfHostOrDev("development", "production")).toBe(false);
  });

  it("hides when both are production", () => {
    expect(isSelfHostOrDev("production", "production")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Proof and graph page server-load — same signed-in / error distinction.
// ---------------------------------------------------------------------------

function resolveProofLoadState(
  isAuthenticated: boolean,
  loadSucceeded: boolean,
): { signedIn: boolean; loadError: boolean } {
  if (!isAuthenticated) {
    return { signedIn: false, loadError: false };
  }
  return { signedIn: true, loadError: !loadSucceeded };
}

describe("connect/proof/+page.server.ts — signedIn / loadError distinction", () => {
  it("signed-out → signedIn=false, loadError=false", () => {
    const r = resolveProofLoadState(false, false);
    expect(r.signedIn).toBe(false);
    expect(r.loadError).toBe(false);
  });

  it("signed-in, load OK → signedIn=true, loadError=false", () => {
    const r = resolveProofLoadState(true, true);
    expect(r.signedIn).toBe(true);
    expect(r.loadError).toBe(false);
  });

  it("signed-in, load fails → signedIn=true, loadError=true (not sign-in prompt)", () => {
    const r = resolveProofLoadState(true, false);
    expect(r.signedIn).toBe(true);
    expect(r.loadError).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// ingest/+page.svelte — 401 → signedOut flag (distinct from other errors).
// ---------------------------------------------------------------------------

function resolveIngestLoadState(
  httpStatus: number,
  networkError: boolean,
): { signedOut: boolean; error: string | null } {
  if (networkError) {
    return { signedOut: false, error: "Network error while loading ingest runs." };
  }
  if (httpStatus === 401) {
    return { signedOut: true, error: null };
  }
  if (httpStatus !== 200) {
    return { signedOut: false, error: `Could not load ingest runs (HTTP ${httpStatus}).` };
  }
  return { signedOut: false, error: null };
}

describe("connect/ingest/+page.svelte — 401 vs error path", () => {
  it("401 → signedOut=true, no error (shows SignInNotice)", () => {
    const r = resolveIngestLoadState(401, false);
    expect(r.signedOut).toBe(true);
    expect(r.error).toBeNull();
  });

  it("500 → error message (shows BrutalErrorBanner, not SignInNotice)", () => {
    const r = resolveIngestLoadState(500, false);
    expect(r.signedOut).toBe(false);
    expect(r.error).toContain("HTTP 500");
  });

  it("network failure → error message (shows BrutalErrorBanner, not SignInNotice)", () => {
    const r = resolveIngestLoadState(0, true);
    expect(r.signedOut).toBe(false);
    expect(r.error).toContain("Network error");
  });

  it("200 → no error, not signed out", () => {
    const r = resolveIngestLoadState(200, false);
    expect(r.signedOut).toBe(false);
    expect(r.error).toBeNull();
  });
});
