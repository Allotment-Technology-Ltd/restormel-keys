import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// W4.6a — getSession must FAIL CLOSED on verification errors: a Neon Auth 5xx, a 429
// with no last-known-good, or a network throw for a cookie-bearing request must report
// `degraded` (not a clean signed-out), so hooks renders an auth-error/retry state instead
// of silently demoting the user to signed-out on a transient infra blip.

vi.mock("$app/environment", () => ({ dev: false }));
vi.mock("$env/dynamic/private", () => ({
  env: { NEON_AUTH_BASE_URL: "https://auth.example.test" },
}));

const COOKIE = "rksecure-session=tok";
const HOST = "localhost:5173";

function reqWithSession(): Request {
  return new Request(`http://${HOST}/keys/dashboard`, { headers: { cookie: COOKIE } });
}

describe("getSession fail-closed verification (W4.6a)", () => {
  beforeEach(() => {
    vi.resetModules();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reports degraded (NOT signed-out) on a Neon Auth 5xx with no cached session", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        status: 503,
        headers: new Headers(),
        json: async () => ({}),
      })),
    );
    const { getSession } = await import("./auth");
    const result = await getSession(reqWithSession(), HOST);

    expect(result.data).toBeNull(); // not signed in...
    expect(result.degraded).toBe(true); // ...but NOT a clean signed-out either.
  });

  it("reports degraded on a network throw for a cookie-bearing request", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("ECONNREFUSED");
      }),
    );
    const { getSession } = await import("./auth");
    const result = await getSession(reqWithSession(), HOST);

    expect(result.data).toBeNull();
    expect(result.degraded).toBe(true);
    expect(result.error).toBeInstanceOf(Error);
  });

  it("serves last-known-good (not degraded) when a 5xx follows a successful verification", async () => {
    const fetchMock = vi.fn();
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers(),
      json: async () => ({ user: { id: "u-good", email: "a@b.c" } }),
    });
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 500,
      headers: new Headers(),
      json: async () => ({}),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { getSession } = await import("./auth");
    // First call: succeeds and populates the last-known-good cache.
    const first = await getSession(reqWithSession(), HOST);
    expect(first.data?.user?.id).toBe("u-good");

    // The happy-path 20s cache would return the hit without a second fetch; advance past it
    // so the 5xx path is actually exercised, then assert we still serve the cached user.
    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 25_000);
    const second = await getSession(reqWithSession(), HOST);
    vi.useRealTimers();

    expect(second.data?.user?.id).toBe("u-good");
    expect(second.degraded).toBe(false);
  });

  it("is NOT degraded for a genuine signed-out request (no session cookie)", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const { getSession } = await import("./auth");
    const req = new Request(`http://${HOST}/keys/dashboard`, {
      headers: { cookie: "ph_distinct_id=anon" },
    });
    const result = await getSession(req, HOST);

    expect(result.data).toBeNull();
    expect(result.degraded).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("is NOT degraded for a genuine signed-out request (Neon 200 with user:null)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: async () => ({ user: null }),
      })),
    );
    const { getSession } = await import("./auth");
    const result = await getSession(reqWithSession(), HOST);

    expect(result.data).toBeNull();
    expect(result.degraded).toBe(false);
  });

  // M1 SECURITY: revoked-session resurrection. A definitive non-user resolution (Neon 200
  // `{user:null}` or a 4xx) must EVICT the prior last-known-good entry, so a 5xx/throw
  // within the 60s resilience window cannot resurrect the revoked session via the stale
  // fallback. Without the eviction, the revoked cookie would keep being honored.
  it("does NOT resurrect a session after revocation (200 user:null) then a 5xx within the window", async () => {
    const fetchMock = vi.fn();
    // 1) good session — populates last-known-good
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers(),
      json: async () => ({ user: { id: "u-revoke", email: "a@b.c" } }),
    });
    // 2) revocation: Neon 200 with user:null
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers(),
      json: async () => ({ user: null }),
    });
    // 3) infra blip: 5xx — must NOT fall back to the (revoked) cached session
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 503,
      headers: new Headers(),
      json: async () => ({}),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { getSession } = await import("./auth");

    const first = await getSession(reqWithSession(), HOST);
    expect(first.data?.user?.id).toBe("u-revoke");

    // Advance past the 20s happy-path cache so each subsequent call actually hits the network.
    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 25_000);
    const revoked = await getSession(reqWithSession(), HOST);
    expect(revoked.data).toBeNull(); // signed out by revocation
    expect(revoked.degraded).toBe(false);

    vi.setSystemTime(Date.now() + 5_000); // still well within the 60s resilience window
    const afterBlip = await getSession(reqWithSession(), HOST);
    vi.useRealTimers();

    // The 5xx must NOT resurrect the revoked session: no user, just degraded.
    expect(afterBlip.data).toBeNull();
    expect(afterBlip.degraded).toBe(true);
  });

  it("does NOT resurrect a session after a 4xx (definitive signed-out) then a 5xx within the window", async () => {
    const fetchMock = vi.fn();
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers(),
      json: async () => ({ user: { id: "u-4xx", email: "a@b.c" } }),
    });
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 401,
      headers: new Headers(),
      json: async () => ({}),
    });
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 500,
      headers: new Headers(),
      json: async () => ({}),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { getSession } = await import("./auth");
    const first = await getSession(reqWithSession(), HOST);
    expect(first.data?.user?.id).toBe("u-4xx");

    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 25_000);
    const signedOut = await getSession(reqWithSession(), HOST);
    expect(signedOut.data).toBeNull();
    expect(signedOut.degraded).toBe(false);

    vi.setSystemTime(Date.now() + 5_000);
    const afterBlip = await getSession(reqWithSession(), HOST);
    vi.useRealTimers();

    expect(afterBlip.data).toBeNull();
    expect(afterBlip.degraded).toBe(true);
  });
});

// M2 SECURITY: sign-out must purge the server-side session cache for the cookie key, so a
// captured cookie replayed at the same warm instance is not honored via last-known-good in
// the resilience window after sign-out.
describe("purgeSessionCacheForRequest (W4.6a M2)", () => {
  beforeEach(() => {
    vi.resetModules();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("evicts the cached session so a later 5xx replay is degraded, not last-known-good", async () => {
    const fetchMock = vi.fn();
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers(),
      json: async () => ({ user: { id: "u-logout", email: "a@b.c" } }),
    });
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 503,
      headers: new Headers(),
      json: async () => ({}),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { getSession, purgeSessionCacheForRequest } = await import("./auth");

    // Warm the last-known-good cache.
    const first = await getSession(reqWithSession(), HOST);
    expect(first.data?.user?.id).toBe("u-logout");

    // Sign-out purges the cache entry for this cookie key.
    purgeSessionCacheForRequest(reqWithSession(), HOST);

    // A replay of the same cookie that now hits a 5xx must NOT resurrect the session.
    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 25_000);
    const replay = await getSession(reqWithSession(), HOST);
    vi.useRealTimers();

    expect(replay.data).toBeNull();
    expect(replay.degraded).toBe(true);
  });
});
