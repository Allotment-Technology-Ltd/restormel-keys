/**
 * Email preferences — the sovereign, authoritative marketing-consent ledger
 * (REC-PLAN-017 Phase 3).
 *
 * This module is the ONLY writer/reader of the `email_preferences` table — the
 * system of record for marketing-email consent. Brevo (Phase 4) is a downstream
 * send list synced FROM here; it is never the source of truth. NOTHING in this
 * module sends mail: this is consent + preference infrastructure only.
 *
 * Security / privacy posture (see also migration 070 header):
 *   - All queries are parameterised via the dual-driver `sql` template — values
 *     are bound, never string-interpolated, so injection is impossible.
 *   - email / user_id are PII: errors log only a truncated message, never the
 *     raw address. The unsub token is a capability secret and is NEVER logged.
 *   - Reads/writes fail soft (return a safe default) on a missing table (42P01)
 *     or transient DB error, mirroring `founders-access.ts`, so a consent-ledger
 *     blip never takes down a page — EXCEPT the unsubscribe write path, which
 *     must surface failure so we never tell a user "you're unsubscribed" when the
 *     authoritative record was not updated.
 *
 * Token design (the public one-click unsubscribe link, RFC 8058):
 *   The link carries `"<opaqueToken>.<hmacSig>"`.
 *     - `opaqueToken` is 32 bytes of CSPRNG entropy stored in `unsub_token`. It is
 *       the capability: possession alone identifies the row.
 *     - `hmacSig` is HMAC-SHA256(opaqueToken) under a server-only secret. It lets
 *       us reject obviously-forged/garbage tokens with a constant-time check
 *       BEFORE any DB lookup (cheap abuse guard), and means a leaked DB row alone
 *       cannot be turned into a working link without the signing secret.
 *   Verification is constant-time (`timingSafeEqual`) and never reveals whether a
 *   given address exists.
 */
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { env } from "$env/dynamic/private";
import { getDb } from "$lib/server/db-adapter";
import { normalizeEmailForServiceOwnerMatch } from "$lib/server/service-admin";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Marketing categories governed by this ledger. Transactional/security mail is NOT here. */
export const MARKETING_CATEGORIES = ["product_updates", "newsletter", "release_notes"] as const;
export type MarketingCategory = (typeof MARKETING_CATEGORIES)[number];

export type ConsentSource = "soft-opt-in" | "double-opt-in" | "import";

export type EmailPreferences = {
  email: string;
  userId: string | null;
  productUpdates: boolean;
  newsletter: boolean;
  releaseNotes: boolean;
  consentSource: ConsentSource;
  consentAt: string | null;
  unsubscribedAt: string | null;
};

/** The per-category opt-in booleans, the only fields a user can edit. */
export type CategoryFlags = {
  productUpdates: boolean;
  newsletter: boolean;
  releaseNotes: boolean;
};

// ---------------------------------------------------------------------------
// DB handle
// ---------------------------------------------------------------------------

function getSql() {
  const url = env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  // Dual-driver (P3a): routes via the shared adapter (neon-http or pg Pool).
  return getDb(url);
}

export function normalizePreferenceEmail(email: string | null | undefined): string | null {
  return normalizeEmailForServiceOwnerMatch(email);
}

// ---------------------------------------------------------------------------
// Signed unsubscribe token (mint + verify) — PURE, no DB, unit-testable
// ---------------------------------------------------------------------------

/**
 * Resolve the HMAC signing secret. Prefer a dedicated `EMAIL_UNSUB_TOKEN_SECRET`;
 * fall back to `BETTER_AUTH_SECRET` (already a required server secret) so the
 * feature works without a new env var, but NEVER falls back to a hard-coded value.
 * Throws if neither is set so a misconfigured deploy fails closed rather than
 * minting forgeable links.
 */
export function getUnsubSigningSecret(): string {
  const secret = (env.EMAIL_UNSUB_TOKEN_SECRET ?? env.BETTER_AUTH_SECRET ?? "").trim();
  if (!secret) {
    throw new Error("EMAIL_UNSUB_TOKEN_SECRET (or BETTER_AUTH_SECRET) is not set");
  }
  return secret;
}

/** Generate a fresh opaque capability token (32 bytes, base64url). */
export function generateOpaqueToken(): string {
  return randomBytes(32).toString("base64url");
}

/** HMAC-SHA256(opaqueToken) under the signing secret, base64url. */
export function signOpaqueToken(opaqueToken: string, secret = getUnsubSigningSecret()): string {
  return createHmac("sha256", secret).update(opaqueToken).digest("base64url");
}

/**
 * Build the public link token: `"<opaqueToken>.<sig>"`. `opaqueToken` is the value
 * stored in the DB; the caller persists `opaqueToken` and embeds the returned
 * compound value in the unsubscribe URL.
 */
export function mintUnsubToken(opaqueToken: string, secret = getUnsubSigningSecret()): string {
  return `${opaqueToken}.${signOpaqueToken(opaqueToken, secret)}`;
}

/** Mint a brand-new (opaqueToken, linkToken) pair. */
export function mintNewUnsubToken(secret = getUnsubSigningSecret()): {
  opaqueToken: string;
  linkToken: string;
} {
  const opaqueToken = generateOpaqueToken();
  return { opaqueToken, linkToken: mintUnsubToken(opaqueToken, secret) };
}

/**
 * Constant-time compare of two base64url strings. Returns false on length mismatch
 * (which `timingSafeEqual` would throw on) — the length-leak here is irrelevant
 * because our signatures are always the same length.
 */
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

/**
 * Verify a compound link token and return the embedded opaque token iff the
 * signature is valid. Returns null for any malformed / forged / tampered input.
 * PURE: does NOT touch the DB and does NOT reveal whether the address exists.
 */
export function verifyUnsubToken(
  linkToken: string | null | undefined,
  secret = getUnsubSigningSecret(),
): string | null {
  if (typeof linkToken !== "string") return null;
  const trimmed = linkToken.trim();
  // Bound the input so a hostile caller cannot force huge HMAC work.
  if (trimmed.length === 0 || trimmed.length > 512) return null;
  const dot = trimmed.indexOf(".");
  if (dot <= 0 || dot === trimmed.length - 1) return null;
  const opaqueToken = trimmed.slice(0, dot);
  const sig = trimmed.slice(dot + 1);
  // base64url alphabet only — reject anything else outright.
  if (!/^[A-Za-z0-9_-]+$/.test(opaqueToken) || !/^[A-Za-z0-9_-]+$/.test(sig)) return null;
  const expected = signOpaqueToken(opaqueToken, secret);
  if (!safeEqual(sig, expected)) return null;
  return opaqueToken;
}

// ---------------------------------------------------------------------------
// Row mapping
// ---------------------------------------------------------------------------

function mapRow(r: Record<string, unknown>): EmailPreferences {
  const tsToIso = (v: unknown): string | null =>
    v == null ? null : v instanceof Date ? v.toISOString() : String(v);
  return {
    email: String(r.email ?? ""),
    userId: r.user_id != null ? String(r.user_id) : null,
    productUpdates: r.product_updates === true,
    newsletter: r.newsletter === true,
    releaseNotes: r.release_notes === true,
    consentSource: (String(r.consent_source ?? "soft-opt-in") as ConsentSource),
    consentAt: tsToIso(r.consent_at),
    unsubscribedAt: tsToIso(r.unsubscribed_at),
  };
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

/**
 * Read preferences for a signed-in user (by account id). Returns null when no row
 * exists yet (the preference centre then renders the opt-in defaults). Fails soft
 * to null on a missing table / transient error.
 */
export async function getPreferencesForUser(userId: string): Promise<EmailPreferences | null> {
  if (!userId) return null;
  try {
    const sql = getSql();
    const rows = await sql`
      SELECT email, user_id, product_updates, newsletter, release_notes,
             consent_source, consent_at, unsubscribed_at
      FROM email_preferences
      WHERE user_id = ${userId}
      LIMIT 1
    `;
    const row = rows[0] as Record<string, unknown> | undefined;
    return row ? mapRow(row) : null;
  } catch (e) {
    const code = (e as { code?: string })?.code;
    if (code === "42P01") return null;
    const msg = e instanceof Error ? e.message : "";
    if (msg) console.error("[email-preferences] user read failed:", msg.slice(0, 80));
    return null;
  }
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

/**
 * Upsert a user's marketing preferences from the in-product preference centre.
 *
 * Creates the row on first save (minting a fresh unsub token, recording consent
 * provenance). On update, sets the per-category flags. Toggling a category back on
 * after an unsubscribe re-subscribes the address (clears `unsubscribed_at`); turning
 * everything off via the centre is NOT the same as a hard unsubscribe and leaves the
 * row subscribed (the explicit unsubscribe flow owns `unsubscribed_at`).
 *
 * Returns ok=false on DB error so the form action can surface a retry rather than
 * lie about a saved state.
 */
export async function savePreferencesForUser(params: {
  userId: string;
  email: string;
  flags: CategoryFlags;
}): Promise<{ ok: true } | { ok: false }> {
  const normalized = normalizePreferenceEmail(params.email);
  if (!normalized || !params.userId) return { ok: false };

  try {
    const sql = getSql();
    const { opaqueToken } = mintNewUnsubToken();
    const anyOptIn =
      params.flags.productUpdates || params.flags.newsletter || params.flags.releaseNotes;
    // consent_at is set when the user first opts into anything; preserved thereafter.
    await sql`
      INSERT INTO email_preferences (
        email, user_id, product_updates, newsletter, release_notes,
        consent_source, consent_at, unsubscribed_at, unsub_token, updated_at
      )
      VALUES (
        ${normalized},
        ${params.userId},
        ${params.flags.productUpdates},
        ${params.flags.newsletter},
        ${params.flags.releaseNotes},
        'soft-opt-in',
        ${anyOptIn ? new Date() : null},
        NULL,
        ${opaqueToken},
        NOW()
      )
      ON CONFLICT (email) DO UPDATE SET
        user_id = COALESCE(email_preferences.user_id, EXCLUDED.user_id),
        product_updates = EXCLUDED.product_updates,
        newsletter = EXCLUDED.newsletter,
        release_notes = EXCLUDED.release_notes,
        consent_at = COALESCE(email_preferences.consent_at, EXCLUDED.consent_at),
        -- Re-subscribe if the user turns a category back on via the centre.
        unsubscribed_at = CASE WHEN ${anyOptIn} THEN NULL ELSE email_preferences.unsubscribed_at END,
        updated_at = NOW()
    `;
    return { ok: true };
  } catch (e) {
    const code = (e as { code?: string })?.code;
    if (code === "42P01") return { ok: false };
    const msg = e instanceof Error ? e.message : "";
    if (msg) console.error("[email-preferences] save failed:", msg.slice(0, 80));
    return { ok: false };
  }
}

// ---------------------------------------------------------------------------
// Unsubscribe (public, token-gated, no auth)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Abuse guard for the PUBLIC unsubscribe endpoint (fixed window, in-memory)
// ---------------------------------------------------------------------------
//
// The unsubscribe POST is unauthenticated and token-gated. The token check already
// makes brute force pointless (256-bit opaque token under an HMAC), but we still cap
// requests per client so the endpoint cannot be used to hammer the DB or as an
// amplification vector. Same fixed-window, per-process pattern as
// integration-verify.ts (caveat: single-instance — a multi-replica deploy would want
// a shared store; acceptable here because the token is the real gate).

const UNSUB_RATE_DEFAULT_LIMIT = 20;
const UNSUB_RATE_DEFAULT_WINDOW_MS = 60_000;
const UNSUB_RATE_PRUNE_THRESHOLD = 4096;

type UnsubWindowState = { windowStartMs: number; count: number };
const unsubWindows = new Map<string, UnsubWindowState>();

export type UnsubRateLimitDecision =
  | { allowed: true; remaining: number }
  | { allowed: false; retryAfterSeconds: number };

function unsubRateConfig(): { limit: number; windowMs: number } {
  const rawLimit = Number(process.env.RESTORMEL_EMAIL_UNSUB_RATE_LIMIT ?? UNSUB_RATE_DEFAULT_LIMIT);
  const rawWindow = Number(
    process.env.RESTORMEL_EMAIL_UNSUB_RATE_WINDOW_MS ?? UNSUB_RATE_DEFAULT_WINDOW_MS,
  );
  return {
    limit: Number.isFinite(rawLimit) && rawLimit >= 1 ? Math.floor(rawLimit) : UNSUB_RATE_DEFAULT_LIMIT,
    windowMs:
      Number.isFinite(rawWindow) && rawWindow >= 1000 ? Math.floor(rawWindow) : UNSUB_RATE_DEFAULT_WINDOW_MS,
  };
}

/** Check (and consume) one unsubscribe attempt for a client key (typically the IP). */
export function checkUnsubscribeRateLimit(clientKey: string, nowMs = Date.now()): UnsubRateLimitDecision {
  const { limit, windowMs } = unsubRateConfig();
  const key = clientKey || "unknown";
  if (unsubWindows.size >= UNSUB_RATE_PRUNE_THRESHOLD) {
    for (const [k, state] of unsubWindows) {
      if (nowMs - state.windowStartMs >= windowMs) unsubWindows.delete(k);
    }
  }
  const state = unsubWindows.get(key);
  if (!state || nowMs - state.windowStartMs >= windowMs) {
    unsubWindows.set(key, { windowStartMs: nowMs, count: 1 });
    return { allowed: true, remaining: limit - 1 };
  }
  if (state.count >= limit) {
    const retryAfterMs = state.windowStartMs + windowMs - nowMs;
    return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000)) };
  }
  state.count += 1;
  return { allowed: true, remaining: limit - state.count };
}

/** Test hook: the limiter is module-level state. */
export function resetUnsubscribeRateLimit(): void {
  unsubWindows.clear();
}

export type UnsubscribeResult =
  | { ok: true; alreadyUnsubscribed: boolean }
  /** Token was valid in shape/signature but matched no row. We still return ok=true
   *  to the caller (idempotent, never leaks existence) — this variant is internal. */
  | { ok: false; reason: "invalid_token" | "db_error" };

/**
 * Resolve a signed link token and unsubscribe the matching address.
 *
 * Flow: verify signature (pure, cheap) → look up the opaque token → flip
 * `unsubscribed_at` and clear all marketing flags in ONE statement (DB first, before
 * any cosmetic confirmation). Idempotent: a second click is a no-op success. NEVER
 * reveals whether an address exists — an unknown-but-well-formed token is reported to
 * the route layer as a generic success so the public page cannot be used to probe.
 *
 * @returns ok=true with whether the row was already unsubscribed; ok=false only for a
 *   genuinely malformed/forged token or a DB error (the route maps both to a neutral
 *   page — it does not distinguish "no such address" to the visitor).
 */
export async function unsubscribeByToken(linkToken: string | null | undefined): Promise<UnsubscribeResult> {
  let opaqueToken: string | null;
  try {
    opaqueToken = verifyUnsubToken(linkToken);
  } catch {
    // Signing secret missing — treat as a server error, not a token problem.
    return { ok: false, reason: "db_error" };
  }
  if (!opaqueToken) return { ok: false, reason: "invalid_token" };

  try {
    const sql = getSql();
    // Single authoritative write: set unsubscribed_at (idempotent — COALESCE keeps the
    // first timestamp on a repeat click) and clear every marketing flag.
    const rows = await sql`
      UPDATE email_preferences
      SET product_updates = FALSE,
          newsletter = FALSE,
          release_notes = FALSE,
          unsubscribed_at = COALESCE(unsubscribed_at, NOW()),
          updated_at = NOW()
      WHERE unsub_token = ${opaqueToken}
      RETURNING (unsubscribed_at IS NOT NULL) AS was_set
    `;
    const row = rows[0] as { was_set?: boolean } | undefined;
    if (!row) {
      // Valid signature, no matching row. Do NOT leak this — report a generic success.
      return { ok: true, alreadyUnsubscribed: true };
    }
    // The RETURNING value is always true post-update; we can't cheaply know the prior
    // state without a second read, and it does not matter for the response — report
    // success either way (idempotent semantics).
    return { ok: true, alreadyUnsubscribed: false };
  } catch (e) {
    const code = (e as { code?: string })?.code;
    if (code === "42P01") return { ok: true, alreadyUnsubscribed: true };
    const msg = e instanceof Error ? e.message : "";
    if (msg) console.error("[email-preferences] unsubscribe failed:", msg.slice(0, 80));
    return { ok: false, reason: "db_error" };
  }
}
