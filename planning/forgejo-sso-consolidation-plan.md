---
id: REC-PLAN-027
title: Forgejo-rooted SSO consolidation (estate-wide single sign-on)
class: planning
owner: founder
status: draft
classification: internal
control-tier: 1
created: 2026-06-29
last-reviewed: 2026-06-29
review-interval: P6M
retention: review-only
related: [REC-PLAN-013, REC-PLAN-016]
---

# Forgejo-rooted SSO consolidation

**Goal:** one identity — a Forgejo account — signs you into **every** app and service via the
launchpad, with no per-app second login. Folds in two latent defects surfaced by the 2026-06-29
Huly lockout: a fragile break-glass and Huly's missing SMTP.

**Decision locked (founder, 2026-06-29):** Forgejo is the **single root OIDC identity provider**
(direct federation — the launchpad is a Forgejo *client*, not an OIDC broker). Break-glass
hardening + Huly SMTP are **in scope**. Infisical stays **out** (its OIDC/SAML is a paid tier).

---

## 1. Where we are today (already half-built)

Two SSO mechanisms run in parallel:

1. **Portal forward-auth gate** (decision **D-M14**: "reuse forward-auth, NO oauth2-proxy"). A
   Traefik `forwardAuth` middleware on every `*.allotmentology.tech` app calls
   `https://allotmentology.tech/api/forward-auth` (the launchpad's Better-Auth session). Gates
   **Grafana, ArgoCD, Huly, db-console (CloudBeaver/Studio)**. This already delivers
   "access via the launchpad" — but it only gates **network access**.
2. **oauth2-proxy → Forgejo OIDC** — integration env only (`integration.restormel.dev`), because
   the Better-Auth cookie is scoped to `.allotmentology.tech` and can't cross apexes. **Proves
   Forgejo is a working OIDC provider** (`--provider=oidc`, issuer `https://git.allotmentology.tech/`,
   trailing slash required).

**The gap:** the forward-auth gate does not log you *into* an app that has its own identity. Huly
does — behind the gate you still hit **Huly's own account login** (the local email/password that
locked you out). Two logins; the second is the fragile one. The break-glass route
(`huly-admin.allotmentology.tech`, IP-allowlisted, portal-bypassing) exists because the **portal is
the SSO single point of failure (RISK-001)** — but it still dumps you at that same local password.

---

## 2. Target architecture — Forgejo as the one root IdP

Forgejo issues identity; everything federates to it. Three integration tiers:

| Tier | Mechanism | Gives | Apps |
|------|-----------|-------|------|
| **A — Native OIDC → Forgejo** | App's own OIDC config → `https://git.allotmentology.tech/` | Real identity + roles, **one login** | **Launchpad** (Better Auth + Forgejo social provider), **Grafana** (`auth.generic_oauth`), **ArgoCD** (`oidc.config`), **Huly** (account `OPENID_*`) |
| **B — oauth2-proxy forward-auth → Forgejo** | The integration-env pattern, reused | Access gate only (no native login) | CloudBeaver / Supabase Studio, any bare web UI |
| **C — Out of scope** | Keeps own auth + documented break-glass | — | **Infisical** (paid OIDC), bootstrap/root consoles |

The launchpad stays the hub, but its **own** login becomes Forgejo, so **one Forgejo sign-in
cascades to everything**, and the existing forward-auth gate now rides on a Forgejo-backed session
instead of being its own identity island. Native OIDC (Tier A) also dissolves the cross-apex cookie
problem — each app mints its own session post-OIDC, independent of cookie domain.

---

## 3. Huly — the headline (config-only, **verified feasible**)

Confirmed 2026-06-29: `hardcoreeng/account:v0.7.423` reads **`OPENID_CLIENT_ID`,
`OPENID_CLIENT_SECRET`, `OPENID_ISSUER`** (generic OIDC, alongside GitHub/Google). So Huly SSO is a
**config change, not a code change**:

1. Register a Forgejo **OAuth2 application** "Huly" → client id/secret. Callback =
   `${ACCOUNTS_URL}/auth/openid/callback` *(confirm exact path against this build before apply)*.
2. Add to the account Deployment (via ESO → `huly-secret`): `OPENID_ISSUER=https://git.allotmentology.tech/`,
   `OPENID_CLIENT_ID`, `OPENID_CLIENT_SECRET`.
3. **Email-match links the existing account**: the Forgejo identity's email
   (`adam.boon1984@googlemail.com`) matches the existing Huly account → "Sign in with Forgejo"
   drops straight into the workspace. **Kills the second login.**
4. Keep `DISABLE_SIGNUP=true` + retain a managed local admin strictly for break-glass.

**Phase 1 BUILT — gitops PR #87 (WIP, 2026-06-29).** The vendored chart was already OIDC-capable;
PR flips `auth.oidc.clientId` (mount gate, `values/huly-prod.yaml`) so the account Deployment mounts
`OPENID_CLIENT_ID/SECRET/ISSUER`, and the ESO ExternalSecret (`applications/huly/40-externalsecret.yaml`)
renders them into `huly-secret` (issuer = non-secret git literal; id/secret ← Infisical
`/huly/HULY_OPENID_CLIENT_ID|SECRET`). **Both huly Argo apps are LIVE auto-sync → merge = deploy**
(stale "MANUAL sync" comments corrected). WIP-gated on the founder confirming the two Infisical key
names. Forgejo self-registration verified **disabled**. The post-deploy unknown = whether v0.7.423's
openid handler links by email to the *password*-origin account (vs minting a separate one) — break-glass
stays the fallback. High-risk-security review: **PASS WITH NOTES**.

---

## 4. Forgejo IdP mechanics (cross-cutting)

- **OAuth2 apps — secret topology DECIDED (founder, 2026-06-29):** **one shared Forgejo OAuth2
  application carrying many redirect URIs**, with its single `client_id`/`client_secret` stored
  **once** in a shared Infisical **infra** project that every namespace references — so a rotation is
  a one-place change. *Interim:* Huly reuses the existing `restormel-integration` app (its Huly
  callback added) with the secret **duplicated** into the `/huly` folder; consolidation to the single
  infra-project secret happens **once Huly OIDC is proven**. **Accepted risk** (see §9): a shared
  `client_secret` has estate-wide blast radius and loses per-app revoke/audit isolation — deliberately
  traded for rotation simplicity at solo-founder scale.
- **Discovery:** `https://git.allotmentology.tech/.well-known/openid-configuration`; issuer must
  carry the **trailing slash** (oauth2-proxy + others do strict issuer matching).
- **Roles/groups:** **RESOLVED (Phase 0, 2026-06-29) — Forgejo DOES emit a `groups` claim.** The
  discovery doc lists `groups` in **both** `scopes_supported` *and* `claims_supported`
  (`['openid','profile','email','groups']`). The claim carries the user's orgs/teams, so Grafana +
  ArgoCD can map team→role natively. Request the `groups` scope from each client.
- **Canonical identity — `adam@allotmentology.tech` (LOCKED, founder 2026-06-29).** ONE company
  email is the single identity across the estate: it is the Forgejo primary email (the IdP source of
  truth, org `Allotment-Technology-Ltd:owners`) and every downstream app must key the operator account
  to it — **launchpad** (Better Auth user), **Huly**, **Grafana**, **ArgoCD**, **Supabase Studio**, etc.
  This is what OIDC email-match links on. The 2026-06-29 Huly failure was exactly an identity split
  (Huly account = personal `adam.boon1984@googlemail.com` ≠ Forgejo `adam@allotmentology.tech`) → fixed
  by adding the company email as a verified social_id on the existing Huly account (kept the googlemail
  as a local-password fallback). **Per-app rollout:** as each app joins SSO, ensure its operator account
  uses `adam@allotmentology.tech` (add-as-alias where the app supports multiple emails; migrate where it
  doesn't). **Caveat:** non-email-principal systems (e.g. **Postgres roles**) don't take an email — there
  "register this email" means the human-facing console/owner account (Supabase Studio, pgAdmin), not the
  DB role itself; the DB role stays role-based and is reached *through* an SSO'd console.
- **MFA becomes centralised:** Forgejo TOTP/WebAuthn becomes the MFA for the whole estate → enable
  + enforce MFA on Forgejo as part of this (supersedes per-app MFA gaps, e.g. the portal's no-MFA note).

---

## 4a. Phase 0 — confirmed foundations (2026-06-29)

All four Phase-0 confirmations are **done** (read-only checks against live Forgejo + the Huly account
image). Phase 0 needs no code; its only *action* item is the founder registering the OAuth2 apps (below).

**Confirmed:**

| Item | Result |
|------|--------|
| Forgejo `groups` claim | **YES** — in `scopes_supported` + `claims_supported` (see §4). |
| OIDC issuer | `https://git.allotmentology.tech/` (trailing slash present). |
| authorize / token / userinfo / jwks | `/login/oauth/authorize` · `/login/oauth/access_token` · `/login/oauth/userinfo` · `/login/oauth/keys`. |
| Huly OIDC callback | account `ACCOUNTS_URL=/_accounts` (host-relative) + callback `/auth/openid/callback` ⇒ **`https://huly.allotmentology.tech/_accounts/auth/openid/callback`**. Confirm against the first live attempt — Forgejo allows multiple redirect URIs, so add the exact one if Huly sends a variant. |

**OAuth2 app registration — founder action, in the Forgejo UI** (Settings → Applications → *Create OAuth2
Application*). Registering in the UI keeps each `client_secret` entirely founder-side: it goes Forgejo →
clipboard → Infisical and **never** passes through the agent or a file. (The agent's token lacks
`write:user`, so it cannot — and by hygiene should not — create these.) Tick **Confidential Client** on all.

| App | Redirect URI | Register when |
|-----|-------------|---------------|
| **Huly** | `https://huly.allotmentology.tech/_accounts/auth/openid/callback` | **now** (Phase 1 next) |
| **Launchpad** (Better Auth) | `https://allotmentology.tech/api/auth/callback/forgejo` *(confirm Better-Auth providerId)* | Phase 2 |
| **Grafana** | `https://grafana.allotmentology.tech/login/generic_oauth` | Phase 3 |
| **ArgoCD** | `https://argo.allotmentology.tech/auth/callback` | Phase 3 |

After registering Huly: put `OPENID_CLIENT_ID` + `OPENID_CLIENT_SECRET` into Infisical (`huly` scope).
The agent then wires the ESO key-refs + account-Deployment env (`OPENID_ISSUER`/`_CLIENT_ID`/`_CLIENT_SECRET`)
via a gitops PR — **no secret values in the PR**.

**Role-mapping per app (decided Phase 0):**

| App | Identity | Role source |
|-----|----------|-------------|
| **Huly** | email-match links the existing account | **identity only** — v0.7 account service has no group→role map; workspace roles stay in Huly. |
| **Launchpad** | Forgejo social login | single-founder = the admin; groups claim available later for multi-user. |
| **Grafana** | `auth.generic_oauth` | `role_attribute_path` JMESPath over `groups` → org `Allotment-Technology-Ltd` (or a dedicated `admins` team) = `Admin`, else `Viewer`. |
| **ArgoCD** | `oidc.config` (request `groups` scope) | `policy.csv`: `g, <forgejo-group>, role:admin`; default = read-only. |

---

## 5. Break-glass hardening (RISK-001) — in scope

The lockout exposed two SPOFs. Re-rooting on Forgejo **moves** the SPOF from the portal to Forgejo,
so break-glass must be designed deliberately:

- **Forgejo is now the identity SPOF** → it needs (a) its own robust local-admin recovery, (b) the
  crown-jewels DR/HA it already has, (c) a documented "Forgejo down" matrix per app.
- **Per-app network bypass:** keep the IP-allowlisted portal-bypass routes (e.g.
  `huly-admin.allotmentology.tech`) for the case where the IdP/gate is down — but the credential
  behind them must be **properly managed** (password-manager, rotated, a tier-≥2 record), not a
  half-remembered password.
- **Codify the last-resort runbook:** the cockroach `account_passwords` reset + lockout-clear used
  on 2026-06-29 becomes a documented, access-controlled break-glass runbook (not ad-hoc).
- **Lockout policy:** review the 5-attempt hard lock (it compounded the incident) — consider a
  time-boxed auto-unlock.

---

## 6. Huly SMTP (the missing piece) — in scope

Huly's account service has **no mail URL** → `requestPasswordReset` and email-OTP both fail
("Please provide email service url"). Wire a mail service / SMTP relay URL into the account
Deployment so: self-service password reset works, email-OTP works, and workspace invites send. With
Forgejo OIDC primary this matters less for *login*, but it's still required for invites/notifications
and for the local break-glass account's own recovery.

---

## 7. Phased rollout

- **Phase 0 — Foundations. ✅ DONE (2026-06-29, see §4a).** `groups` claim confirmed, endpoints +
  Huly callback confirmed, role-mapping decided. Only the founder's UI registration of the OAuth2 apps
  remains (Huly first) — that's the single gate into Phase 1.
- **Phase 1 — Huly OIDC (highest value; fixes the lockout pain).** Wire `OPENID_*` → Forgejo; test
  email-match link to the existing account; retain local admin break-glass.
- **Phase 2 — Launchpad → Forgejo.** Better Auth gains "Sign in with Forgejo" as the primary
  provider; the forward-auth gate now rides a Forgejo-backed portal session.
- **Phase 3 — Grafana + ArgoCD native OIDC.** Replace/augment portal-forward-auth with real identity
  + role mapping (admin vs viewer from Forgejo teams).
- **Phase 4 — Break-glass hardening + Huly SMTP.** Per-app break-glass matrix; managed local-admin
  credentials; Huly mail URL; lockout-policy review; codified reset runbook.
- **Phase 5 — Consolidate.** Decommission redundant auth paths; document the estate auth map; enforce
  Forgejo MFA.

---

## 8. Open decisions / to confirm before execution

1. ~~Does Forgejo emit an OIDC `groups` claim?~~ **RESOLVED (Phase 0): yes** — see §4a.
2. ~~Huly's exact OIDC callback URL for v0.7.423.~~ **RESOLVED (Phase 0):**
   `https://huly.allotmentology.tech/_accounts/auth/openid/callback` (verify on first live attempt).
3. Tier-B apps: keep portal-forward-auth, or move all to oauth2-proxy→Forgejo for single-IdP purity?
4. Mail transport for Huly SMTP: dedicated relay vs the existing transactional-email path.
5. Enforce Forgejo MFA estate-wide as part of Phase 5, or as a fast-follow?

---

## 9. Risks

- **Shared `client_secret` blast radius (ACCEPTED, founder 2026-06-29)** — the single shared OAuth2
  app means one leaked secret compromises every app's OIDC, and there's no per-app revoke/rotate/audit
  isolation. Accepted in exchange for one-place rotation at solo-founder scale; revisit if multi-user
  or if any consuming namespace's trust level diverges. Mitigation: the secret lives only in Infisical
  (ESO-delivered, never in git) and Forgejo self-registration is disabled.
- **IdP SPOF shifts to Forgejo** — mitigated by crown-jewels DR + a real Forgejo break-glass.
- **Role-claim gap** — if Forgejo can't emit groups, RBAC depth on Grafana/ArgoCD is limited until
  worked around.
- **Migration double-auth window** — during cutover an app may briefly require both the old gate and
  the new OIDC; sequence per-app and test before removing the old path.
