---
id: REC-INC-017
title: "Incident — PlotBudget email magic-link send fails (GoTrue 500 'hook 502'; invalid Resend API key)"
class: evidence
owner: founder
status: open
classification: internal
control-tier: 3
created: 2026-06-24
last-reviewed: 2026-06-24
approved-by: founder
approved-on: 2026-06-24
retention: P6Y
related: [REC-TPL-004, REC-INC-011, AST-025]
---

# Incident — PlotBudget email magic-link send fails (invalid Resend API key)

> Filed from REC-TPL-004. Append-only once filed. Severity **low/med** — one auth path (email
> magic-link / all transactional auth emails) is down on PlotBudget self-hosted Supabase; Google
> SSO unaffected. Direct **follow-up to REC-INC-011** (PlotBudget Kong routing P0): fixing Kong
> restored Google SSO (302) and exposed that the email **send** path was independently broken.

- **Detected:** 2026-06-24 ~16:15 UTC during post-REC-INC-011 verification. Email magic-link
  sign-in returns HTTP 500. **Reported by:** founder → agent investigation. **Severity:** low/med
  (email sign-in unavailable; no data loss; no confidentiality/integrity impact; Google SSO works).

- **What happened:** `POST /auth/v1/otp` (email magic-link) returns
  `500 {"error_code":"unexpected_failure","msg":"Unexpected status code returned from hook: 502"}`.
  GoTrue runs its Send-Email hook (`GOTRUE_HOOK_SEND_EMAIL_ENABLED=true`,
  `GOTRUE_HOOK_SEND_EMAIL_URI=https://api.plotbudget.com/functions/v1/send-resend-email`); the
  `send-resend-email` edge function returns **502** because the Resend SDK call is rejected; GoTrue
  surfaces that as a 500 to the client.

- **Impact:** All transactional auth/security emails on PlotBudget self-hosted Supabase (magic-link,
  signup confirm, recovery, invite, email-change, security notifications) do not send. Email
  magic-link sign-in is unusable. **Google SSO unaffected** — `/auth/v1/authorize?provider=google`
  verified 302 before, during, and after this investigation. No other tenant affected: Restormel and
  Sophia auth/data are independent (separate CNPG clusters `pg-restormel` / `pg-platform`, both
  healthy); only the `supabase` namespace was touched, read-only except an ephemeral `--rm`
  key-validation probe pod.

- **Response / timeline (UTC, 2026-06-24):**
  - 16:14 — Reproduced: `POST /auth/v1/otp` for a test address → HTTP 500 "hook 502".
  - 16:15 — GoTrue log confirms `Hook errored out … Unexpected status code returned from hook: 502`,
    hook = `…/functions/v1/send-resend-email`.
  - Inspected `send-resend-email` function source (configmap `send-resend-email-fn-*`): it returns
    **502** only when `resend.emails.send()` errors, and **500** only if
    `RESEND_API_KEY`/`SEND_EMAIL_HOOK_SECRET` are empty. Both K8s secret keys are **present**
    (`SEND_EMAIL_HOOK_SECRET` len 53, correct `v1,whsec_` shape; `RESEND_API_KEY` len 21) — so the
    500/empty branch is excluded and the 502/Resend-reject branch is the path taken.
  - Validated the configured `RESEND_API_KEY` against the Resend API from inside the cluster
    (throwaway pod, key never printed): `GET https://api.resend.com/domains` →
    **HTTP 400 `{"message":"API key is invalid","name":"validation_error"}`**. Root cause confirmed.
  - Observed an unrelated transient blip: GoTrue logged DB-unreachable errors ~15:36–15:40 UTC
    (`pg-plotbudget` CNPG pods had restarted ~35 min prior — `57P03 shutting down`, then a brief
    `dial … operation not permitted`). By 16:14 the `pg-plotbudget` cluster was healthy (2/2 ready,
    primary `pg-plotbudget-1`) and Google authorize was a stable 302. Not the email cause; recorded
    for completeness.

- **Root cause:** The `RESEND_API_KEY` stored in the Infisical **`plotbudget`** project (env `prod`)
  is **invalid** (21 chars, does not start with `re_`; Resend rejects it as "API key is invalid").
  External Secrets Operator faithfully syncs this invalid value into the K8s secret `supabase-auth`
  (ExternalSecret `supabase-auth`, ClusterSecretStore `infisical-plotbudget` →
  `secrets.restormel.dev` project `plotbudget`/`prod`; ArgoCD app `plotbudget-supabase` ← repo
  `plotbudget-v2`, path `deploy/k3s/supabase`). **The manifests/GitOps are correct** — the fault is
  the secret **value**, i.e. a provisioning gap, not a config/code defect. No manifest change fixes it.

- **Fix:** FOUNDER-PROVISIONING action (cannot be fabricated by an agent):
  1. Create a valid Resend API key at resend.com (`re_…`) on the account that owns/verifies the
     `plotbudget.com` sending domain.
  2. Verify the sending domain `plotbudget.com` in that Resend account — the function's default
     from-address is `PLOT <hello@plotbudget.com>` (no `RESEND_FROM_EMAIL` override is set), so Resend
     will reject sends from an unverified domain even with a valid key.
  3. Set `RESEND_API_KEY` = the new `re_…` value in Infisical project `plotbudget`, env `prod`
     (this is the single key the ExternalSecret pulls).
  4. Re-verify with `plotbudget-email-reverify.sh <test-email>` (force ESO re-sync via annotation so
     there is no 1h wait, restart `send-resend-email`, then re-run the OTP path expecting 200). No
     code or manifest change required.

- **Verification (pre-fix, current state):** `POST /auth/v1/otp` → 500 "hook 502" reproduces
  reliably; the configured key fails Resend auth (400 "API key is invalid"). Google authorize stays
  302 across repeated checks; GoTrue `/auth/v1/health` 200. Post-fix expectation: OTP → 200 and a
  "Your PLOT sign-in link" email delivered.

- **Follow-ups:**
  - [FOUNDER] Provision valid Resend key + verify `plotbudget.com` domain in Resend, set in Infisical
    `plotbudget/prod` as `RESEND_API_KEY`, then run the re-verify script. **(blocking)**
  - [OPS] Add a synthetic monitor for the email-send path (periodic `resend /domains` 200 check, or an
    OTP-send canary) so an invalid/expired key is caught proactively, not at a user sign-in.
  - [OPS] Validate Resend key shape (`re_` prefix) at ESO-sync / deploy time to fail fast on a
    malformed key.

- **Status:** OPEN — pending founder Resend-key provisioning. **Closed:** `<pending>`

---

## Resolution attempt — 2026-06-24 (append-only)

A follow-up run attempted the founder-indicated fix: the founder reported the **valid** Resend API
key + from-email live in the plotbudget-v2 working copy at `apps/web/.env.local`. The intent was to
copy that key into Infisical `plotbudget`/`prod`, re-sync, and restore email send.

**Outcome: the `.env.local` key is ALSO invalid at Resend — the fix could NOT be applied. Incident
stays OPEN. This is a founder action that must be completed at Resend itself.**

- **Where the key was sourced:** `/Users/adamboon/plotbudget/apps/web/.env.local` (the local
  plotbudget-v2 working copy; `origin` = `github.com/Allotment-Technology-Ltd/plotbudget-v2`).
  `.env.local` is gitignored and was NOT present in a fresh clone — it exists only on the founder's
  machine. Keys present: `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `RESEND_REPLY_TO`. Values were
  extracted into a scoped 0600 temp file and **never printed**.
- **Shape of the `.env.local` key (shape only, no value):** length **36**, **`re_`-prefixed** — i.e.
  the *correct* Resend key shape, unlike the deployed key (21 chars, no `re_`). Cleanly extracted (no
  quotes/CR/whitespace/comment; verified by byte inspection). This looked promising.
- **Validation against Resend (the gate before writing anything):**
  `GET https://api.resend.com/domains` with the `.env.local` key →
  **HTTP 400 `{"message":"API key is invalid","name":"validation_error"}`** (consistent across
  retries). Controls run the same call: a deliberately-bogus `re_…` key → also 400; no-auth → 401;
  so 400 is a genuine Resend auth rejection and the Resend service was up. **Conclusion: the
  `.env.local` `RESEND_API_KEY`, despite the correct `re_`/36-char shape, is not a live Resend
  credential (revoked / wrong account / never issued).**
- **Guardrail honoured:** because the candidate key failed Resend validation, it was **NOT** written
  to Infisical and **no** ESO re-sync / function restart was performed — writing it would only have
  replaced one invalid key with another and forced an unnecessary pod restart. Nothing in the live
  StatefulSet/`supabase` namespace was mutated (read-only inspection + ephemeral `--rm` probes only).
- **Live state re-confirmed during this attempt (unchanged):**
  - `POST /auth/v1/otp` (and `/auth/v1/magiclink`) on `https://api.plotbudget.com` →
    **500 `unexpected_failure` "Unexpected status code returned from hook: 502"** (the bug persists).
  - **Currently-deployed** cluster key (`supabase-auth/RESEND_API_KEY`, synced from Infisical
    `plotbudget`/`prod`) re-validated against Resend → **400 invalid** (21 chars, no `re_`).
  - **Google SSO unaffected:** `GET /auth/v1/authorize?provider=google` → **302**; GoTrue
    `/auth/v1/health` → 200.
  - Adjacent services healthy: `restormel.dev` → 200, `usesophia.com` → 200, `plotbudget.com` → 200,
    `app.plotbudget.com` → 307 (auth redirect, expected).
- **Note on `.env.local` topology (for the founder):** that file's `NEXT_PUBLIC_SUPABASE_URL` points
  at a **hosted Supabase cloud** project (`jxykecjepxtxzprxheaz.supabase.co`), not the self-hosted
  `api.plotbudget.com` backend that is live in K3s. The Resend key beside it is therefore likely a
  stale/cloud-era credential, which is consistent with Resend rejecting it.

- **Required FOUNDER action (unchanged, still blocking):** issue a **genuinely valid** Resend API key
  from the Resend account that owns the **verified** `plotbudget.com` sending domain (confirm
  `GET /domains` returns 200 and `plotbudget.com` shows `status: verified`), set it as
  `RESEND_API_KEY` in Infisical `plotbudget`/`prod`, then force the `supabase-auth` ExternalSecret
  re-sync + restart `send-resend-email` and re-verify the OTP path returns 200. The `.env.local`
  value is not usable.

- **Status:** **OPEN** — `.env.local` key invalid; founder must provision a live Resend key. **Closed:** `<pending>`
