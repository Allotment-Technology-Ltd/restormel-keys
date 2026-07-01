---
id: REC-INC-025
title: "Huly operator account lockout — local login unrecoverable (resolved via Forgejo OIDC SSO)"
class: evidence
owner: founder
status: closed
classification: internal
control-tier: 3
created: 2026-06-29
last-reviewed: 2026-06-29
review-interval: P12M
approved-by: founder
approved-on: 2026-06-29
retention: P6Y
related: [REC-PLAN-017]
---

# Huly operator account lockout (2026-06-29)

- **Detected:** 2026-06-29 (founder reported "I can't sign into Huly — the break-glass password isn't being recognised").   **Reported by:** founder (Adam).   **Severity:** low.
- **What happened:** The founder could not sign into Huly (`huly.allotmentology.tech`). The local email/password account was unrecoverable: the password was not accepted and the account had hit its hard login-attempt lockout. There was no working self-service recovery path.
- **Impact:** Loss of operator/admin access to the **internal** Huly workspace for a few hours on 2026-06-29. **No data loss, no customer-facing impact, no external exposure.** Restormel product and prod were unaffected. Single-user internal-tool access only.
- **Response (timeline, 2026-06-29 UTC):**
  - Diagnosed the account auth model: Huly `account` service → CockroachDB `global_account` (`account`, `account_passwords`, `social_id`). Confirmed the lockout (`failed_login_attempts = 5`) and that a wrong password returns a *misleading* `AccountNotFound` (anti-enumeration), and that **no SMTP** is configured (self-service reset + email-OTP both dead).
  - Prepared a break-glass cockroach password-reset + lockout-clear script for the founder to run (DB writes are classifier-gated → founder-executed).
  - Pivoted to the durable fix: implemented **Forgejo OIDC SSO** for Huly (REC-PLAN-017 Phase 1) — gitops PR #87 (enable OIDC) + #88 (fix relative→absolute `ACCOUNTS_URL` so the OAuth `redirect_uri` matched the registered callback).
  - Found Huly links OIDC by the Forgejo **`sub`** (`oidc:<sub>`), not email; linked `oidc:1` + the canonical company email (`adam@allotmentology.tech`) to the existing account `2f2d695e…` and cleared the lockout.
  - **Resolved:** login via "Sign in with Forgejo" succeeded 2026-06-29 ~12:00 UTC (`Provider login succeeded, socialId {type: oidc, value: 1}`), resolving to the existing workspace.
- **Root cause:** A cluster of latent gaps, not a single fault:
  1. Local password incorrect/forgotten; Huly's anti-enumeration `AccountNotFound` masked that it was a password failure.
  2. A 5-attempt **hard** lockout with no time-boxed auto-unlock compounded the failure.
  3. **No SMTP** on the account service → no self-service password reset or email-OTP.
  4. **Identity split:** the Huly account was keyed to a personal email (`adam.boon1984@googlemail.com`), not the canonical company identity — so even SSO email-match would not have linked it without intervention.
- **Follow-ups:**
  - ✅ **Forgejo OIDC SSO live** (REC-PLAN-017 Phase 1) — now the primary Huly login; bypasses the local-password lockout entirely.
  - **Break-glass hardening** (REC-PLAN-017 §5 / Phase 4, RISK-001): seed the local admin with a *managed* password stored in Infisical (`huly-breakglass-admin` ExternalSecret), and review the lockout policy (time-boxed auto-unlock vs hard lock).
  - **Huly SMTP** (REC-PLAN-017 §6): wire a mail URL so self-service reset, email-OTP, and workspace invites work.
  - **Canonical identity** (`adam@allotmentology.tech`) rolled out estate-wide (REC-PLAN-017, locked 2026-06-29).
  - Delete the plaintext break-glass/link helper scripts left on the operator Mac.
  - **Closed:** 2026-06-29
