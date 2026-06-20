# Argo CD GitOps scaffolding — sovereign K3s migration

Reviewable **config + docs only**. No infra is applied by anything in this directory;
there are no apply scripts and **no secrets** (External Secrets Operator delivers all
secret material from the self-hosted Infisical — design §6).

Source of truth: [`planning/k3s-cluster-target-design.md`](../../../planning/k3s-cluster-target-design.md)
§8 (CI/CD — **Argo CD over Flux**). Companion build doc:
[`DEPLOY-PIPELINE.md`](./DEPLOY-PIPELINE.md) (how the deploy workflow changes).

## What this is

The GitOps control plane for the K3s cluster:

- **Argo CD** install (Helm values, **pinned**: chart `9.5.22` → appVersion **`v3.4.4`**, the
  version named in the design doc).
- An **app-of-apps** root `Application` that renders every child `Application`.
- **Per-app `Application` manifests** for the workloads, with **prod sync = MANUAL**
  (prod is never main-auto-deploy) and **auto-sync only on staging**.

## Version pins (verified 2026-06-20)

| Component | Version | Note |
|---|---|---|
| Argo CD (app) | `v3.4.4` | named in design §8 |
| `argo-cd` Helm chart | `9.5.22` | artifacthub `argoproj/argo`, appVersion v3.4.4 |
| Argo CD Image Updater | `stable` (git write-back) | staging opt-in only; **not on prod** |

## Directory layout (this authoring PR)

```
deploy/k3s/gitops/
├── README.md                      ← this file (the restormel-gitops layout spec)
├── DEPLOY-PIPELINE.md             ← deploy-workflow rewrite plan (Coolify → GitOps)
├── bootstrap/                     ← applied ONCE by the operator, out of band
│   ├── argocd-values.yaml             Helm values (pinned 9.5.22 / v3.4.4), no secrets
│   ├── argocd-repo-externalsecret.yaml ESO ExternalSecret → repo + registry creds (refs only)
│   └── appprojects.yaml                AppProjects: restormel-prod / -nonprod / cluster-addons
├── root/
│   └── root-app.yaml              ← app-of-apps ROOT (auto-syncs Application objects)
└── applications/
    ├── addons/
    │   └── 00-cluster-addons.yaml ← points at deploy/k3s/cluster/** (CNPG, Surreal,
    │                                 Supabase, ingress, cert-manager, ESO) — AUTO-sync
    └── workloads/
        ├── restormel-dashboard-prod.yaml     PROD  · MANUAL
        ├── restormel-worker-prod.yaml        PROD  · MANUAL · sync-wave after dashboard
        ├── restormel-dashboard-staging.yaml  STAGING · AUTO  · Image-Updater opt-in
        ├── restormel-preview.yaml            PREVIEW · MANUAL (cost guard, scale-to-zero)
        ├── allotmentology-prod.yaml          PROD  · MANUAL
        ├── usesophia-prod.yaml               PROD  · MANUAL · PHASE B (disabled)
        └── plotbudget-supabase-prod.yaml     PROD  · MANUAL · PHASE B (disabled, founder flag)
```

## The real `restormel-gitops` repo

These files are **authored here** (in `restormel-keys`) so the migration is reviewable
in one PR. They are written to move **1:1** into a dedicated Forgejo repo,
**`Allotment-Technology-Ltd/restormel-gitops`** — the GitOps source of truth Argo syncs
from. **Manifests + Helm values only. No secrets, ever** (ESO handles secrets — design §6).

### Repo move map (this PR path → restormel-gitops path)

| This PR (`deploy/k3s/gitops/…`) | `restormel-gitops` repo root |
|---|---|
| `bootstrap/*` | `bootstrap/*` (operator runs these by hand) |
| `root/root-app.yaml` | `applications/root/root-app.yaml` |
| `applications/addons/*` | `applications/addons/*` |
| `applications/workloads/*` | `applications/workloads/*` |
| *(referenced, sibling PR)* | `cluster/**` — CNPG/Surreal/Supabase/ingress/ESO manifests |
| *(referenced)* | `charts/<app>/` — per-app Helm chart |
| *(referenced)* | `values/<app>-<env>.yaml` — **`image.tag` lives here; CI bumps it** |

So the canonical `restormel-gitops` layout is:

```
restormel-gitops/                       (Forgejo, manifests + values, NO secrets)
├── bootstrap/                          Argo CD install + projects + ESO repo cred
├── applications/
│   ├── root/root-app.yaml              app-of-apps root
│   ├── addons/                         cluster-addons Application(s)
│   └── workloads/                      per-app Application manifests
├── cluster/                            platform manifests the addons app syncs
│   ├── cert-manager/  traefik/  eso/
│   ├── cnpg/          (operator + pg-restormel / pg-platform / pg-plotbudget)
│   ├── surrealdb/     (StatefulSet, 1 replica, CSI PVC)
│   └── supabase/      (Phase B)
├── charts/<app>/                       per-app Helm chart (templates)
└── values/<app>-<env>.yaml             env values — image.tag is the bumped line
```

## Prod = MANUAL gate (the core invariant)

`planning/k3s-cluster-target-design.md` §8: **"Prod sync stays manual/gated (prod is
never main-auto-deploy)."** How it's enforced here, in layers:

1. **No `syncPolicy.automated` block** on any prod `Application`
   (`*-prod.yaml`). Argo tracks git and shows **OutOfSync** when CI bumps the image
   tag, but **only an explicit operator Sync rolls the workload** — the GitOps
   equivalent of the old tag-gated `workflow_dispatch=prod` Coolify deploy.
2. **No Argo CD Image Updater annotations on prod.** Image Updater is opted in on
   **staging only** (`restormel-dashboard-staging.yaml`); enabling it on prod would
   auto-write the tag and auto-sync, defeating the gate.
3. **`restormel-prod` AppProject** documents the rule and bounds prod to prod namespaces.
4. The **app-of-apps root auto-syncs** — but it only manages *Application objects*.
   Creating an Application never rolls a workload; the child's own (absent) auto-sync
   policy governs that. So "Applications always exist + track git" and "prod only rolls
   on a click" hold simultaneously.

Auto-sync is permitted **only** on `restormel-nonprod` (staging/preview) and on
`cluster-addons` (platform invariants).

## Migrations fail-closed

Each app runs its pending DB migrations on container start against CNPG. A failed
migration **crash-loops the pod** → Argo reports the sync **Degraded**; it never
silently serves old schema. This preserves the standing
"deploys auto-apply pending migrations, fail-closed" norm (`CLAUDE.md`).

## Phase gating

`usesophia-prod` and `plotbudget-supabase-prod` are **Phase B** (`restormel.dev/phase: "B"`),
authored for layout completeness but **disabled** until Phase B lands (and, for
PlotBudget, until the production domain is confirmed — see the founder flag in that file
and design §10).

## Bootstrap order (operator, once — not automated here)

See [`DEPLOY-PIPELINE.md`](./DEPLOY-PIPELINE.md) "Bootstrap order". Summary:
ESO + Infisical SecretStore → Argo CD (Helm, pinned) → AppProjects + repo ExternalSecret
→ `root-app.yaml` → Argo renders addons + workloads → operator syncs prod by hand.
**Forgejo + Infisical + the CI runner stay OFF-cluster through migration** (design §8) so
the thing that deploys the cluster never depends on the cluster being healthy.
