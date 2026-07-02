import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// REC-PLAN-028 Phase 3 — consent ledger.
//
// We test:
//   (1) the signed unsubscribe token mint/verify — PURE, with an explicit secret so no
//       env / DB is needed and the crypto is exercised directly;
//   (2) the public unsubscribe handler — DB mocked via a fake `getDb` so we assert the
//       parameterised UPDATE, idempotency, the no-leak behaviour, and fail-soft on a
//       missing table — without a live Postgres;
//   (3) the in-memory abuse-guard rate limiter (deterministic given `nowMs`).
//
// `getDb` and `$env/dynamic/private` are mocked so importing the module never opens a Pool.

const fakeSql = vi.fn();
vi.mock("$lib/server/db-adapter", () => ({
  getDb: vi.fn(() => fakeSql),
}));
vi.mock("$env/dynamic/private", () => ({
  env: {
    DATABASE_URL: "postgres://u:p@db.internal:5432/app",
    EMAIL_UNSUB_TOKEN_SECRET: "unit-test-unsub-secret-please-rotate",
  },
}));

const SECRET = "deterministic-test-secret";

describe("unsubscribe token mint/verify (pure)", () => {
  it("round-trips: a freshly minted link token verifies to its opaque token", async () => {
    const { mintNewUnsubToken, verifyUnsubToken } = await import("./email-preferences");
    const { opaqueToken, linkToken } = mintNewUnsubToken(SECRET);
    expect(linkToken).toContain(".");
    expect(verifyUnsubToken(linkToken, SECRET)).toBe(opaqueToken);
  });

  it("rejects a token signed under a different secret", async () => {
    const { mintNewUnsubToken, verifyUnsubToken } = await import("./email-preferences");
    const { linkToken } = mintNewUnsubToken("secret-A");
    expect(verifyUnsubToken(linkToken, "secret-B")).toBeNull();
  });

  it("rejects a tampered opaque token (signature no longer matches)", async () => {
    const { mintNewUnsubToken, verifyUnsubToken } = await import("./email-preferences");
    const { opaqueToken, linkToken } = mintNewUnsubToken(SECRET);
    const sig = linkToken.slice(linkToken.indexOf(".") + 1);
    const tampered = `${opaqueToken}X.${sig}`;
    expect(verifyUnsubToken(tampered, SECRET)).toBeNull();
  });

  it("rejects malformed / empty / oversized / non-base64url input", async () => {
    const { verifyUnsubToken } = await import("./email-preferences");
    expect(verifyUnsubToken(null, SECRET)).toBeNull();
    expect(verifyUnsubToken(undefined, SECRET)).toBeNull();
    expect(verifyUnsubToken("", SECRET)).toBeNull();
    expect(verifyUnsubToken("nodothere", SECRET)).toBeNull();
    expect(verifyUnsubToken(".sigonly", SECRET)).toBeNull();
    expect(verifyUnsubToken("opaqueonly.", SECRET)).toBeNull();
    expect(verifyUnsubToken("has spaces.sig", SECRET)).toBeNull();
    expect(verifyUnsubToken("a+b/c.sig", SECRET)).toBeNull(); // base64 (not url) chars
    expect(verifyUnsubToken("x".repeat(600) + ".sig", SECRET)).toBeNull();
  });

  it("mints distinct opaque tokens each call (rotation / uniqueness)", async () => {
    const { mintNewUnsubToken } = await import("./email-preferences");
    const a = mintNewUnsubToken(SECRET).opaqueToken;
    const b = mintNewUnsubToken(SECRET).opaqueToken;
    expect(a).not.toBe(b);
  });
});

describe("unsubscribeByToken (DB mocked)", () => {
  beforeEach(() => {
    vi.resetModules();
    fakeSql.mockReset();
  });
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("unsubscribes a valid token: clears marketing flags + sets unsubscribed_at", async () => {
    const mod = await import("./email-preferences");
    const { linkToken } = mod.mintNewUnsubToken(
      "unit-test-unsub-secret-please-rotate", // must match the mocked env secret
    );
    // The UPDATE ... RETURNING returns a row.
    fakeSql.mockResolvedValueOnce([{ was_set: true }]);

    const res = await mod.unsubscribeByToken(linkToken);
    expect(res).toEqual({ ok: true, alreadyUnsubscribed: false });

    // Parameterised tagged-template call: values are bound, not interpolated.
    expect(fakeSql).toHaveBeenCalledTimes(1);
    const [strings, ...values] = fakeSql.mock.calls[0];
    const sqlText = (strings as string[]).join("?");
    expect(sqlText).toMatch(/UPDATE email_preferences/i);
    expect(sqlText).toMatch(/product_updates = FALSE/i);
    expect(sqlText).toMatch(/unsubscribed_at = COALESCE\(unsubscribed_at, NOW\(\)\)/i);
    // The opaque token is the ONLY bound value, never concatenated into the text.
    const opaque = mod.verifyUnsubToken(linkToken, "unit-test-unsub-secret-please-rotate");
    expect(values).toEqual([opaque]);
  });

  it("is idempotent + non-leaky: a valid token matching no row reports neutral success", async () => {
    const mod = await import("./email-preferences");
    const { linkToken } = mod.mintNewUnsubToken("unit-test-unsub-secret-please-rotate");
    fakeSql.mockResolvedValueOnce([]); // no matching row

    const res = await mod.unsubscribeByToken(linkToken);
    expect(res).toEqual({ ok: true, alreadyUnsubscribed: true });
  });

  it("never hits the DB for a forged token", async () => {
    const mod = await import("./email-preferences");
    const res = await mod.unsubscribeByToken("forged.signature");
    expect(res).toEqual({ ok: false, reason: "invalid_token" });
    expect(fakeSql).not.toHaveBeenCalled();
  });

  it("fails soft (neutral success) when the table is missing (42P01)", async () => {
    const mod = await import("./email-preferences");
    const { linkToken } = mod.mintNewUnsubToken("unit-test-unsub-secret-please-rotate");
    fakeSql.mockRejectedValueOnce(Object.assign(new Error("relation does not exist"), { code: "42P01" }));

    const res = await mod.unsubscribeByToken(linkToken);
    expect(res).toEqual({ ok: true, alreadyUnsubscribed: true });
  });

  it("returns a db_error for an unexpected DB failure", async () => {
    const mod = await import("./email-preferences");
    const { linkToken } = mod.mintNewUnsubToken("unit-test-unsub-secret-please-rotate");
    fakeSql.mockRejectedValueOnce(Object.assign(new Error("connection reset"), { code: "08006" }));

    const res = await mod.unsubscribeByToken(linkToken);
    expect(res).toEqual({ ok: false, reason: "db_error" });
  });
});

describe("checkUnsubscribeRateLimit (in-memory, deterministic)", () => {
  beforeEach(async () => {
    const { resetUnsubscribeRateLimit } = await import("./email-preferences");
    resetUnsubscribeRateLimit();
  });

  it("allows up to the limit then blocks within the window", async () => {
    const { checkUnsubscribeRateLimit } = await import("./email-preferences");
    const ip = "203.0.113.7";
    const t0 = 1_000_000;
    // Default limit is 20 in a 60s window.
    let lastAllowed = true;
    for (let i = 0; i < 20; i++) {
      lastAllowed = checkUnsubscribeRateLimit(ip, t0).allowed;
    }
    expect(lastAllowed).toBe(true);
    const blocked = checkUnsubscribeRateLimit(ip, t0);
    expect(blocked.allowed).toBe(false);
    if (!blocked.allowed) expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("resets after the window elapses", async () => {
    const { checkUnsubscribeRateLimit } = await import("./email-preferences");
    const ip = "203.0.113.8";
    const t0 = 2_000_000;
    for (let i = 0; i < 20; i++) checkUnsubscribeRateLimit(ip, t0);
    expect(checkUnsubscribeRateLimit(ip, t0).allowed).toBe(false);
    // 61s later → new window.
    expect(checkUnsubscribeRateLimit(ip, t0 + 61_000).allowed).toBe(true);
  });

  it("tracks separate clients independently", async () => {
    const { checkUnsubscribeRateLimit } = await import("./email-preferences");
    const t0 = 3_000_000;
    for (let i = 0; i < 20; i++) checkUnsubscribeRateLimit("client-a", t0);
    expect(checkUnsubscribeRateLimit("client-a", t0).allowed).toBe(false);
    // A different client is unaffected.
    expect(checkUnsubscribeRateLimit("client-b", t0).allowed).toBe(true);
  });
});

describe("savePreferencesForUser (DB mocked)", () => {
  beforeEach(() => {
    vi.resetModules();
    fakeSql.mockReset();
  });

  it("upserts parameterised flags and re-subscribes when any category is on", async () => {
    const mod = await import("./email-preferences");
    fakeSql.mockResolvedValueOnce([]);
    const res = await mod.savePreferencesForUser({
      userId: "user_123",
      email: "  Person@Example.COM ",
      flags: { productUpdates: true, newsletter: false, releaseNotes: false },
    });
    expect(res).toEqual({ ok: true });
    const [strings, ...values] = fakeSql.mock.calls[0];
    const sqlText = (strings as string[]).join("?");
    expect(sqlText).toMatch(/INSERT INTO email_preferences/i);
    expect(sqlText).toMatch(/ON CONFLICT \(email\) DO UPDATE/i);
    // Email is normalised (lower-cased, trimmed) before binding.
    expect(values).toContain("person@example.com");
    expect(values).toContain("user_123");
  });

  it("returns ok=false on an unexpected DB error (never lies about a save)", async () => {
    const mod = await import("./email-preferences");
    fakeSql.mockRejectedValueOnce(Object.assign(new Error("nope"), { code: "08006" }));
    const res = await mod.savePreferencesForUser({
      userId: "user_123",
      email: "a@b.com",
      flags: { productUpdates: false, newsletter: false, releaseNotes: false },
    });
    expect(res).toEqual({ ok: false });
  });
});
