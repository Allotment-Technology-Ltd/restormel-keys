/**
 * C1 — Ory Hydra resource-server validation (REC-PLAN-011, Phase C).
 *
 * `verifyAccessToken(token)` validates a bearer access token issued by the
 * configured Ory Hydra. Two strategies, both Restormel-side (app-side validation
 * only — this does NOT stand up Hydra):
 *
 *   1. JWKS (preferred, stateless): verify a JWT access token's signature against
 *      Hydra's JWKS, then check `exp` / `aud` / `iss` / `scope`.
 *   2. Introspection (fallback): POST the opaque token to Hydra's admin
 *      introspection endpoint (`ORY_HYDRA_ADMIN_URL`), then check
 *      `active` / `exp` / `aud` / `scope`.
 *
 * Dependency injection is mandatory: the JWKS verifier and the introspection
 * client are passed in (or built from config at the seam), so unit tests use
 * fixtures and NEVER touch the network. The real `jose` JWKS verifier and a real
 * `fetch`-based introspection client are built only by `buildHydraVerifierFromEnv`,
 * which is NOT exercised by the hermetic tests.
 *
 * Fail closed throughout: any verification failure, missing claim, wrong audience,
 * or inactive/expired token resolves to a typed FAILURE, never a partial success.
 */

/** Validated, normalized claims handed to the workspace resolver (C2). */
export type VerifiedTokenClaims = {
  /** Token subject (Hydra `sub`). */
  subject: string;
  /** Audience(s) — already verified to include the proxy resource id. */
  audience: string[];
  /** Granted scopes (normalized to an array). */
  scopes: string[];
  /** Issuer (Hydra `iss`), when present. */
  issuer?: string;
  /** Expiry (epoch seconds), when present. */
  expiresAt?: number;
  /**
   * Full validated claim set, for the resolver to read a `workspace_id` claim
   * from when present. Never trusted for auth decisions beyond the checks above.
   */
  raw: Record<string, unknown>;
};

export type VerifyAccessTokenSuccess = {
  ok: true;
  /** Which strategy validated the token (for audit/logging; never a secret). */
  via: "jwks" | "introspection";
  claims: VerifiedTokenClaims;
};

/** Discriminated failure. `status` mirrors the chokepoint: 401 for auth failures. */
export type VerifyAccessTokenFailure = {
  ok: false;
  status: 401;
  error:
    | "missing_token"
    | "invalid_token"
    | "token_expired"
    | "token_inactive"
    | "wrong_audience"
    | "insufficient_scope"
    | "verifier_unavailable";
  message: string;
};

export type VerifyAccessTokenResult = VerifyAccessTokenSuccess | VerifyAccessTokenFailure;

/** Config the proxy's resource server validates against. */
export type HydraResourceServerConfig = {
  /** The proxy's resource identifier — the `aud` every token MUST carry. */
  audience: string;
  /** Expected issuer (`iss`). When set, JWTs must match; introspection echoes it. */
  issuer?: string;
  /**
   * Required scope. When set, the token's `scope` MUST include it. When unset,
   * any scope passes (the workspace resolver still fails closed downstream).
   */
  requiredScope?: string;
  /** Clock skew tolerance in seconds for `exp`/`nbf` checks (default 0). */
  clockToleranceSeconds?: number;
  /**
   * Optional upper bound on token age (seconds since `iat`), enforced by jose on
   * the JWKS path. When set, tokens older than this are rejected even if `exp`
   * is still in the future. Unset ⇒ only `exp` bounds lifetime.
   */
  maxTokenAgeSeconds?: number;
};

/**
 * JWKS verifier seam. Given a JWT, returns its verified payload, or throws.
 * In production this wraps `jose.jwtVerify(token, createRemoteJWKSet(jwksUri), …)`.
 * In tests it is a fixture that returns a payload or throws.
 */
export type JwksJwtVerifier = (token: string) => Promise<{ payload: Record<string, unknown> }>;

/** Shape of an RFC 7662 introspection response (the fields we consume). */
export type IntrospectionResult = {
  active: boolean;
  sub?: string;
  aud?: string | string[];
  scope?: string;
  exp?: number;
  iss?: string;
  [k: string]: unknown;
};

/**
 * Introspection client seam. Given an opaque token, returns the introspection
 * result. In production this POSTs to `ORY_HYDRA_ADMIN_URL`. In tests it is a
 * fixture. Returning `null` means "introspection unavailable" → fail closed 401.
 */
export type IntrospectionClient = (token: string) => Promise<IntrospectionResult | null>;

export type VerifyAccessTokenDeps = {
  config: HydraResourceServerConfig;
  /** Preferred path. When present, tried first. */
  jwksVerifier?: JwksJwtVerifier;
  /** Fallback path. Used when JWKS is absent or cannot verify the token. */
  introspect?: IntrospectionClient;
};

function fail(
  error: VerifyAccessTokenFailure["error"],
  message: string,
): VerifyAccessTokenFailure {
  return { ok: false, status: 401, error, message };
}

function toArray(value: string | string[] | undefined): string[] {
  if (Array.isArray(value)) return value;
  if (typeof value === "string" && value.length > 0) return [value];
  return [];
}

/** Hydra/OAuth `scope` is a space-delimited string; normalize to an array. */
function parseScopes(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((s): s is string => typeof s === "string");
  if (typeof value === "string") return value.split(/\s+/).filter(Boolean);
  return [];
}

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

/** Common post-decode checks shared by both strategies. Fail closed. */
function checkClaims(
  raw: Record<string, unknown>,
  config: HydraResourceServerConfig,
  opts: { skipExpiry?: boolean } = {},
): VerifyAccessTokenFailure | null {
  const tolerance = config.clockToleranceSeconds ?? 0;

  // `exp` is REQUIRED. A token without a numeric `exp` never expires, so it would
  // validate indefinitely — reject it fail-closed rather than skip the check.
  // (jose's `requiredClaims: ["exp"]` guards the JWKS path; this guards the
  // introspection path and is a defence-in-depth backstop for both.)
  if (!opts.skipExpiry) {
    if (typeof raw.exp !== "number") {
      return fail("token_expired", "Access token is missing a valid expiry (exp)");
    }
    if (raw.exp + tolerance < nowSeconds()) {
      return fail("token_expired", "Access token has expired");
    }
  }

  const aud = toArray(raw.aud as string | string[] | undefined);
  if (!aud.includes(config.audience)) {
    return fail("wrong_audience", "Access token audience does not include this resource");
  }

  // When an issuer is configured it MUST be asserted. jose enforces `iss` on the
  // JWKS path, but introspection results flow only through this check — so a
  // missing/non-string `iss` must be rejected here, not silently skipped.
  if (config.issuer) {
    if (typeof raw.iss !== "string") {
      return fail("invalid_token", "Access token is missing a valid issuer (iss)");
    }
    if (raw.iss !== config.issuer) {
      return fail("invalid_token", "Access token issuer mismatch");
    }
  }

  if (config.requiredScope) {
    const scopes = parseScopes(raw.scope);
    if (!scopes.includes(config.requiredScope)) {
      return fail("insufficient_scope", "Access token is missing the required scope");
    }
  }

  return null;
}

function toClaims(
  raw: Record<string, unknown>,
  via: VerifyAccessTokenSuccess["via"],
): VerifyAccessTokenSuccess {
  return {
    ok: true,
    via,
    claims: {
      subject: typeof raw.sub === "string" ? raw.sub : "",
      audience: toArray(raw.aud as string | string[] | undefined),
      scopes: parseScopes(raw.scope),
      issuer: typeof raw.iss === "string" ? raw.iss : undefined,
      expiresAt: typeof raw.exp === "number" ? raw.exp : undefined,
      raw,
    },
  };
}

/**
 * Validate a bearer access token. JWKS first (stateless), introspection as
 * fallback. Returns a typed success with normalized claims, or a 401 failure.
 *
 * No network here — the verifier and introspection client are injected.
 */
export async function verifyAccessToken(
  token: string | null | undefined,
  deps: VerifyAccessTokenDeps,
): Promise<VerifyAccessTokenResult> {
  const trimmed = (token ?? "").trim();
  if (!trimmed) {
    return fail("missing_token", "Bearer access token required");
  }

  if (!deps.jwksVerifier && !deps.introspect) {
    // No way to validate — fail closed rather than admit an unverified token.
    return fail("verifier_unavailable", "No Hydra verifier configured");
  }

  // --- Strategy 1: JWKS (preferred, stateless JWT verification) ---
  if (deps.jwksVerifier) {
    let jwksPayload: Record<string, unknown> | null = null;
    try {
      const { payload } = await deps.jwksVerifier(trimmed);
      jwksPayload = payload;
    } catch {
      // Signature/format failure. Only fall through to introspection if it is
      // available; otherwise this is a hard 401 (do NOT silently accept).
      if (!deps.introspect) {
        return fail("invalid_token", "Access token signature could not be verified");
      }
      jwksPayload = null;
    }

    if (jwksPayload) {
      const claimFailure = checkClaims(jwksPayload, deps.config);
      if (claimFailure) return claimFailure;
      return toClaims(jwksPayload, "jwks");
    }
  }

  // --- Strategy 2: introspection (fallback, opaque tokens) ---
  if (deps.introspect) {
    let result: IntrospectionResult | null;
    try {
      result = await deps.introspect(trimmed);
    } catch {
      return fail("verifier_unavailable", "Token introspection failed");
    }
    if (!result) {
      return fail("verifier_unavailable", "Token introspection unavailable");
    }
    if (!result.active) {
      return fail("token_inactive", "Access token is not active");
    }

    // Introspection already asserts `active` (which subsumes expiry server-side),
    // but we still re-check `exp` defensively when present.
    const claimFailure = checkClaims(result as Record<string, unknown>, deps.config);
    if (claimFailure) return claimFailure;
    return toClaims(result as Record<string, unknown>, "introspection");
  }

  return fail("invalid_token", "Access token could not be validated");
}

/**
 * Build the production Hydra verifier deps from `ORY_HYDRA_*` env. Uses `jose`
 * for stateless JWKS verification and `fetch` for admin introspection.
 *
 * NOT called by the hermetic unit tests. It is the only place that touches the
 * network/`jose`, keeping the verifier core fully injectable and test-isolated.
 * Returns `null` when required env is absent (e.g. flag OFF / not configured) so
 * callers fail closed.
 */
export async function buildHydraVerifierFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): Promise<VerifyAccessTokenDeps | null> {
  const audience = (env.ORY_HYDRA_AUDIENCE ?? "").trim();
  const issuer = (env.ORY_HYDRA_ISSUER ?? "").trim() || undefined;
  const jwksUri = (env.ORY_HYDRA_JWKS_URI ?? "").trim();
  const adminUrl = (env.ORY_HYDRA_ADMIN_URL ?? "").trim();
  const requiredScope = (env.ORY_HYDRA_REQUIRED_SCOPE ?? "").trim() || undefined;
  const maxTokenAgeRaw = Number.parseInt((env.ORY_HYDRA_MAX_TOKEN_AGE_SECONDS ?? "").trim(), 10);
  const maxTokenAgeSeconds =
    Number.isFinite(maxTokenAgeRaw) && maxTokenAgeRaw > 0 ? maxTokenAgeRaw : undefined;

  if (!audience) return null;
  if (!jwksUri && !adminUrl) return null;

  const config: HydraResourceServerConfig = {
    audience,
    issuer,
    requiredScope,
    clockToleranceSeconds: 5,
    maxTokenAgeSeconds,
  };

  let jwksVerifier: JwksJwtVerifier | undefined;
  if (jwksUri) {
    // Lazy import keeps `jose` out of the hot path / test graph.
    const { createRemoteJWKSet, jwtVerify } = await import("jose");
    const jwks = createRemoteJWKSet(new URL(jwksUri));
    jwksVerifier = async (token: string) => {
      const { payload } = await jwtVerify(token, jwks, {
        audience,
        issuer,
        clockTolerance: config.clockToleranceSeconds,
        // Reject any JWT that does not carry an `exp` claim — without this a
        // signature-valid token with no expiry would verify indefinitely.
        requiredClaims: ["exp"],
        // Optional belt-and-braces lifetime cap (needs `iat`); unset ⇒ omitted.
        ...(maxTokenAgeSeconds !== undefined ? { maxTokenAge: maxTokenAgeSeconds } : {}),
      });
      return { payload: payload as Record<string, unknown> };
    };
  }

  let introspect: IntrospectionClient | undefined;
  if (adminUrl) {
    const endpoint = `${adminUrl.replace(/\/+$/, "")}/admin/oauth2/introspect`;
    introspect = async (token: string) => {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ token }),
      });
      if (!res.ok) return null;
      return (await res.json()) as IntrospectionResult;
    };
  }

  return { config, jwksVerifier, introspect };
}
