# Neon operator security (human checklist)

Agents **cannot** enable Neon 2FA via repo code. Operators with **Neon organization Admin** must configure the console. Canonical Neon docs:

- Personal 2FA: [Accounts — Two-factor authentication](https://neon.com/docs/manage/accounts#two-factor-authentication)
- Org-wide requirement: [Manage organizations — Require 2FA for organization members](https://neon.com/docs/manage/orgs-manage#require-2fa-for-organization-members)
- Roles: [User permissions](https://neon.com/docs/manage/user-permissions)

## Checklist (Allotment / Restormel production org)

Complete before relying on Neon for **user BYOK ciphertext** and dashboard Postgres:

1. **Every Neon org Admin** enables personal 2FA (authenticator app) in **Account settings**.
2. In the **production organization** → **Settings** → enable **Require 2FA for all members** (only after at least one admin has 2FA on their own account).
3. **People** page: confirm admins show 2FA enrolled; remove or downgrade stale admins.
4. **Personal API keys** (Neon console): minimum count; rotate if exposed; never commit; prefer CI secrets (`DASHBOARD_DATABASE_URL_PROD`, etc.) in GitHub Actions only.
5. **Project access**: use **Member** vs **Admin** least privilege; collaborators only on needed projects.
6. **Branches**: production credentials only in protected env; preview branches isolated per [database-neon-for-self-hosters.md](../../../../docs/guides/database-neon-for-self-hosters.md).
7. **Neon Auth** (if used): review org/plugin settings per branch; webhook endpoints HTTPS-only.

## Neon Auth (dashboard sign-in) vs Console 2FA

Fetched via Neon MCP docs (2026-06): **two different products.**

| Layer | MFA / 2FA today? | Source |
|-------|-------------------|--------|
| **Neon Console account** (console.neon.tech) | **Yes** — TOTP authenticator app; org can **require 2FA** for all members | [Accounts — Two-factor authentication](https://neon.com/docs/manage/accounts.md#two-factor-authentication), [Require 2FA for organization members](https://neon.com/docs/manage/orgs-manage.md#require-2fa-for-organization-members) |
| **Neon Auth** (GitHub OAuth / app users on restormel.dev) | **MFA plugin: not yet** — roadmap lists **“MFA support — Coming soon”** | [Neon Auth roadmap](https://neon.com/docs/auth/roadmap.md) |

Neon Auth **does** support **Email OTP**, **Phone Number**, and **Magic Link** plugins (passwordless / verification flows). Those are **not** a substitute for per-login TOTP MFA on every session. See [Email OTP](https://neon.com/docs/auth/guides/plugins/email-otp.md).

**Implication for Restormel:** Console/org 2FA protects operators who manage Neon; **end-user and operator dashboard sessions** do not get Neon-managed TOTP MFA until Neon Auth ships MFA. Mitigate with GitHub account security, email verification ([production checklist](https://neon.com/docs/auth/production-checklist.md)), and app-layer controls (`isServiceAdmin`, no secrets in logs).

## Mapping to Restormel dashboard

| Restormel surface | Neon control |
|-------------------|--------------|
| `DATABASE_URL` / migrations on `main` | Org project + branch access; **Console** 2FA on admins who can read connection strings |
| `NEON_AUTH_BASE_URL` | Auth plugin config; **no MFA plugin yet** — email verification + OAuth only |
| Service admin dashboard routes | App-layer `service_admins` / Neon Auth **`admin` role** + Neon **Console** admin are **three separate** controls |

## Verification prompt for security reviews

When a PR touches migrations, Neon env docs, or production runbooks, add to the Pre-PR report:

> **Neon operator:** Confirm org-wide 2FA requirement is enabled and all Admins enrolled (console check).

No automated test in-repo proves 2FA; record **“Operator confirmed YYYY-MM-DD”** in PR body when audited.
