import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// P4 — assert the in-process Better Auth config object WITHOUT constructing a live
// instance or touching a database. We import `betterAuthOptions` (the plain options
// object) and check the fields the cutover depends on: github provider present with
// the right scopes, the mount basePath, the trustedOrigins allow-list, and the `role`
// additional field that the service-admin gate keys off.
//
// `getPool` is mocked so importing the module never builds a real pg Pool.

vi.mock("$lib/server/db-adapter", () => ({
  getPool: vi.fn(() => ({ __fakePool: true })),
}));
vi.mock("$lib/server/email/verification-email", () => ({
  sendVerificationEmail: vi.fn(),
}));
vi.mock("$lib/server/email/password-reset-email", () => ({
  sendPasswordResetEmail: vi.fn(),
}));
vi.mock("$env/dynamic/private", () => ({
  env: {
    NODE_ENV: "production",
    DATABASE_URL: "postgres://u:p@db.internal:5432/app",
    BETTER_AUTH_SECRET: "test-secret-please-rotate",
    GITHUB_CLIENT_ID: "gh-client-id",
    GITHUB_CLIENT_SECRET: "gh-client-secret",
  },
}));

describe("betterAuthOptions (P4 self-host config)", () => {
  beforeEach(() => {
    vi.resetModules();
  });
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("mounts at the existing dashboard auth prefix", async () => {
    const { betterAuthOptions, BETTER_AUTH_BASE_PATH } = await import("./better-auth");
    expect(BETTER_AUTH_BASE_PATH).toBe("/keys/dashboard/api/auth");
    expect(betterAuthOptions.basePath).toBe("/keys/dashboard/api/auth");
  });

  it("falls back to the prod canonical origin as baseURL in production (no explicit origin set)", async () => {
    // The env mock sets neither BETTER_AUTH_URL nor ORIGIN, so prod is the fallback.
    const { betterAuthOptions } = await import("./better-auth");
    expect(betterAuthOptions.baseURL).toBe("https://restormel.dev");
  });

  it("configures the GitHub social provider with the expected scopes", async () => {
    const { betterAuthOptions } = await import("./better-auth");
    const github = betterAuthOptions.socialProviders.github;
    expect(github.clientId).toBe("gh-client-id");
    expect(github.clientSecret).toBe("gh-client-secret");
    expect(github.scope).toEqual(["read:user", "user:email"]);
  });

  it("trusts the prod + localhost origins when no explicit origin is set", async () => {
    const { betterAuthOptions } = await import("./better-auth");
    expect(betterAuthOptions.trustedOrigins).toEqual([
      "https://restormel.dev",
      "http://localhost:5173",
    ]);
  });

  it("declares a server-managed `role` additional field on user", async () => {
    const { betterAuthOptions } = await import("./better-auth");
    const role = betterAuthOptions.user.additionalFields.role;
    expect(role.type).toBe("string");
    expect(role.required).toBe(false);
    // input:false — clients cannot set their own role; it is server/admin managed.
    expect(role.input).toBe(false);
  });

  it("disables email self-service signup (GitHub-only; closes /sign-up/email)", async () => {
    const { betterAuthOptions } = await import("./better-auth");
    // enabled keeps the password-reset hook wired; disableSignUp closes open
    // registration + the SMTP-amplification vector. Locks the invariant against drift.
    expect(betterAuthOptions.emailAndPassword.enabled).toBe(true);
    expect(betterAuthOptions.emailAndPassword.disableSignUp).toBe(true);
  });

  it("emits __Secure-* cookies in production so the auth.ts alias logic applies", async () => {
    const { betterAuthOptions } = await import("./better-auth");
    expect(betterAuthOptions.advanced.useSecureCookies).toBe(true);
  });

  it("passes the secret through from env", async () => {
    const { betterAuthOptions } = await import("./better-auth");
    expect(betterAuthOptions.secret).toBe("test-secret-please-rotate");
  });
});

// Origin resolution for non-prod PRODUCTION builds (the integration pre-merge env
// runs NODE_ENV=production on integration.restormel.dev). Regression for RES-119:
// the GitHub OAuth redirect_uri + CSRF allow-list must follow the deployed host,
// not be pinned to prod restormel.dev. resolveBaseOrigin/resolveTrustedOrigins take
// an explicit env slice so we can assert each combination without re-mocking.
describe("resolveBaseOrigin / resolveTrustedOrigins (per-deployment origin)", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("honours BETTER_AUTH_URL as the origin in production (integration env)", async () => {
    const { resolveBaseOrigin, resolveTrustedOrigins } = await import("./better-auth");
    const e = { NODE_ENV: "production", BETTER_AUTH_URL: "https://integration.restormel.dev" };
    expect(resolveBaseOrigin(e)).toBe("https://integration.restormel.dev");
    expect(resolveTrustedOrigins(e)).toEqual([
      "https://integration.restormel.dev",
      "https://restormel.dev",
      "http://localhost:5173",
    ]);
  });

  it("strips a trailing slash and falls back to ORIGIN when BETTER_AUTH_URL is unset", async () => {
    const { resolveBaseOrigin } = await import("./better-auth");
    expect(
      resolveBaseOrigin({ NODE_ENV: "production", ORIGIN: "https://integration.restormel.dev/" })
    ).toBe("https://integration.restormel.dev");
  });

  it("refuses a non-https explicit origin in production and uses the canonical prod origin", async () => {
    const { resolveBaseOrigin } = await import("./better-auth");
    expect(
      resolveBaseOrigin({ NODE_ENV: "production", BETTER_AUTH_URL: "http://evil.example" })
    ).toBe("https://restormel.dev");
  });

  it("falls back to the prod origin in production when no origin is set", async () => {
    const { resolveBaseOrigin } = await import("./better-auth");
    expect(resolveBaseOrigin({ NODE_ENV: "production" })).toBe("https://restormel.dev");
  });

  it("uses localhost for local dev (non-production, no explicit origin)", async () => {
    const { resolveBaseOrigin } = await import("./better-auth");
    expect(resolveBaseOrigin({ NODE_ENV: "development" })).toBe("http://localhost:5173");
  });

  it("allows a plain-http explicit origin OUTSIDE production (local tunnels/dev)", async () => {
    const { resolveBaseOrigin } = await import("./better-auth");
    expect(
      resolveBaseOrigin({ NODE_ENV: "development", ORIGIN: "http://127.0.0.1:4173" })
    ).toBe("http://127.0.0.1:4173");
  });
});
