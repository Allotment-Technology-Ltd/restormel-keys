# P4 — Self-hosted Better Auth (scaffold + cutover plan)

Status: **SCAFFOLD LANDED. NOT cut over. Default = `neon`.** Production behaviour is
byte-for-byte unchanged until an explicit, owner-gated flip of `AUTH_PROVIDER=self`.

P4 follows P3 (self-hosted Postgres, see `p3-self-hosted-postgres-runbook.md`): the
operational database is already a plain `postgres://` reachable via the dual-driver
adapter. P4 makes the dashboard able to run auth IN-PROCESS against that same database
instead of proxying to managed Neon Auth — but keeps Neon Auth as the live default.

## Architecture

Two server chokepoints carry all auth, in `apps/dashboard/src/lib/server/auth.ts`:
`getSession()` and `proxyAuthRequest()`. Everything else (`hooks.server.ts`,
`session-auth-cache.ts`, `auth-change.ts`, `hooks.client.ts`, the `session-cache`
route, `logout/+page.server.ts`) consumes the `GetSessionResult` contract and is
unchanged.

A single env switch selects the backend:

```
AUTH_PROVIDER = "neon" (default) | "self"
```

- **`neon` (default):** today's HTTP proxy to `NEON_AUTH_BASE_URL`. Untouched.
- **`self`:** an in-process Better Auth instance (`$lib/server/better-auth.ts`),
  backed by the operational Postgres via the EXISTING `getPool(url)` from the
  dual-driver adapter (plain `postgres://` → pg Pool). Better Auth is
  **lazily / dynamic-imported** only on this path, so the `neon` bundle and runtime
  footprint are unchanged.

```
                         ┌─ AUTH_PROVIDER=neon (default) ─► HTTP proxy → NEON_AUTH_BASE_URL  (unchanged)
getSession() ───────────►│
proxyAuthRequest() ──────►│
                         └─ AUTH_PROVIDER=self ───────────► in-process Better Auth
                                                              (getPool(DATABASE_URL))
                                ▲
                                └── BOTH paths then run the SAME, transport-agnostic
                                    Set-Cookie / localhost-alias / degraded /
                                    last-known-good machinery already in auth.ts.
```

### How the switch branches

- `authProvider()` reads `env.AUTH_PROVIDER`, defaulting to `"neon"`; any
  unrecognised value also resolves to `neon` (fail-safe to the known-good path).
- `getSession()` keeps ONE cache / in-flight-dedupe / degraded path; only the
  verification source differs: `fetchSessionFromNeon` (HTTP) vs `fetchSessionFromSelf`
  (`auth.api.getSession({headers, returnHeaders:true})`). Both return the identical
  `GetSessionResult` shape, so consumers need zero changes. The `self` path preserves
  the fail-closed posture: a definitive signed-out EVICTS last-known-good; a throw is
  reported as `degraded` (never a silent demotion).
- `proxyAuthRequest()` dispatches to `proxyToNeon` (unchanged) or `proxyToBetterAuth`
  (`auth.handler(request)`), then re-applies `rewriteAuthSetCookiesForHost` so the
  cookie machinery is identical.

### Cookies

Better Auth emits `__Secure-*` cookies in production (`advanced.useSecureCookies`
resolves true over HTTPS), so the existing `__Secure-*` ⇄ `rksecure-*` localhost
alias / Set-Cookie rewrite in `auth.ts` works unchanged on the `self` path.

### GitHub OAuth (self path)

- `socialProviders.github` with `clientId/clientSecret` from `GITHUB_CLIENT_ID/SECRET`
  and scopes `read:user user:email` (matching what Neon Auth's GitHub app requests, so
  the same identity resolves).
- `initiate/github/+server.ts` (self branch): `auth.api.signInSocial` →
  302 to the GitHub authorization URL, forwarding any challenge cookie.
- GitHub redirects to Better Auth's own `/keys/dashboard/api/auth/callback/github`
  (mounted under `basePath`), which sets the session cookie, then redirects to
  `/api/auth/redeem`.
- `redeem/+server.ts` (self branch): there is NO Neon `neon_auth_session_verifier`;
  it just consumes `rm_auth_return` and 302s to the post-auth landing.
- **The Neon GitHub OAuth app + its callback are NOT changed by this scaffold.**

### Email (self path)

`$lib/server/email/send-mail.ts` — nodemailer SMTP over implicit TLS (port 465,
`secure:true`). Mailbox mapping:

| Category                      | From      | Reply-To  |
| ----------------------------- | --------- | --------- |
| transactional (verify, reset) | notify@   | contact@  |
| security / ops alerts         | admin@    | admin@    |

`EMAIL_FROM` defaults to `Restormel Keys <notify@restormel.dev>`, `EMAIL_REPLY_TO` to
`contact@restormel.dev`. Better Auth's `sendVerificationEmail` / `sendResetPassword`
hooks call into this module.

## Schema parity (Better Auth 1.4.9 vs `migrations/002_better_auth.sql`)

Generated the table/column model Better Auth 1.4.9 expects for THIS config
(github social + emailAndPassword + emailVerification + the `role` additional field)
via `getAuthTables(options)` and diffed it against `002_better_auth.sql`:

- `session` — all columns present.
- `account` — all columns present (incl. `idToken`, token-expiry fields, `scope`,
  `password`).
- `verification` — all columns present.
- `user` — **MISSING exactly one column: `role`**, required by the
  `user.additionalFields.role` config that `resolveServiceAdminStatus(uid, role, email)`
  keys off.

Fix: ONE additive, idempotent migration —
`apps/dashboard/migrations/067_better_auth_self_host_parity.sql`:
`ALTER TABLE "user" ADD COLUMN IF NOT EXISTS role TEXT;`. `002` is NOT edited. No
backfill (`role` NULL is already treated as "no role claim" by the gate, which falls
back to the service-owner email / id allow lists).

## Cutover steps (DOCUMENTED ONLY — not executed here)

1. **Provision GitHub OAuth app** for the self-host callback
   `https://restormel.dev/keys/dashboard/api/auth/callback/github`; set
   `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET`.
2. **Generate `BETTER_AUTH_SECRET`** (`openssl rand -base64 32`); set SMTP_* +
   EMAIL_* for transactional mail.
3. **Apply migration `067`** to the operational Postgres (additive; safe to run any
   time before cutover).
4. **Resolve the user-ID reconciliation decision** (below) BEFORE flipping — this is
   the gating item, not the env flip.
5. **Dry-run on staging**: set `AUTH_PROVIDER=self` on `staging.restormel.dev`; verify
   GitHub sign-in, session persistence across navigations, sign-out, the degraded /
   last-known-good behaviour, and service-admin gating end to end.
6. **Flip prod**: set `AUTH_PROVIDER=self` in the dashboard service env.
   **Rollback = unset / `AUTH_PROVIDER=neon`** (instant; no schema rollback needed —
   `067` is additive).

## User-ID reconciliation — **OWNER-PENDING (gating)**

Neon Auth issues its own user IDs; self-hosted Better Auth issues its own. Existing
rows keyed by the Neon user id (`users`, `service_admins`, workspace ownership,
project ownership, founders rows, etc.) will NOT match a freshly-issued Better Auth id
for the same human unless reconciled.

Options (decision NOT made here — deliberately out of scope for the scaffold):

- **(A) ID preservation** — import/migrate existing Neon Auth user IDs into the
  Better Auth `"user"` table so ownership joins keep working unchanged.
- **(B) Email-based remap** — rekey app rows from old → new id by matching verified
  email at first self-host sign-in.
- **(C) Fresh start** — accept new IDs (only viable pre-launch / with negligible
  existing accounts).

No backfill / reconciliation code is written in this scaffold. The cutover MUST NOT
proceed until the owner picks an option and a reconciliation plan + dry-run exists.

## Risk register

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| Cutover before ID reconciliation orphans ownership / admin grants | — | High | Gated on the OWNER-PENDING decision above; cutover step 4 blocks step 6. |
| Accidental default flip (prod on `self` unintentionally) | Low | High | Default is `neon`; unrecognised values fail-safe to `neon`; env is documented as owner-gated. |
| Cookie-name mismatch breaks sessions on `self` | Low | High | `useSecureCookies` in prod emits `__Secure-*`; existing alias rewrite reused unchanged; covered by tests. |
| `better-auth` version drift vs root `@better-auth/core` override | Low | Med | Pinned to `1.4.9` matching the existing root pnpm override; schema generated against 1.4.9. |
| SMTP misconfig silently drops verification mail | Med | Med | Implicit-TLS 465 config + mailbox mapping unit-tested; verify in staging dry-run (step 5). |
| In-process auth adds load to the operational Postgres | Low | Med | Reuses the existing pooled `getPool`; session cache (20s) + status cache (30s) unchanged. |
| GitHub OAuth callback divergence | Low | High | Self-host uses Better Auth's own `/callback/github`; the Neon GitHub app + callback are untouched. |

## What is tested vs deferred to the cutover dry-run

Tested (no live Postgres / OAuth — mocked / injected):

- `getSession` / `proxyAuthRequest` select the correct branch per `AUTH_PROVIDER`;
  the `neon` branch is unchanged (still hits the Neon HTTP fetch, never Better Auth);
  default + unrecognised values resolve to `neon`.
- The Better Auth options object: github provider + scopes, `basePath`,
  `trustedOrigins`, the `role` additional field, `useSecureCookies` in prod, secret.
- Email mapping: transactional → notify@ / contact@; security → admin@ / admin@;
  the verification hook sends a transactional message; env overrides apply.
- The cookie-rewrite / localhost-alias still applies on the `self` path
  (`__Secure-*` → `rksecure-*`, Secure stripped, SameSite=None → Lax), and the decoded
  cookie is what Better Auth receives.

Deferred to the cutover dry-run (step 5):

- Real GitHub OAuth round-trip and session cookie set on the real `/callback/github`.
- Real SMTP delivery.
- End-to-end service-admin gating against real rows (depends on the ID
  reconciliation decision).
- Live Postgres schema apply of `067` and connection behaviour under load.
