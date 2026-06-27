---
title: "Pre-merge integration env — the 'Integration Train' plan (replace preview+staging with ONE)"
class: technical
owner: founder
status: draft
classification: internal
control-tier: 1
created: 2026-06-27
last-reviewed: 2026-06-27
review-interval: P6M
---

> **Status: PLAN — awaiting founder decisions (§Open decisions).** Produced by a multi-agent
> planning swarm (5 readers → 4 candidate designs → synthesis), 2026-06-27. Promote to a tier-2
> `REC-PLAN-*` once the decisions below are locked.

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

## Open decisions (need founder call before Phase 1)

1. **Train trigger:** schedule + `stage`-label opt-in *(recommended — cost guard)* vs default-on for all mergeable PRs?
2. **Opt-in label name + who applies it** (suggest `stage`, author-applied)?
3. **Integration data plane:** a *logical* `restormel_integration` DB on the existing `pg-restormel` CNPG *(recommended — no new PVC)* vs a dedicated small CNPG cluster?
4. **Seed the integration DB** from empty (migrations from scratch — cleanest) vs a redacted prod clone?
5. **Access control** on `integration.restormel.dev`: portal SSO forward-auth *(recommended)* vs basicAuth vs IP allowlist?
6. **Defer per-PR ephemeral envs (Phase 5)?** *(recommended: defer)*
7. **Confirm the Forgejo registry as the single non-prod registry** and kill every `registry.allotmentology.tech` reference?
8. **Keep raw manifests for both prod + integration** *(recommended — one mechanism)* vs a later Helm-chart convergence?
9. **Confirm the train never auto-promotes to main** — promotion stays manual PR→main→prod gated by the required Security scan?

## Affected repos/files (summary)

- **gitops** — DELETE: `applications/workloads/restormel-preview.yaml`, `restormel-dashboard-staging.yaml`, `charts/restormel-dashboard/`; NEW: `applications/restormel-integration/` (cloned manifests) + `applications/workloads/restormel-integration.yaml`; EDIT: `applications/restormel-app-prod/` (relocated hook), `bootstrap/appprojects.yaml`, wildcard-TLS reflector namespaces.
- **restormel-keys** — DELETE: `.forgejo/workflows/{preview-deploy,deploy-dashboard}.yml`, `deploy/k3s/gitops/charts/restormel-dashboard/`; NEW/REVIVE: `.forgejo/workflows/deploy-k3s.yml` (from `fix/deploy-k3s-incluster-build`) + `.forgejo/workflows/integration-train.yml`; FIX: `.forgejo/scripts/k3s-build-push-bump.sh`; NEW: `docs/DEPLOY-PIPELINE.md`.
- **Cluster/external** (no repo file): Infisical `/integration` folder; `restormel_integration` logical DB on `pg-restormel`; Forgejo Actions var `INTEGRATION_TRAIN_ENABLED`; `FORGEJO_REGISTRY` push token.

_Tracked in Huly (RES). Build follows after the §Open-decisions are locked + a high-risk-security review (touches secrets, ingress, DB, server routes)._
