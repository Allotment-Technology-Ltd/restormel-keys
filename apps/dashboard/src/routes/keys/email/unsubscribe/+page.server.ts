/**
 * Public, no-login unsubscribe (REC-PLAN-017 Phase 3).
 *
 * GET  → renders a neo-brutalist confirmation page. The token rides in the query
 *        string (`?t=<linkToken>`). The GET is deliberately side-effect-free: a
 *        mail-client / scanner prefetch must NEVER unsubscribe anyone.
 * POST  → the authoritative action. Used both by the on-page "Confirm" button and
 *        by RFC 8058 one-click (`List-Unsubscribe-Post: List-Unsubscribe=One-Click`).
 *        DB write happens FIRST; only then do we report success. Idempotent.
 *
 * Security:
 *   - No auth. The signed token IS the capability — verified in the lib layer with a
 *     constant-time HMAC check before any DB lookup.
 *   - Never leaks whether an address exists: an unknown-but-well-formed token returns
 *     the same neutral success as a real unsubscribe.
 *   - Rate-limited per client IP (abuse / DB-hammer guard).
 *   - The token is treated as a secret: never logged, never echoed back in the page.
 */
import { fail } from "@sveltejs/kit";
import type { Actions, PageServerLoad } from "./$types";
import {
  unsubscribeByToken,
  verifyUnsubToken,
  checkUnsubscribeRateLimit,
} from "$lib/server/email-preferences";

export const config = { runtime: "nodejs22.x" as const };

// Do not prerender / cache: token-bearing, side-effecting POST target.
export const prerender = false;
export const ssr = true;

function clientKey(getClientAddress: () => string, request: Request): string {
  // Behind the box's reverse proxy SvelteKit's getClientAddress reflects the proxy
  // unless XFF is trusted; fall back to the first XFF hop for a best-effort per-client key.
  const xff = request.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]?.trim() || "unknown";
  try {
    return getClientAddress() || "unknown";
  } catch {
    return "unknown";
  }
}

export const load: PageServerLoad = async ({ url }) => {
  const linkToken = url.searchParams.get("t");
  // We only report whether the link is *shaped* like a valid signed token, so the
  // page can show "this link looks invalid" vs the confirm button. We do NOT hit the
  // DB here and do NOT reveal whether any address matches.
  let tokenLooksValid = false;
  try {
    tokenLooksValid = verifyUnsubToken(linkToken) !== null;
  } catch {
    // Signing secret misconfigured — treat as not-valid; the page shows a soft error.
    tokenLooksValid = false;
  }
  // Pass the raw token straight back to the form's hidden field ONLY (never rendered
  // as visible text). It is already in the user's URL bar, so this leaks nothing new.
  return { tokenLooksValid, token: linkToken ?? "" };
};

export const actions: Actions = {
  default: async ({ request, getClientAddress }) => {
    const rate = checkUnsubscribeRateLimit(clientKey(getClientAddress, request));
    if (!rate.allowed) {
      return fail(429, { status: "rate_limited" as const, retryAfterSeconds: rate.retryAfterSeconds });
    }

    // Accept the token from the posted form. RFC 8058 one-click clients additionally
    // send `List-Unsubscribe=One-Click`; we don't require it (the token is the gate),
    // but reading it keeps us spec-aware.
    let token: string | null = null;
    try {
      const form = await request.formData();
      token = String(form.get("token") ?? "").trim() || null;
    } catch {
      token = null;
    }

    const result = await unsubscribeByToken(token);

    // Map every NON-server-error outcome to a single neutral "done" so the endpoint
    // cannot be used to probe which addresses exist. Only a true DB error surfaces.
    if (result.ok) {
      return { status: "done" as const };
    }
    if (result.reason === "invalid_token") {
      // Forged/garbage token: still don't confirm or deny an address — show the same
      // neutral "link invalid" state (distinct from "done" only so the UI can guide a
      // confused user to the preference centre).
      return fail(400, { status: "invalid" as const });
    }
    return fail(503, { status: "error" as const });
  },
};
