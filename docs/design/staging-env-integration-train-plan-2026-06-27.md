---
id: REC-PLAN-022
title: "Pre-merge integration env — the 'Integration Train' plan (replace preview+staging with ONE)"
class: planning
owner: founder
status: approved
classification: internal
control-tier: 2
created: 2026-06-28
last-reviewed: 2026-06-28
review-interval: P12M
approved-by: founder
approved-on: 2026-06-28
retention: review-only
related: [REC-ADR-008, REC-ADR-011, REC-INC-006]
---

> **Status: APPROVED PLAN-OF-RECORD (REC-PLAN-022).** Originally produced by a multi-agent
> planning swarm (5 readers → 4 candidate designs → synthesis), 2026-06-27; promoted to a
> governed Tier-2 planning record on 2026-06-28 once the founder locked the §Open-decisions
> (now §Locked decisions). This is the plan of record for the RES-114 "Integration Train".
> **Tier-2 classification + the `review-only` retention are the founder's to confirm** (the
> records convention normally files planning docs at Tier-1; Tier-2 here is a deliberate
> founder instruction — see the RES-114 Phase-4 PR body, blueprint open question M11).

## The ask

Collapse the two non-prod environments (`restormel-preview` + `restormel-dashboard-staging`) into
**ONE** environment that acts as the interim step between local-dev and production — specifically a
**pre-merge integration** step where separate PRs are **staged together, integrated, and tested in
a close-to-prod config _before_ merge to main**.

## Why they're broken today (root cause)

Both non-prod Argo apps are **perpetually-erroring no-ops** — they deploy nothing:

1. `applications/workloads/{restormel-preview,restormel-dashboard-staging}.yaml` set
   `source.path: charts/restormel-dashboard` with a `helm:` block, but **`charts/restormel-dashboard`
   is not a real chart** — no `Chart.yaml`, no `values.yaml` (only `templates/pbi-lifecycle-postsync.yaml`,
   a **prod-only** PostSync hook hardcoded to `restormel-prod`). `git log --all` confirms the chart
   metadata **never existed**. → Argo forces a Helm render of a non-chart → source-level
   `ComparisonError: error getting helm repos`.
2. The declared `valueFiles` (`values/restormel-{preview,dashboard-staging}.yaml`) **also never
   existed** (`values/` holds only `huly-prod.yaml`).
3. The staging `argocd-image-updater` annotation watches `registry.allotmentology.tech/...` — a
   registry the founder decided was **never created** (prod uses `git.allotmentology.tech/...`).

So there is nothing to "fix" — the chart was never built. Prod, by contrast, uses **raw manifests**
(`applications/restormel-app-prod/`, no Helm) — a known raw-vs-chart duplication.

## Recommended approach — the "Integration Train" (raw-manifest clone + batched branch)

**ONE** long-lived env **`restormel-integration`** (ns `restormel-integration`, host
`integration.restormel.dev`), deployed by **raw manifests that are a near-byte-for-byte clone of
`applications/restormel-app-prod/`** (3 edits: namespace, ingress host, replica floor). It is fed by
a **disposable `integration` git branch** that, each run, resets to `origin/main` then
**octopus-merges every open, non-draft, `stage`-labelled PR** and deploys the batch — so N separate
PRs are proven to **build + migrate + run together** _before_ any of them merges to main.

Grafted-in cost/access guards (cheap): opt-in `stage` label as the cost gate · `kubernetes-reflector`
for the wildcard-TLS namespace wiring · **Traefik forward-auth to the portal SSO** so pre-merge code
isn't public · per-PR status comments with the env URL. **Deferred** (behind a founder flag): per-PR
ephemeral ApplicationSet envs, and any Helm-chart convergence.

### Why this over the alternatives (scorecard)

| Approach | Prod fidelity | Batches PRs pre-merge | Cost on 3-node estate | Solo-maintainable | Verdict |
|---|---|---|---|---|---|
| **B — Integration Train (raw-manifest clone + batched branch)** | **Highest** (same mechanism as prod) | **Yes** (core feature) | **Near-zero** (1 dashboard+worker, a *logical* DB on existing CNPG, burst-only builds) | **High** (one env/mechanism/registry/workflow) | ✅ **BUILD (core)** |
| A — Per-PR ephemeral envs (Argo ApplicationSet PR generator) + Helm chart | High, but a *different* mechanism unless prod is migrated onto a new chart | Indirect (per-PR envs are isolated, not batched — still needs the integration branch) | Highest (per-PR fan-out threatens the 8GB node3; needs quotas/TTL/per-PR DB lifecycle) | Low (most moving parts) | ⏸ **DEFER** (great for single-PR isolation later) |
| Hybrid (B core + A's cheap guards) | Highest | Yes | Near-zero + cheap guards | High | ✅ **THIS** |
| Minimal single static staging (from main, post-merge) | Medium | **No** (post-merge only — fails the literal ask) | Lowest | High | ❌ doesn't meet the pre-merge goal |

Rationale: the founder's literal ask is "ONE env, before merge to main, all PRs staged together,
close-to-prod." Only the train delivers cross-PR + migration-ordering signal **before** main — the
per-PR `ci.yml` checks can't catch cross-PR or fail-closed-migration-ordering breaks; the train can.
Raw-manifest cloning makes fidelity **structural** (identical mechanism/shapes to prod, incl. the
fail-closed migration entrypoint + `pg_advisory_lock` gate) at far less work than authoring a chart.

## Immediate stopgap (do first, low-risk)

In ONE gitops PR, **delete** `applications/workloads/restormel-preview.yaml` +
`restormel-dashboard-staging.yaml` (both render nothing today). The app-of-apps glob stops generating
the two erroring Applications; prune them. This **instantly clears the ComparisonError noise**, loses
zero running workload, and is also decommission step 1. Do **not** try to "fix" the chart (nothing to
restore; the lone template is a prod-only hook the `restormel-nonprod` project would reject anyway).

## Phased plan

- **Phase 0 — Stopgap + dead-code sweep** *(low risk)*: delete the two broken workload apps; relocate
  the prod-only `pbi-lifecycle-postsync.yaml` hook into `applications/restormel-app-prod/`; delete the
  unbuildable `charts/restormel-dashboard/` (gitops **and** the `restormel-keys deploy/k3s/gitops/...`
  authoring source); delete the stale Coolify CI (`preview-deploy.yml`, `deploy-dashboard.yml` — both
  curl the retired `.167` Coolify API → REC-INC-006 failure mode).
- **Phase 1 — Stand up the env** *(medium; high-risk-security review required)*: clone
  `applications/restormel-app-prod/` → `applications/restormel-integration/` (ns/host/replica edits;
  keep the **Forgejo** registry path); add `applications/workloads/restormel-integration.yaml`
  (project `restormel-nonprod`, automated sync); collapse `bootstrap/appprojects.yaml`
  `restormel-nonprod` to the single `restormel-integration` ns; provision a **logical
  `restormel_integration` DB on the existing `pg-restormel` CNPG** (no new PVC → stays under the
  16-volume node cap) + an Infisical `/integration` secret folder (sandbox Paddle, separate auth /
  encryption keys) — **never** prod's `restormel_ops`; extend the wildcard-TLS reflector to the new
  ns; attach Traefik forward-auth (portal SSO). Deploy once with a hand-set tag to prove Healthy.
- **Phase 2 — CI build engine** *(medium)*: revive `.forgejo/workflows/deploy-k3s.yml` (in-cluster
  privileged buildkit Job, **outbound-only** — registry + gitops push only, never the kube-API/Coolify);
  **fix the miswired bump** (`k3s-build-push-bump.sh` currently targets non-existent helm-values → make
  it a raw-manifest image-line bump of the integration deployments); gate behind a new
  `INTEGRATION_TRAIN_ENABLED` Actions var.
- **Phase 3 — The Integration Train workflow** *(medium)*: `.forgejo/workflows/integration-train.yml`
  on a schedule + `stage`-label PR triggers → `git reset --hard origin/main` → octopus-merge each open
  non-draft `stage`-labelled PR (conflict → skip that PR + comment + `integration-conflict` label,
  continue) → build keyed to integration HEAD → bump → per-PR status comment with the env URL. The
  train **never auto-promotes to main**.
- **Phase 4 — Guards + docs + governance** *(low)*: ResourceQuota/LimitRange + idle scale-to-zero
  CronJob on the ns; `docs/DEPLOY-PIPELINE.md`; promote this to a `REC-PLAN-*` + the Huly ticket.
- **Phase 5 — DEFERRED/OPTIONAL**: per-PR ephemeral ApplicationSet envs (only on explicit founder
  go, with caps) — additive to the train, not a replacement.

## Decommission (collapse two → one)

Delete the two broken workload apps; relocate the prod hook then delete `charts/restormel-dashboard/`
in both repos; remove the dead value-file refs + the `registry.allotmentology.tech` image-updater
annotation; edit `appprojects.yaml` to a single `restormel-integration` destination; retire the
Coolify `preview-deploy.yml` + `deploy-dashboard.yml`. **Net:** two redundant, permanently-broken,
post-merge-only apps → ONE pre-merge env on the **same** mechanism/registry/namespace model as prod.

## Locked decisions (founder, 2026-06-28)

These supersede the prior "Open decisions" block. They are the decisions baked into the RES-114
build (#288 land + Phases 0–4).

1. **First train cargo — #288 merges DEFAULT-OFF.** PR #288 (host-managed Postgres graph-store
   spine, flag `connectHostManagedGraphStore`, REC-ADR-008/Stage-1) lands to main with the flag
   **off in prod**; the flag is turned **ON only in the integration env config** (Infisical
   `/integration`), never in the cloned prod manifest. The first end-to-end train exercise is
   "RES-113 onboarding + #288 together".
2. **Host + access control — `integration.restormel.dev`, behind oauth2-proxy.** The env is served
   on the `restormel.dev` domain at `integration.restormel.dev` and gated by **oauth2-proxy SSO**
   (Traefik forward-auth to the portal identity) — pre-merge code is **never public**. (Settles the
   former Q5: portal-SSO forward-auth, implemented as oauth2-proxy.)
3. **PBI-lifecycle PostSync hook — activated + relocated.** The prod-only
   `pbi-lifecycle-postsync.yaml` hook moves out of the unbuildable `charts/restormel-dashboard/`
   into `applications/restormel-app-prod/` (raw-manifest home); the chart is then deleted in both
   repos. The hook stays **prod-only** (it flips `status/ready-deploy`→`status/deployed`) and the
   integration env does **not** run it.
4. **Build surface — rootless buildkit, isolated.** The integration batch image is built on a
   **dedicated rootless buildkit isolated build surface** (not the shared/privileged prod runner),
   **outbound-only** (registry + gitops push only; never the kube-API or any box private IP —
   REC-INC-006 invariant). Forgejo (`git.allotmentology.tech`) is the **sole** non-prod registry;
   zero `registry.allotmentology.tech` references anywhere (that host was never created).
5. **Data plane — logical `restormel_integration` DB on the existing CNPG, scoped role.** A LOGICAL
   `restormel_integration` database on the existing `pg-restormel` CNPG cluster (no new PVC → stays
   under the 16-volume node cap), reached through a **dedicated, scoped `PG_INTEGRATION_APP_*`
   role** — **never** prod's `restormel_ops`, never the `PG_RESTORMEL_APP_*` role. **Empty seed,
   migrations from scratch** each cycle; never prod data.
6. **Secrets — separate Infisical `/integration` store + identity.** A separate Infisical
   `/integration` secret scope with its **own machine identity**, sandbox Paddle, and **separate
   auth/encryption keys + DATABASE_URL** — never `/dashboard/*` / prod secrets.
7. **Trigger + merge strategy — opt-in `stage` label, sequential pairwise merge, never
   auto-promotes.** The train runs on a schedule **and** on the opt-in, author-applied `stage`
   label (cost guard), gated by the `INTEGRATION_TRAIN_ENABLED` Actions var. Each run does
   `git reset --hard origin/main` then **merges each open, non-draft, `stage`-labelled PR one at a
   time (sequential pairwise merge)** — on conflict it aborts that one merge, **skips** the PR,
   comments, adds the `integration-conflict` label, and continues (pairwise lets a conflict be
   attributed to the exact PR, unlike an all-or-nothing octopus merge). The train **NEVER
   auto-promotes to main** — promotion stays manual PR→main→prod gated by the required Security
   scan. Per-PR ephemeral ApplicationSet envs remain **deferred (Phase 5)**; raw manifests are kept
   for **both** prod and integration (one mechanism, no Helm convergence).

### Founder-gated provisioning still required (Wave-2 live ops — not done by this plan)

The records/docs/manifests are authored and **held**; standing the env up needs these
founder-gated live ops: create the logical `restormel_integration` DB + `PG_INTEGRATION_APP_*`
role on `pg-restormel`; create the Infisical `/integration` store + identity (with the flag ON);
set `INTEGRATION_TRAIN_ENABLED`; apply the `restormel-integration` Argo Application + namespace
guards; wire the oauth2-proxy forward-auth + DNS for `integration.restormel.dev`.

## Affected repos/files (summary)

- **gitops** — DELETE: `applications/workloads/restormel-preview.yaml`, `restormel-dashboard-staging.yaml`, `charts/restormel-dashboard/`; NEW: `applications/restormel-integration/` (cloned manifests) + `applications/workloads/restormel-integration.yaml`; EDIT: `applications/restormel-app-prod/` (relocated hook), `bootstrap/appprojects.yaml`, wildcard-TLS reflector namespaces.
- **restormel-keys** — DELETE: `.forgejo/workflows/{preview-deploy,deploy-dashboard}.yml`, `deploy/k3s/gitops/charts/restormel-dashboard/`; NEW/REVIVE: `.forgejo/workflows/deploy-k3s.yml` (from `fix/deploy-k3s-incluster-build`) + `.forgejo/workflows/integration-train.yml`; FIX: `.forgejo/scripts/k3s-build-push-bump.sh`; NEW: `docs/DEPLOY-PIPELINE.md`.
- **Cluster/external** (no repo file): Infisical `/integration` folder; `restormel_integration` logical DB on `pg-restormel`; Forgejo Actions var `INTEGRATION_TRAIN_ENABLED`; `FORGEJO_REGISTRY` push token.

_Tracked in Huly (RES-114). The §Locked-decisions are settled (founder, 2026-06-28) and the
high-risk-security review has run (touches secrets, ingress, DB, server routes); the RES-114
build (#288 land + Phases 0–4) authors the manifests/CI/records and **holds** them for the
founder-gated Wave-2 live ops listed above. Phase-0 note: the dated stopgap below predates
gitops #73 — the two broken workload apps and the Coolify `preview-deploy.yml`/`deploy-dashboard.yml`
workflows are **already deleted from main**; the remaining Phase-0 item is the `charts/restormel-dashboard/`
relocate-then-delete in both repos._
