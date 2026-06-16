/**
 * C1 tests — Ory Hydra resource-server validation (REC-PLAN-011).
 *
 * Hermetic: tokens are signed/verified in-process against a fixture key pair, and
 * introspection is an in-memory table. NO network. Asserts JWKS-preferred,
 * introspection-fallback, and fail-closed rejection of expired / inactive /
 * wrong-aud / wrong-issuer / unscoped / unverifiable tokens.
 */
import { beforeAll, describe, expect, it } from "vitest";
import {
  verifyAccessToken,
  type HydraResourceServerConfig,
  type VerifyAccessTokenDeps,
} from "./verify-access-token.js";
import {
  makeKeys,
  mintToken,
  makeJwksVerifier,
  makeIntrospectionClient,
  type TokenKeys,
} from "./test-fixtures.js";

const AUDIENCE = "proxy-resource";
const ISSUER = "https://hydra.example";

const CONFIG: HydraResourceServerConfig = {
  audience: AUDIENCE,
  issuer: ISSUER,
  requiredScope: "connect.proxy",
  clockToleranceSeconds: 0,
};

let keys: TokenKeys;

beforeAll(async () => {
  keys = await makeKeys();
});

function jwksDeps(): VerifyAccessTokenDeps {
  return { config: CONFIG, jwksVerifier: makeJwksVerifier(keys) };
}

describe("verifyAccessToken — JWKS (preferred path)", () => {
  it("accepts a valid signed JWT and normalizes claims", async () => {
    const token = await mintToken(keys, {
      subject: "sub-a",
      audience: AUDIENCE,
      issuer: ISSUER,
      workspaceId: "ws-a",
      scope: "connect.proxy openid",
    });
    const res = await verifyAccessToken(token, jwksDeps());
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.via).toBe("jwks");
    expect(res.claims.subject).toBe("sub-a");
    expect(res.claims.audience).toContain(AUDIENCE);
    expect(res.claims.scopes).toEqual(["connect.proxy", "openid"]);
    expect(res.claims.raw.workspace_id).toBe("ws-a");
  });

  it("rejects an empty / missing token (401 missing_token)", async () => {
    const res = await verifyAccessToken("", jwksDeps());
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.status).toBe(401);
    expect(res.error).toBe("missing_token");

    const res2 = await verifyAccessToken(null, jwksDeps());
    expect(res2.ok).toBe(false);
  });

  it("rejects an expired token (401 token_expired)", async () => {
    const token = await mintToken(keys, {
      audience: AUDIENCE,
      issuer: ISSUER,
      workspaceId: "ws-a",
      scope: "connect.proxy",
      expiresInSeconds: -10,
    });
    // jose's jwtVerify itself throws on expiry; that surfaces as invalid_token.
    // Either way the result is a fail-closed 401 — assert that contract.
    const res = await verifyAccessToken(token, jwksDeps());
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.status).toBe(401);
    expect(["token_expired", "invalid_token"]).toContain(res.error);
  });

  it("rejects a wrong-audience token (401)", async () => {
    const token = await mintToken(keys, {
      audience: "some-other-resource",
      issuer: ISSUER,
      workspaceId: "ws-a",
      scope: "connect.proxy",
    });
    // Use a verifier that does NOT pre-filter audience, so checkClaims does it.
    const deps: VerifyAccessTokenDeps = {
      config: CONFIG,
      jwksVerifier: makeJwksVerifier(keys, { issuer: ISSUER }),
    };
    const res = await verifyAccessToken(token, deps);
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.status).toBe(401);
    expect(res.error).toBe("wrong_audience");
  });

  it("rejects a wrong-issuer token (401)", async () => {
    const token = await mintToken(keys, {
      audience: AUDIENCE,
      issuer: "https://evil.example",
      workspaceId: "ws-a",
      scope: "connect.proxy",
    });
    const deps: VerifyAccessTokenDeps = {
      config: CONFIG,
      jwksVerifier: makeJwksVerifier(keys, { audience: AUDIENCE }),
    };
    const res = await verifyAccessToken(token, deps);
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error).toBe("invalid_token");
  });

  it("rejects a token missing the required scope (401 insufficient_scope)", async () => {
    const token = await mintToken(keys, {
      audience: AUDIENCE,
      issuer: ISSUER,
      workspaceId: "ws-a",
      scope: "openid",
    });
    const res = await verifyAccessToken(token, jwksDeps());
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error).toBe("insufficient_scope");
  });

  it("rejects an unverifiable token when no fallback is configured (401 invalid_token)", async () => {
    const res = await verifyAccessToken("not-a-jwt", jwksDeps());
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error).toBe("invalid_token");
  });

  it("rejects a signature-valid token with no exp (401 token_expired)", async () => {
    // A JWT that carries no `exp` would otherwise validate indefinitely. The
    // fixture verifier (like a permissive JWKS verifier) does NOT require `exp`,
    // so this asserts the in-code fail-closed backstop in checkClaims. In
    // production buildHydraVerifierFromEnv additionally passes jose
    // `requiredClaims: ["exp"]`, rejecting it one layer earlier.
    const token = await mintToken(keys, {
      audience: AUDIENCE,
      issuer: ISSUER,
      workspaceId: "ws-a",
      scope: "connect.proxy",
      noExp: true,
    });
    const res = await verifyAccessToken(token, jwksDeps());
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.status).toBe(401);
    expect(res.error).toBe("token_expired");
  });
});

describe("verifyAccessToken — introspection (fallback path)", () => {
  it("falls back to introspection for an opaque (non-JWT) token", async () => {
    const deps: VerifyAccessTokenDeps = {
      config: CONFIG,
      jwksVerifier: makeJwksVerifier(keys),
      introspect: makeIntrospectionClient({
        "opaque-a": {
          active: true,
          sub: "sub-a",
          aud: AUDIENCE,
          iss: ISSUER,
          scope: "connect.proxy",
          exp: Math.floor(Date.now() / 1000) + 300,
          workspace_id: "ws-a",
        },
      }),
    };
    const res = await verifyAccessToken("opaque-a", deps);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.via).toBe("introspection");
    expect(res.claims.raw.workspace_id).toBe("ws-a");
  });

  it("rejects an inactive token (401 token_inactive)", async () => {
    const deps: VerifyAccessTokenDeps = {
      config: CONFIG,
      introspect: makeIntrospectionClient({ "dead-token": { active: false } }),
    };
    const res = await verifyAccessToken("dead-token", deps);
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error).toBe("token_inactive");
  });

  it("rejects an active token with the wrong audience (401 wrong_audience)", async () => {
    const deps: VerifyAccessTokenDeps = {
      config: CONFIG,
      introspect: makeIntrospectionClient({
        "wrong-aud": {
          active: true,
          sub: "sub-a",
          aud: "some-other-resource",
          iss: ISSUER,
          scope: "connect.proxy",
          // valid exp + iss so this case isolates the audience check
          exp: Math.floor(Date.now() / 1000) + 300,
        },
      }),
    };
    const res = await verifyAccessToken("wrong-aud", deps);
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error).toBe("wrong_audience");
  });

  it("fails closed when introspection is unavailable (401 verifier_unavailable)", async () => {
    const deps: VerifyAccessTokenDeps = {
      config: CONFIG,
      introspect: makeIntrospectionClient({ "no-result": null }),
    };
    const res = await verifyAccessToken("no-result", deps);
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error).toBe("verifier_unavailable");
  });

  it("rejects an active token with no exp (401 token_expired)", async () => {
    // RFC 7662 makes `exp` optional in the response. An active token with no
    // `exp` would otherwise be treated as never-expiring on the Restormel side;
    // checkClaims must reject it fail-closed.
    const deps: VerifyAccessTokenDeps = {
      config: CONFIG,
      introspect: makeIntrospectionClient({
        "no-exp": {
          active: true,
          sub: "sub-a",
          aud: AUDIENCE,
          iss: ISSUER,
          scope: "connect.proxy",
          // exp intentionally omitted
        },
      }),
    };
    const res = await verifyAccessToken("no-exp", deps);
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.status).toBe(401);
    expect(res.error).toBe("token_expired");
  });

  it("rejects an active token with no iss when an issuer is configured (401 invalid_token)", async () => {
    // jose enforces `iss` on the JWKS path; introspection results flow only
    // through checkClaims, so a missing/non-string `iss` must be rejected here.
    const deps: VerifyAccessTokenDeps = {
      config: CONFIG,
      introspect: makeIntrospectionClient({
        "no-iss": {
          active: true,
          sub: "sub-a",
          aud: AUDIENCE,
          scope: "connect.proxy",
          exp: Math.floor(Date.now() / 1000) + 300,
          // iss intentionally omitted
        },
      }),
    };
    const res = await verifyAccessToken("no-iss", deps);
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.status).toBe(401);
    expect(res.error).toBe("invalid_token");
  });

  it("rejects an active token with a non-string iss when an issuer is configured (401 invalid_token)", async () => {
    const deps: VerifyAccessTokenDeps = {
      config: CONFIG,
      introspect: makeIntrospectionClient({
        "bad-iss": {
          active: true,
          sub: "sub-a",
          aud: AUDIENCE,
          scope: "connect.proxy",
          exp: Math.floor(Date.now() / 1000) + 300,
          // a hostile/malformed iss that is not a string
          iss: 1234 as unknown as string,
        },
      }),
    };
    const res = await verifyAccessToken("bad-iss", deps);
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.status).toBe(401);
    expect(res.error).toBe("invalid_token");
  });
});

describe("verifyAccessToken — no verifier configured", () => {
  it("fails closed with 401 verifier_unavailable", async () => {
    const res = await verifyAccessToken("anything", { config: CONFIG });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.status).toBe(401);
    expect(res.error).toBe("verifier_unavailable");
  });
});
