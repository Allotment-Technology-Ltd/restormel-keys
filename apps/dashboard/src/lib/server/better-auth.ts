/**
 * P4 — In-process Better Auth instance for the SELF-HOSTED auth path.
 *
 * SCOPE / SAFETY: this module is ONLY imported when `AUTH_PROVIDER === "self"`
 * (see `auth.ts`, which dynamic-imports it lazily). On the default `neon` path it
 * is never loaded, so the `neon` bundle and runtime footprint are byte-for-byte
 * unchanged. Do NOT static-import this from a hot path.
 *
 * It mounts Better Auth at the EXISTING dashboard auth prefix
 * (`/keys/dashboard/api/auth`) and is backed by the operational Postgres via the
 * SAME `getPool(url)` the dual-driver DB adapter uses (plain `postgres://` → pg
 * Pool). The GitHub OAuth callback Better Auth uses on the `self` path is its own
 * `/keys/dashboard/api/auth/callback/github` (mounted under `basePath`); the
 * existing Neon callback wiring is untouched.
 *
 * Cookie naming: in production Better Auth emits `__Secure-*` cookies (because
 * `useSecureCookies` resolves true over HTTPS), so the EXISTING localhost-alias /
 * Set-Cookie rewrite machinery in `auth.ts` (`rksecure-*` ⇄ `__Secure-*`) keeps
 * working on the `self` path with zero changes.
 *
 * This is the ONLY place that constructs the Better Auth instance — keep it a
 * process singleton so the pg Pool and in-memory state are shared.
 */
import { betterAuth, type BetterAuthOptions } from "better-auth";
import { env } from "$env/dynamic/private";
import { getPool } from "$lib/server/db-adapter";
import { DASHBOARD_BASE } from "$lib/dashboard-base";
import { sendVerificationEmail as sendVerificationMail } from "$lib/server/email/verification-email";
import { sendPasswordResetEmail as sendPasswordResetMail } from "$lib/server/email/password-reset-email";

/** The auth base path — mirrors the Neon proxy prefix exactly. */
export const BETTER_AUTH_BASE_PATH = `${DASHBOARD_BASE}/api/auth`;

/** Production canonical origin. Falls back to `ORIGIN`/localhost for non-prod. */
export const PROD_ORIGIN = "https://restormel.dev";
const LOCAL_ORIGIN = "http://localhost:5173";

/** The minimal slice of env this module reads to resolve the origin. */
type OriginEnv = { NODE_ENV?: string; BETTER_AUTH_URL?: string; ORIGIN?: string };

/**
 * Resolve the public origin Better Auth should advertise. Prefer an explicit
 * operator-set origin — `BETTER_AUTH_URL`, then `ORIGIN` (set by the Node
 * adapter) — so a NON-prod PRODUCTION build (e.g. the `integration.restormel.dev`
 * pre-merge env, which runs `NODE_ENV=production` on its own host) advertises and
 * trusts ITS OWN origin rather than prod's. Fall back to the canonical
 * `restormel.dev` in production, then localhost for local dev.
 *
 * Hardening: in production an explicit origin is only honoured when it is `https://`
 * (operator typo / accidental `http://ORIGIN` falls back to the canonical prod
 * origin, never a downgraded scheme). `baseURL` for Better Auth is the ORIGIN ONLY
 * — `basePath` is appended by Better Auth, so do NOT include the path.
 */
export function resolveBaseOrigin(e: OriginEnv = env): string {
  const explicit = (e.BETTER_AUTH_URL ?? e.ORIGIN ?? "").trim().replace(/\/$/, "");
  const isProd = e.NODE_ENV === "production";
  if (explicit) {
    // In prod, refuse a non-https explicit origin and use the canonical one instead.
    if (!isProd || explicit.startsWith("https://")) return explicit;
  }
  return isProd ? PROD_ORIGIN : LOCAL_ORIGIN;
}

/**
 * Origins allowed to drive auth (CSRF / redirect allow-list). Always includes the
 * resolved base origin (so the integration env trusts its own host), plus the
 * canonical prod + localhost origins.
 */
export function resolveTrustedOrigins(e: OriginEnv = env): string[] {
  return Array.from(new Set([resolveBaseOrigin(e), PROD_ORIGIN, LOCAL_ORIGIN]));
}

/** Origins allowed to drive auth (CSRF / redirect allow-list). */
export const TRUSTED_ORIGINS = resolveTrustedOrigins();

/**
 * The Better Auth options object. Exported (separately from the instance) so it
 * can be asserted in unit tests WITHOUT constructing a live instance / DB Pool.
 */
export const betterAuthOptions = {
  appName: "Restormel Keys",
  // The pg Pool — same construction path as the dual-driver DB adapter. Better
  // Auth accepts a node-postgres Pool directly as its database.
  database: getPool(env.DATABASE_URL ?? ""),
  basePath: BETTER_AUTH_BASE_PATH,
  baseURL: resolveBaseOrigin(),
  secret: env.BETTER_AUTH_SECRET,
  trustedOrigins: TRUSTED_ORIGINS,
  socialProviders: {
    github: {
      clientId: env.GITHUB_CLIENT_ID ?? "",
      clientSecret: env.GITHUB_CLIENT_SECRET ?? "",
      // Match the scopes the Neon Auth GitHub app requests so the migrated path
      // resolves the same user identity (login + verified primary email).
      scope: ["read:user", "user:email"] as string[],
    },
  },
  user: {
    additionalFields: {
      // `resolveServiceAdminStatus(uid, role, email)` keys off `role`; keep it on
      // the user record so the self-host path produces the same operator signal.
      // `input:false` — clients can't set it; it is server/admin-managed.
      role: {
        type: "string" as const,
        required: false,
        input: false,
      },
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    async sendVerificationEmail({ user, url }: { user: { email: string }; url: string }) {
      await sendVerificationMail({ to: user.email, verifyUrl: url });
    },
  },
  emailAndPassword: {
    // Kept `enabled` so the password-reset hook (sendResetPassword) stays wired, but
    // `disableSignUp` CLOSES `POST /sign-up/email`: GitHub is the only intended login,
    // so open self-service email registration (+ `/sign-in/email` enumeration + an
    // SMTP-amplification vector via emailVerification.sendOnSignUp) must not be exposed
    // when AUTH_PROVIDER=self. (Security review of PR #329.)
    enabled: true,
    disableSignUp: true,
    async sendResetPassword({ user, url }: { user: { email: string }; url: string }) {
      await sendPasswordResetMail({ to: user.email, resetUrl: url });
    },
  },
  advanced: {
    // Emit `__Secure-*` cookie names in production (HTTPS) so the EXISTING
    // localhost-alias rewrite in `auth.ts` (which translates `__Secure-*` ⇄
    // `rksecure-*`) keeps working unchanged. Over plain HTTP (local dev) Better
    // Auth omits the prefix, matching the rewrite's localhost branch.
    useSecureCookies: env.NODE_ENV === "production",
  },
} satisfies BetterAuthOptions;

let _auth: ReturnType<typeof betterAuth> | null = null;

/** Lazily construct the process-singleton Better Auth instance. */
export function getBetterAuth(): ReturnType<typeof betterAuth> {
  if (_auth) return _auth;
  _auth = betterAuth(betterAuthOptions);
  return _auth;
}
