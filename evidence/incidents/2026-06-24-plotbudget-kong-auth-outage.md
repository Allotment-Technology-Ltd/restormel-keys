---
id: REC-INC-011
title: "Incident — PlotBudget sign-in down (app.plotbudget.com): self-hosted Supabase Kong returned 401 'No API key found' on Google OAuth because /auth/v1/authorize + /auth/v1/health were missing from the open (no-key-auth) routes; compounded by an over-aggressive Kong liveness probe crash-looping the gateway on the contended single node"
class: evidence
owner: "@adam"
approved-by: "@adam"
approved-on: 2026-06-24
status: closed
classification: internal
control-tier: 3
created: 2026-06-24
last-reviewed: 2026-06-24
review-interval: P12M
retention: P6Y
related: [REC-TPL-004, REC-INC-007, RISK-001]
---

# Incident — PlotBudget sign-in outage (Supabase Kong missing open auth routes + probe crashloop)

> Filed from REC-TPL-004. Append-only once closed. Severity **high** — full sign-in outage of a
> live production product (PlotBudget); the founder was locked out of `app.plotbudget.com`.

- **Detected:** 2026-06-24 ~08:35 UTC (founder's own failed Google sign-in attempts in the Kong
  access log; reported as a P0 live incident). **Reported by:** founder. **Severity:** high.
- **Impact:**
  - **Product:** PlotBudget (AST-025, self-hosted Supabase backend on the K3s sovereign node
    `restormel-sovereign-master1`, ns `supabase`). **Scope:** sign-in only — data plane (CNPG
    `pg-plotbudget`, PostgREST, realtime, storage) was healthy throughout.
  - **User-facing:** 100% of new sign-ins via Google OAuth failed with `401 "No API key found in
    request"` on `GET /auth/v1/authorize?provider=google`. The founder (and any user) could not log in.
  - **Duration:** the missing-route defect had been latent since the Kong config was authored;
    it became user-impacting whenever an unauthenticated OAuth start was attempted. The Kong
    crashloop (20 restarts in ~31 min) ran concurrently, adding intermittent total-gateway 5xx.
- **Response (timeline, all UTC 2026-06-24):**
  - 08:35 — founder's Google sign-in attempts log `401` on `/auth/v1/authorize`; `/auth/v1/health`
    also `401 "No API key found"`. Kong pod `kong-8d7bcfd8b-4jhd5` showing 20 restarts/31 min,
    Last State Terminated `Error` exit 137.
  - ~08:40–08:49 — diagnosis (ns `supabase` only, no secret values printed):
    - **Crashloop:** `lastState.reason = Error` (NOT `OOMKilled`), exit 137; node had no
      MemoryPressure and the 512Mi cgroup limit was never hit → the kubelet SIGKILLed Kong after
      **liveness-probe** failures, not the OOM killer. Probe was `httpGet /status :8100` with the
      default `timeoutSeconds: 1` and `failureThreshold: 3`; on this heavily-loaded single node the
      status listener intermittently missed 3 consecutive 1s probes. On restart the 20s
      `initialDelaySeconds` was too short for Kong to re-bind `:8100`, giving the
      `dial tcp …:8100: connect: connection refused` liveness failures that perpetuated the loop.
    - **401:** confirmed by probing the chain — GoTrue at origin returned `/health`→200,
      `/authorize?provider=google`→**302**, but **through Kong** `/auth/v1/health`→401 and
      `/auth/v1/authorize`→401, while `/auth/v1/verify`→passed (400, its own open route exists).
      The rendered `kong.yml` had open (cors-only) routes ONLY for `/auth/v1/verify` and
      `/auth/v1/callback`; `/auth/v1/authorize` + `/auth/v1/health` fell through to the catch-all
      `auth-v1-all` (`/auth/v1/`) route which enforces `key-auth` → 401 on every unauthenticated
      request. **NOT a key/JWT mismatch** — `/rest/v1/` correctly 401s without a key and the anon
      key worked on the routes that were correctly open.
  - 08:49 — **mitigation applied live via kubectl (justified for P0):** patched ConfigMap
    `kong-config` to add the upstream-standard open routes (`auth-v1-open-authorize` →
    `/auth/v1/authorize`, `auth-v1-open-jwks` → `/auth/v1/.well-known/jwks.json`,
    `auth-v1-open-health` → `/auth/v1/health`); patched the Deployment liveness/readiness probes
    (`timeoutSeconds: 5`, `failureThreshold: 6`, longer `initialDelaySeconds`); rolled the
    deployment so the init container re-rendered the config and Kong reloaded.
  - 08:49–08:55 — **verification** (via the real public host `api.plotbudget.com`, ingress + TLS):
    `/auth/v1/health`→**200**, `/auth/v1/authorize?provider=google`→**302 → accounts.google.com**,
    `/auth/v1/.well-known/jwks.json`→**200**, `POST /auth/v1/otp` with anon key → reaches GoTrue
    (authenticated, not 401) / without key → 401 (protected route intact). New Kong pod
    `kong-54fccf6d-wwbrj`: **0 restarts**, Ready, stable > 5 min.
  - 08:54 — **codified in gitops** so Argo reconciles to the fixed state (Argo app
    `plotbudget-supabase` has **no `automated.selfHeal`**, so the live change is not at risk of
    revert, but git must match): GitHub PR
    [#329](https://github.com/Allotment-Technology-Ltd/plotbudget-v2/pull/329) on the Argo source
    repo `plotbudget-v2`, file `deploy/k3s/supabase/70-kong.yaml`. (Argo syncs from the Forgejo
    mirror of this repo; merge → mirror → sync.)
- **Root cause:**
  - **Primary (the sign-in 401):** a **configuration defect** in the gitops-managed Kong
    declarative config (`70-kong.yaml`). The public GoTrue OAuth/health endpoints
    (`/auth/v1/authorize`, `/auth/v1/health`, and the `.well-known/jwks.json` JWKS endpoint) were
    never declared as open routes, so they inherited `key-auth` from the catch-all `auth-v1-all`
    route. Upstream Supabase's reference `kong.yml` ships `auth-v1-open-authorize` and
    `auth-v1-open-jwks`; this self-hosted config had dropped them.
  - **Secondary (the crashloop):** an **over-aggressive liveness probe** (1s timeout, 3-failure
    threshold, 20s initial delay) on Kong's `/status` endpoint, which the kubelet could not satisfy
    reliably under CPU/IO contention on the single K3s node (a manifestation of RISK-001's 131%
    memory-overcommit / single-node SPOF — contention **contributed** to the crashloop but did
    **not** cause the 401, and there was no OOM).
- **Follow-ups:**
  - [ ] **Merge PR #329** (`plotbudget-v2`) to clear the Kong ConfigMap/Deployment OutOfSync that
    the live kubectl mitigation created, and make git == live. Owner: @adam.
  - [ ] **Email magic-link (OTP) still broken — separate, pre-existing fault.** `POST /auth/v1/otp`
    with a valid anon key now reaches GoTrue but returns GoTrue `500 "Unexpected status code
    returned from hook: 502"` — the `send-resend-email` edge-function hook is failing (likely a
    Resend API key / outbound config issue; the pod is Running but emits no request logs). NOT
    caused by and NOT part of this Kong outage; Google OAuth (the reported lockout) is fully
    restored. Raise as its own PBI/incident if email sign-in is needed.
  - [ ] **Prevent recurrence:** add a CI/CD or Argo post-sync smoke check that asserts the public
    GoTrue routes (`/auth/v1/health`→200, `/auth/v1/authorize`→302/Location accounts.google.com)
    return non-401 through Kong, so a missing open route can never silently ship again.
  - [ ] **RISK-001 (single-node SPOF / memory overcommit):** no register change required — this
    incident is consistent with the already-open treatment gap (F7 right-sizing). The probe
    headroom in this fix reduces sensitivity to contention; durable fix remains the HA / workload-
    spread mitigations already tracked under RISK-001.
  - **Closed:** 2026-06-24
