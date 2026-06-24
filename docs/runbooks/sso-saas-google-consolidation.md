---
title: SaaS → Google Login Consolidation (Founder Actions)
class: technical
owner: founder
status: approved
classification: internal
control-tier: 1
created: 2026-06-24
last-reviewed: 2026-06-24
review-interval: P12M
---

# SaaS → Google Login Consolidation (Founder Actions)

> Step 3 of `SSO-CONSOLIDATION-PLAN.md`. These are **third-party account
> settings the founder must change** — they cannot be automated from the codebase
> and there is **no agent action** here. Consolidate the SaaS we can onto **Google
> Workspace** (the IdP we already run) via "Sign in with Google" / SAML — **not**
> the self-hosted portal (the portal is the IdP for the self-hosted estate only).

## Principle (locked)

- **Consolidatable** (auth-only SaaS): standardise on **Google login**.
- **Financial / banking vendors** (Paddle, FreeAgent, Mettle): **keep independent
  strong auth** by policy — do **not** consolidate.
- **Email host (Migadu), Hetzner**: keep own login + MFA.

## Per-vendor steps

### GitHub (org) — ✅ realistic
1. Each member: GitHub → **Settings → Password and authentication** → ensure the
   account email is the Google Workspace email; sign in via "Continue with Google"
   where used.
2. Org-wide enforcement (true SSO) requires **GitHub Enterprise SAML**. If not on
   Enterprise: rely on members using Google-backed accounts + **mandatory 2FA**
   enforced at the org level (Org → Settings → Authentication security → Require
   two-factor authentication).
3. Audit: Org → People → confirm 2FA column all green.

### Notion — ✅ realistic (now), SAML is Enterprise-gated
1. Now: members use **"Continue with Google"** on sign-in.
2. Full SAML SSO (enforced) needs the **Enterprise plan**. If/when on Enterprise:
   Settings → Security & identity → **SAML SSO** → configure with Google as IdP.

### Vercel — ✅ realistic
1. Members: sign in with **"Continue with Google"**.
2. Team SAML / enforced SSO needs an **Enterprise** team: Team → Settings →
   **Security & Privacy → SAML SSO** (Google IdP).

### PostHog (EU) — ✅ partial
1. Now: **Google OAuth login** is supported — members sign in with Google.
2. **SAML enforcement** is a higher-tier feature; enable under Organization →
   **Settings → Authentication domains / SSO** if the plan allows.

### Hetzner — ⚠️ limited
- No real SSO. Keep its own login + **enable its MFA** (Account → Security).

### Paddle / FreeAgent / Mettle — ❌ do NOT consolidate
- Financial vendors. Keep **independent credentials + strong MFA** per policy.
  Do not route through Google or the portal.

### Migadu — ❌ own login
- Mailbox host. Keep its own login + MFA.

## After the changes (ISMS)

- Update the access-control posture / sub-processor notes if any vendor's auth
  method changed materially (`restormel-isms-records`).
- This is a **decision + org-config** task, not infra — no PR, no deploy.
