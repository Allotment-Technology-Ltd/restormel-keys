---
id: REC-INC-007
title: "Incident — PlotBudget live API down (PostgREST 42501 'permission denied to set role anon'; CNPG revoked the authenticator role memberships because they were not declared in spec.managed.roles[].inRoles)"
class: evidence
owner: "@adam"
approved-by: "@adam"
approved-on: 2026-06-23
status: closed
classification: internal
control-tier: 3
created: 2026-06-23
last-reviewed: 2026-06-23
review-interval: P12M
retention: P6Y
related: [REC-TPL-004]
---

# Incident — PlotBudget API 42501 (CNPG stripped the PostgREST authenticator's role memberships)

> Filed from REC-TPL-004. Append-only once closed. Severity **medium** — the *entire*
> PlotBudget data API (PostgREST) failed every request, but this was the newly-cutover
> self-hosted Supabase backend on K3s and the production frontend (Vercel) had **not yet been
> flipped to it** (cutover still in progress, see [[plotbudget-k3s-cutover]]). End-user impact
> was therefore **nil**, no data loss, no confidentiality/integrity impact (failure was
> deny-by-default). Caught during go-live verification.

- **Detected:** 2026-06-23 — agent/operator, during PlotBudget self-hosted-Supabase go-live
  verification on the K3s cluster (`pg-plotbudget`, namespace `cnpg-system`). The PostgREST tier
  (`api.plotbudget.com`) returned `permission denied to set role "anon"` (SQLSTATE **42501**) on
  every request. **Reported by:** agent (cutover verification). **Severity:** medium.

- **What happened:** PostgREST connects to Postgres as the **`authenticator`** role (created
  `NOINHERIT`) and `SET ROLE`s into `anon` / `authenticated` / `service_role` per request. The
  Supabase bootstrap SQL (`cluster/cnpg/configmap-plotbudget-supabase-bootstrap.yaml`) runs
  `GRANT anon, authenticated, service_role TO authenticator`. But the CNPG `Cluster` CR also
  declares `authenticator` as a **managed role** (`spec.managed.roles`) — **without** an
  `inRoles` field. CNPG reconciles a managed role's memberships to *exactly match* `inRoles`;
  with it absent (≡ empty), CNPG **REVOKED** the bootstrap's grant on its next managed-role
  reconcile. With no membership, `authenticator` could no longer `SET ROLE anon` → PostgREST
  failed every request with 42501.

- **Impact:** the PlotBudget data API (PostgREST) was **fully non-functional** — every REST
  request 42501 — on the new self-hosted backend. Because the production frontend (Vercel) had
  not yet been repointed to this backend, **no end users were affected**; no data loss, no
  confidentiality/integrity impact (a deny-by-default failure, not data exposure). The CNPG
  cluster itself stayed healthy throughout (2/2).

- **Response / timeline (2026-06-23):**
  1. Identified the 42501 from the PostgREST/app errors during go-live verification; traced it to
     the `authenticator` role having lost its `anon/authenticated/service_role` memberships.
  2. **Interim (not durable):** re-applied `GRANT anon, authenticated, service_role TO
     authenticator` via a migration-applied grant → restored service immediately, **but** CNPG
     would strip it again on the next managed-role reconcile (the grant is not authoritative
     against a CNPG-managed role).
  3. **Durable fix:** declared `inRoles: [anon, authenticated, service_role]` on the
     `authenticator` managed role in `cluster/cnpg/cluster-pg-plotbudget.yaml`
     (`restormel-gitops` commit **`e1bfc15`**) so CNPG **grants and keeps** the memberships.
     Pushed to Forgejo; Argo CD synced.
  4. **Verified durable on the live cluster** (2026-06-23, single-node `restormel-sovereign-master1`):
     - Argo app `cluster-addons` (owns `cluster/cnpg`) `syncedRev = e1bfc150…` (the fix commit).
     - Live CNPG `Cluster` CR spec: `authenticator.inRoles = [anon, authenticated, service_role]`.
     - Live DB (`pg_auth_members`): `authenticator` is a member of all three roles.
     - CNPG cluster `pg-plotbudget` in healthy state (2/2); edge (`api.plotbudget.com`) returns
       clean auth errors (`No API key found` / `Unauthorized`), **not** 42501.

- **Root cause:** CNPG's managed-role reconciler treats `spec.managed.roles[].inRoles` as the
  **authoritative** membership set for a managed role and revokes any membership not listed. The
  `authenticator` role's required memberships were granted only by **bootstrap SQL**, not declared
  in the CR, so CNPG revoked them. **A SQL `GRANT` is not durable against a CNPG-managed role** —
  membership must be declared in `inRoles`. (The `authenticator` is intentionally `NOINHERIT` /
  `inherit: false`, so it gains membership-without-inheritance — exactly what PostgREST's per-request
  `SET ROLE` needs; the fix preserves that.)

- **Remediation (done):**
  1. `inRoles` declared on the managed role (`e1bfc15`) — durable; verified live (above).
  2. **Audited the other CNPG clusters** for the same class of gap: `pg-restormel` has no
     `managed.roles` block, and `pg-platform` declares only plain login roles
     (`restormel_staging_app`, `usesophia_app`) with no `SET ROLE` requirement. **Neither uses the
     authenticator/SET-ROLE pattern, so neither is exposed.** (Recorded so a future reviewer need
     not re-check.)

- **Follow-ups:**
  - **Standing rule (carry into the K3s cluster design):** any future CNPG-managed PostgREST /
    Supabase-style cluster MUST declare role memberships in `spec.managed.roles[].inRoles` — never
    rely on a bootstrap `GRANT` alone, because CNPG reconciles a managed role's memberships *to*
    `inRoles` and will revoke anything not listed. *(open — fold into `planning/k3s-cluster-target-design.md` / CNPG conventions)*
  - **Detection gap:** there was **no alert** on the PostgREST 42501 surge — it was caught only by
    manual go-live verification. Wire an app/DB error-rate alert for the PlotBudget API (the
    monitoring stack — Alertmanager/Loki — is being stood up in the same cluster-stabilization
    pass) **before the Vercel frontend flip**. *(open — PBI)*
  - **Argo hygiene (separate, pre-existing — NOT caused by this incident):** `cluster-addons`
    shows perpetual `OutOfSync` on the CNPG `Cluster/*` and ESO `ExternalSecret/*` resources
    because CNPG/ESO mutate the live objects (defaults/status) → Argo diff. Tune
    `ignoreDifferences` so genuine drift isn't masked by the noise. *(open — part of the
    cluster-stabilization work)*
  - **Closed:** 2026-06-23 — fix `e1bfc15` synced by Argo and **verified durable** on the live
    cluster (CR spec carries `inRoles`; DB memberships present; CNPG will keep them across
    reconciles; edge clean).
