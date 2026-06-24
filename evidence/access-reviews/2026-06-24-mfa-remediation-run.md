---
id: REC-EVID-002
title: "MFA remediation run — 2026-06-24 (RISK-008)"
class: evidence
owner: founder
status: approved
approved-by: "[PLACEHOLDER — Adam Boon on PR merge]"
approved-on: "[PLACEHOLDER — set on merge]"
classification: internal
control-tier: 3
created: 2026-06-24
last-reviewed: 2026-06-24
review-interval: P12M
retention: P6Y
---

# MFA remediation run — 2026-06-24

- **Trigger:** scheduled task `isms-mfa-remediation` (RISK-008, High).
- **Mode:** unattended (no operator present).
- **Reviewer/agent:** Cowork (Restormel ISMS session).
- **Scope:** the 12 in-scope systems in `access-control-policy.md` §3.

## Outcome in one line

MFA was **not auto-enrolled** on any system. Enrolment requires a second factor only
the founder controls and cannot be completed safely or verifiably unattended; doing so
risks lock-out of banking and production infrastructure. This record captures the
status assessment, the decision and its rationale, and a short enrolment runbook so the
founder can complete the control quickly. **RISK-008 remains open.**

## Decision and rationale (noted per unattended-run convention)

1. **No second factor to enrol.** MFA needs a TOTP seed in the founder's authenticator,
   an SMS-capable device, or a passkey/hardware key. An unattended agent cannot create a
   factor the founder controls; enrolling an agent-generated factor would require
   escrowing the secret — which defeats MFA and creates a single point of compromise.
2. **Lock-out blast radius is severe.** A half-completed enrolment can lock the account
   on next login. In-scope accounts include business banking (Mettle), payments
   (Paddle), the production host (Hetzner/Coolify) and the canonical repo (Forgejo).
3. **No safe independent verification unattended.** Driving logged-in browser sessions
   into these crown-jewel accounts risks step-up-auth prompts, security alerts and
   lock-outs; banking is out of scope for agent action by policy. Account-settings MFA
   state is therefore not machine-verifiable here, so nothing is asserted as "Enabled".
4. **Integrity over appearance.** Per ISMS rule, governance is never invented: no row is
   marked "✅ Enabled" without verification. Statuses are left **Pending — founder**.

> Connected MCP/OAuth integrations (Google, PostHog, Sentry, Neon, Notion, etc.) prove
> API access only; they are **not** evidence of interactive-login MFA and were not
> treated as such.

## Per-system status (as recorded in `access-control-policy.md` §3)

| # | System | Priority | Status this run | Note |
|---|---|---|---|---|
| 1 | Google Workspace (admin) | 1 — Urgent | Pending — founder to enrol | Highest sensitivity; prefer passkey + authenticator app. |
| 2 | Hetzner control panel | 1 — Urgent | Pending — founder to enrol | Production host owner. |
| 3 | Coolify | 1 — Urgent | Pending — founder to enrol | App/infra control plane. |
| 4 | Forgejo (git.allotmentology.tech) | 1 — Urgent | Pending — founder to enrol | Canonical governance repo. |
| 5 | Mettle | 1 — Urgent | Pending confirm | Bank-enforced under PSD2 SCA — almost certainly already on; confirm in-app. |
| 6 | Paddle | 1 — Urgent | Pending — founder to enrol | Billing / customer data. |
| 7 | FreeAgent | 2 — High | Pending — founder to enrol | Financial records. |
| 8 | GitHub | 2 — High | Pending — founder to enrol | Code mirror (not primary). |
| 9 | PostHog EU | 2 — High | Pending — founder to enrol | Analytics. |
| 10 | Sentry | 2 — High | Pending — founder to enrol | Error tracking. |
| 11 | Neon | 3 — Medium | Pending — enrol if active | Decommissioning; skip if account already closed. |
| 12 | Notion | 3 — Medium | Pending — founder to enrol | Internal tooling. |

## Enrolment runbook (~20 minutes, founder)

Do Priority 1 first. For each: log in → open the security/2FA settings → add an
authenticator (TOTP) **and** save the backup/recovery codes to the secrets store →
where offered, add a passkey. Record the date in §3.

1. **Google Workspace (admin):** myaccount.google.com → Security → 2-Step Verification.
   Add authenticator + a passkey; print/save backup codes. Consider enforcing 2SV org-wide.
2. **Hetzner:** console.hetzner.com → Account → Two-Factor Authentication → enable TOTP; save recovery codes.
3. **Coolify:** Coolify UI → Profile/Account → Two-Factor Authentication → enable TOTP.
4. **Forgejo:** User Settings → Security → Two-Factor Authentication → enable TOTP; save scratch codes.
5. **Mettle:** Mettle app → Profile/Settings → Security — confirm 2FA/biometric is on (bank-enforced).
6. **Paddle:** vendors.paddle.com → Account/Profile → Security → enable 2FA.
7. **FreeAgent:** Settings → Security → enable two-step verification.
8. **GitHub:** Settings → Password and authentication → Two-factor authentication → enable (authenticator + passkey).
9. **PostHog EU:** Settings → (account) → Two-factor authentication → enable.
10. **Sentry:** Settings → Account → Security → Two-factor authentication → enable.
11. **Neon:** console.neon.tech → Account/Profile security — enable if the account is still active; otherwise note as closed.
12. **Notion:** Settings → My account / Security → Two-step verification → enable.

After each, update the matching row in `access-control-policy.md` §3 to
`✅ Enabled (2026-06-DD)` and append a note here. When Priority 1 + 2 are all confirmed,
move RISK-008 to `in-treatment` (or `closed` if every in-scope system is done).

## Standing control (already in policy)

New-service onboarding already requires MFA within 24 hours and a confirmation task
(`access-control-policy.md` §2 and §3). No change needed; restated here for traceability.

## Residual items

- **RISK-008:** remains **open**, rating **High**, until Priority 1 + 2 confirmed.
- **Next action owner:** founder. **Suggested by:** 2026-07-01.
