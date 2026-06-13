import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// P4 — the AUTH_PROVIDER switch (default `neon`). These tests prove:
//  (a) getSession / proxyAuthRequest select the right branch per AUTH_PROVIDER,
//  (b) the `neon` branch is unchanged (still hits the Neon HTTP fetch, never Better Auth),
//  (c) the `self` branch resolves the session via the in-process Better Auth, and
//  (d) the SAME cookie-rewrite / localhost-alias machinery applies on the `self` path
//      (a `__Secure-*` Set-Cookie from Better Auth is emitted as `rksecure-*` on localhost).
//
// The Better Auth instance is mocked (the `self` path dynamic-imports it), so no live
// DB / OAuth is required.

vi.mock("$app/environment", () => ({ dev: false }));

const HOST = "localhost:5173";
const SESSION_COOKIE = "rksecure-session=tok"; // localhost alias of __Secure-session

// --- Better Auth mock (only exercised on the `self` path) ---
const getSessionApi = vi.fn(async (_ctx: { headers: Headers; returnHeaders?: boolean }) => ({
  headers: new Headers() as Headers,
  response: null as { user?: Record<string, unknown> } | null,
}));
const handler = vi.fn(async (_req: Request) => new Response(null));
vi.mock("$lib/server/better-auth", () => ({
  BETTER_AUTH_BASE_PATH: "/keys/dashboard/api/auth",
  getBetterAuth: () => ({ api: { getSession: getSessionApi }, handler }),
}));

function reqWithSession(): Request {
  return new Request(`http://${HOST}/keys/dashboard`, { headers: { cookie: SESSION_COOKIE } });
}

function setProvider(provider: string | undefined) {
  vi.doMock("$env/dynamic/private", () => ({
    env: {
      AUTH_PROVIDER: provider,
      NEON_AUTH_BASE_URL: "https://auth.example.test",
      DATABASE_URL: "postgres://u:p@db.internal:5432/app",
    },
  }));
}

describe("AUTH_PROVIDER branch selection — getSession", () => {
  beforeEach(() => {
    vi.resetModules();
    getSessionApi.mockReset();
    handler.mockReset();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("defaults to `neon` when AUTH_PROVIDER is unset (hits Neon fetch, NOT Better Auth)", async () => {
    setProvider(undefined);
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      headers: new Headers(),
      json: async () => ({ user: { id: "u-neon", email: "a@b.c" } }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    const { getSession, authProvider } = await import("./auth");
    expect(authProvider()).toBe("neon");
    const result = await getSession(reqWithSession(), HOST);

    expect(result.data?.user?.id).toBe("u-neon");
    expect(fetchMock).toHaveBeenCalledTimes(1); // Neon HTTP path
    expect(getSessionApi).not.toHaveBeenCalled(); // Better Auth never touched
  });

  it("an unrecognised AUTH_PROVIDER value falls back to `neon` (fail-safe)", async () => {
    setProvider("garbage");
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, status: 200, headers: new Headers(), json: async () => ({ user: null }) })));
    const { authProvider } = await import("./auth");
    expect(authProvider()).toBe("neon");
  });

  it("`self` resolves the session via in-process Better Auth (NOT Neon fetch)", async () => {
    setProvider("self");
    getSessionApi.mockResolvedValueOnce({
      headers: new Headers(),
      response: { user: { id: "u-self", email: "x@y.z", role: "admin" } },
    });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const { getSession, authProvider } = await import("./auth");
    expect(authProvider()).toBe("self");
    const result = await getSession(reqWithSession(), HOST);

    expect(result.data?.user?.id).toBe("u-self");
    expect(result.data?.user?.role).toBe("admin"); // role preserved for service-admin gate
    expect(getSessionApi).toHaveBeenCalledTimes(1);
    expect(fetchMock).not.toHaveBeenCalled(); // Neon path never used
  });

  it("`self` passes the DECODED (__Secure-*) cookie to Better Auth", async () => {
    setProvider("self");
    getSessionApi.mockResolvedValueOnce({ headers: new Headers(), response: { user: { id: "u" } } });

    const { getSession } = await import("./auth");
    await getSession(reqWithSession(), HOST);

    const ctx = getSessionApi.mock.calls[0][0];
    const cookieSent = (ctx.headers as Headers).get("cookie");
    // localhost alias rksecure-* must be decoded back to __Secure-* for Better Auth.
    expect(cookieSent).toBe("__Secure-session=tok");
  });

  it("`self` re-applies the localhost cookie alias to Better Auth's Set-Cookie", async () => {
    setProvider("self");
    const respHeaders = new Headers();
    respHeaders.append("set-cookie", "__Secure-session=new; Path=/; Secure; HttpOnly; SameSite=None");
    getSessionApi.mockResolvedValueOnce({
      headers: respHeaders,
      response: { user: { id: "u-cookie" } },
    });

    const { getSession } = await import("./auth");
    const result = await getSession(reqWithSession(), HOST);

    expect(result.setCookies.length).toBe(1);
    const out = result.setCookies[0];
    // __Secure- → rksecure- on localhost, Secure stripped, SameSite=None → Lax.
    expect(out).toContain("rksecure-session=new");
    expect(out).not.toMatch(/Secure/);
    expect(out).toContain("SameSite=Lax");
  });

  it("`self` reports a clean signed-out (not degraded) when Better Auth returns no user", async () => {
    setProvider("self");
    getSessionApi.mockResolvedValueOnce({ headers: new Headers(), response: null });

    const { getSession } = await import("./auth");
    const result = await getSession(reqWithSession(), HOST);

    expect(result.data).toBeNull();
    expect(result.degraded).toBe(false);
  });

  it("`self` reports degraded (not signed-out) when Better Auth throws", async () => {
    setProvider("self");
    getSessionApi.mockRejectedValueOnce(new Error("db down"));

    const { getSession } = await import("./auth");
    const result = await getSession(reqWithSession(), HOST);

    expect(result.data).toBeNull();
    expect(result.degraded).toBe(true);
    expect(result.error).toBeInstanceOf(Error);
  });

  it("neither provider verifies a request with no session cookie (no backend call)", async () => {
    setProvider("self");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { getSession } = await import("./auth");
    const req = new Request(`http://${HOST}/keys/dashboard`, { headers: { cookie: "ph=anon" } });
    const result = await getSession(req, HOST);
    expect(result.data).toBeNull();
    expect(result.degraded).toBe(false);
    expect(getSessionApi).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("AUTH_PROVIDER branch selection — proxyAuthRequest", () => {
  beforeEach(() => {
    vi.resetModules();
    getSessionApi.mockReset();
    handler.mockReset();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("`neon` proxies over HTTP to NEON_AUTH_BASE_URL (Better Auth handler untouched)", async () => {
    setProvider("neon");
    const fetchMock = vi.fn(async (_url: string) => new Response("{}", { status: 200, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    const { proxyAuthRequest } = await import("./auth");
    const ourUrl = new URL(`http://${HOST}/keys/dashboard/api/auth/get-session`);
    const res = await proxyAuthRequest("get-session", new Request(ourUrl), ourUrl);

    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const calledUrl = fetchMock.mock.calls[0][0] as string;
    expect(calledUrl).toContain("https://auth.example.test/get-session");
    expect(handler).not.toHaveBeenCalled();
  });

  it("`self` routes through the Better Auth handler (no Neon HTTP) and rewrites Set-Cookie", async () => {
    setProvider("self");
    handler.mockResolvedValueOnce(
      new Response("{}", {
        status: 200,
        headers: {
          "content-type": "application/json",
          "set-cookie": "__Secure-session=z; Path=/; Secure; SameSite=None",
        },
      }),
    );
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const { proxyAuthRequest } = await import("./auth");
    const ourUrl = new URL(`http://${HOST}/keys/dashboard/api/auth/get-session`);
    const res = await proxyAuthRequest("get-session", new Request(ourUrl), ourUrl);

    expect(res.status).toBe(200);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(fetchMock).not.toHaveBeenCalled();

    // The Better Auth handler received a canonical URL under the auth base path.
    const baReq = handler.mock.calls[0][0] as Request;
    expect(new URL(baReq.url).pathname).toBe("/keys/dashboard/api/auth/get-session");

    // Set-Cookie rewritten for localhost.
    const getSetCookie = (res.headers as Headers & { getSetCookie?: () => string[] }).getSetCookie;
    const cookies = typeof getSetCookie === "function" ? getSetCookie.call(res.headers) : [res.headers.get("set-cookie") ?? ""];
    expect(cookies.some((c) => c.includes("rksecure-session=z"))).toBe(true);
  });
});
