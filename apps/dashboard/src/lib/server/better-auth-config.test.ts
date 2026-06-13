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
vi.mock("$lib/server/email/send-mail", () => ({
  sendVerificationEmail: vi.fn(),
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

  it("uses the prod canonical origin as baseURL in production", async () => {
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

  it("trusts only the prod + localhost origins", async () => {
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

  it("emits __Secure-* cookies in production so the auth.ts alias logic applies", async () => {
    const { betterAuthOptions } = await import("./better-auth");
    expect(betterAuthOptions.advanced.useSecureCookies).toBe(true);
  });

  it("passes the secret through from env", async () => {
    const { betterAuthOptions } = await import("./better-auth");
    expect(betterAuthOptions.secret).toBe("test-secret-please-rotate");
  });
});
