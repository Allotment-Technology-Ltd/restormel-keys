# Restormel deploy pipeline — prod (Argo pull) + the Integration Train lane

Canonical reference for how Restormel ships to the K3s sovereign cluster. Two lanes:

1. **Prod** — `restormel.dev`, the live, proven path (Argo CD **pull**, auto-sync, raw manifests).
2. **Integration Train** — `integration.restormel.dev`, a single long-lived **pre-merge** env
   that batches `stage`-labelled PRs and proves them together **before** any merges to main.

> **Accuracy note (read first).** The **prod** lane is **live and proven end-to-end**. The
> **Integration Train** lane is **authored and HELD** — the manifests, CI, records and skill exist
> on branches/PRs, but the env is **NOT yet stood up**: it depends on founder-gated provisioning
> (logical DB + scoped role, the `/integration` secret store, the `INTEGRATION_TRAIN_ENABLED` var,
> the Argo apply, and the oauth2-proxy + DNS wiring). Do **not** read this doc as "the integration
> env is running". See [§3 status](#3-build-vs-not-yet-live-status).

> Supersedes the stale `deploy/k3s/gitops/DEPLOY-PIPELINE.md`, which describes a never-built
> Helm-chart / `values/*.yaml` bump and the **never-created `registry.allotmentology.tech`** host.
> Neither is real. The only registry is `git.allotmentology.tech` (Forgejo). Prod uses **raw
> manifests**, not Helm.

---

## 0. Invariants (both lanes)

- **Registry is Forgejo only.** All images live at
  `git.allotmentology.tech/allotment-technology-ltd/{dashboard,worker}:<12-hex-sha>`. There is **no**
  `registry.allotmentology.tech` — every reference to it is a bug.
- **Argo PULLs; CI never dials the cluster (REC-INC-006 outbound-only).** Deploys are a git commit
  (image-line bump) that **Argo CD reconciles by pulling**. The CI/build actor makes **egress HTTPS
  only** — push to the registry, push the bump to the gitops repo, optionally hit the **public**
  Forgejo API. It never calls the kube-API, never dials a box private IP (`10.0.1.1` / `172.16.0.x`)
  or Coolify. This is the REC-INC-006 ephemeral-subnet-route-collision invariant.
- **Raw manifests, not Helm.** Prod is `applications/restormel-app-prod/` (raw YAML); integration is
  a near-clone of it. Image tags are plain `image:` lines in the deployment manifests, bumped by a
  one-line edit — never a `values/*.yaml` Helm value.
- **The Integration Train NEVER auto-promotes to main.** Promotion stays **manual PR → main → prod**,
  gated by the required **Security scan** check. The train proves a batch close-to-prod; it does not
  merge anything.
- **Fail-closed migrations.** Both lanes share the same migration entrypoint with a
  `pg_advisory_lock` gate; a failed migration fails the rollout closed (no half-migrated serving).

---

## 1. Prod lane (LIVE) — `restormel.dev`

GitOps repo `Allotment-Technology-Ltd/restormel-gitops`, Argo Application **`restormel-app-prod`**,
path **`applications/restormel-app-prod/`** (raw manifests). DB is **`restormel_ops`** on the
`pg-restormel` CNPG cluster. Decision of record: **REC-ADR-011** (prod Argo auto-sync).

```
merge to restormel-keys main (app paths)
   │  auto-tag-release.yml → dashboard-v* tag        (or: workflow_dispatch=prod / push the tag)
   ▼
deploy-k3s.yml          [gated by Actions var K3S_DEPLOY_ENABLED=1]
   1. build image   — in-cluster BuildKit (privileged surface; see §4), Dockerfile.dashboard / .worker
   2. push image    → git.allotmentology.tech/allotment-technology-ltd/{dashboard,worker}:<sha>
   3. bump tag      — raw-manifest image-line edit in gitops:
                      applications/restormel-app-prod/20-dashboard-deployment.yaml
                      applications/restormel-app-prod/40-worker-deployment.yaml
                      commit "deploy(prod): dashboard+worker <sha>", push to gitops main
   ▼
Argo CD (restormel-app-prod, syncPolicy.automated {prune, selfHeal})
   4. AUTO-SYNCS the reviewed artefact → rolling update (readiness probes, PDB minAvailable:1,
      HPAs own replicas: dashboard 2→5, worker 2→4 — no static replicas: in the manifests)
   5. PBI-lifecycle PostSync hook (applications/restormel-app-prod/pbi-lifecycle-postsync.yaml)
      fires on Sync success → flips status/ready-deploy PBIs → status/deployed + closes them
      (Forgejo issues API, FORGEJO_PM_TOKEN, outbound-only)
```

- **Trigger authority.** The Argo layer **auto-syncs** the bumped artefact (REC-ADR-011). The
  **build/bump** step is deliberate, not on every push: it is gated by `K3S_DEPLOY_ENABLED` and fired
  by a `dashboard-v*` tag (auto-created on main merge by `auto-tag-release.yml`) or
  `workflow_dispatch=prod` — so the "is this going to prod?" gate is **upstream** (PR review + the
  Security scan + the pipeline), and `dry_run=true` builds/pushes without bumping (validation only).
- **Registry push identity.** `FORGEJO_REGISTRY_USER=adam` + `FORGEJO_REGISTRY_TOKEN`
  (write:package). `FORGEJO_PM_TOKEN` is **read-only on packages** (it is the git/issues identity for
  the PostSync hook) — do not use it to push images.
- **Rollback.** Revert the gitops image-bump commit; Argo auto-syncs back. `revisionHistoryLimit:5`
  also allows a Deployment rollback.
- **Residual risk.** A successful-but-non-backward-compatible migration (keep expand/contract
  discipline) and the absence of a working staging gate (the old `values/*-staging.yaml` files never
  existed) — which is precisely the gap the Integration Train closes.

---

## 2. Integration Train lane (AUTHORED + HELD) — `integration.restormel.dev`

One long-lived **pre-merge** env: ns **`restormel-integration`**, host
**`integration.restormel.dev`**, Argo project **`restormel-nonprod`** (automated sync). The manifests
are a **near-byte-for-byte clone of `applications/restormel-app-prod/`** (only namespace, ingress
host, and replica floor differ) so fidelity to prod is structural — same fail-closed migration
entrypoint + `pg_advisory_lock` gate. Plan of record: **REC-PLAN-022**. Asset: **AST-031**.

```
opt-in: PR author adds the `stage` label   (+ scheduled run)   [gated by INTEGRATION_TRAIN_ENABLED]
   ▼
integration-train.yml
   a. git reset --hard origin/main on a disposable `integration` branch
   b. SEQUENTIAL PAIRWISE MERGE — git merge each open, non-draft, `stage`-labelled PR one at a time;
      on conflict: abort THAT merge, skip the PR, comment + add the `integration-conflict` label,
      continue (pairwise attributes the conflict to the exact PR)
   ▼
build the batch (image keyed to the integration HEAD)
   c. ROOTLESS BUILDKIT on a dedicated, ISOLATED build surface (not the prod privileged runner);
      outbound-only — push image to the Forgejo registry, push the bump to gitops; never kube-API
   d. raw-manifest image-line bump of the integration deployments in gitops
   ▼
Argo CD (restormel-nonprod, automated sync)
   e. AUTO-SYNCS ns restormel-integration → rolling update
   f. per-PR status comment posts the env URL on each batched PR
   ▼
integration.restormel.dev  — served behind oauth2-proxy SSO (Traefik forward-auth to the portal;
                              pre-merge code is NEVER public)
```

Data plane and secrets are **fully isolated from prod**:

- **DB** — a LOGICAL `restormel_integration` database on the **existing** `pg-restormel` CNPG cluster
  (no new PVC → stays under the 16-volume node cap), reached through a dedicated, scoped
  **`PG_INTEGRATION_APP_*`** role. **Never** `restormel_ops`; never the `PG_RESTORMEL_APP_*` role.
- **Seed** — **empty**; migrations run **from scratch** each cycle. **Never prod data.** The DB can be
  reset to empty + re-migrated at will (no production rows ever live here).
- **Secrets** — a separate Infisical **`/integration`** store with its **own machine identity**,
  sandbox Paddle, and **separate auth/encryption keys + `DATABASE_URL`**. Never `/dashboard/*` /
  prod secrets. The `connectHostManagedGraphStore` flag (REC-ADR-008) is turned **ON here** and
  stays **off in prod**.
- **Namespace guards** (gitops Phase-4) — a `ResourceQuota` + `LimitRange` cap the env's blast radius
  on the lean 3-node estate (node3 is 8 GiB), and an **idle scale-to-zero CronJob** (namespace-scoped
  RBAC only — no ClusterRole) sleeps the dashboard+worker when no batch is live; the train wakes them
  on deploy via the gitops bump (outbound-only), not by the runner calling the kube-API.

---

## 3. BUILT vs NOT-YET-LIVE status

| Piece | State |
|---|---|
| Prod lane (build → push → bump → Argo auto-sync → PostSync hook) | **LIVE / proven end-to-end** |
| Prod auto-sync (REC-ADR-011) | **LIVE** |
| Integration manifests (`applications/restormel-integration/`, clone of prod) | **Authored, HELD** (PR not merged) |
| Phase-4 ns guards (ResourceQuota / LimitRange / scale-to-zero CronJob) | **Authored, HELD** (gitops PR) |
| `integration-train.yml` + the raw-manifest bump fix | **Authored DEFAULT-OFF** (gated, no-op until armed) |
| Logical `restormel_integration` DB + `PG_INTEGRATION_APP_*` role | **NOT provisioned** — founder-gated DB op |
| Infisical `/integration` store + identity (flag ON, sandbox Paddle, separate keys) | **NOT provisioned** — founder-gated secret op |
| `INTEGRATION_TRAIN_ENABLED` Actions var | **NOT set** — founder-gated CI config |
| `restormel-integration` Argo Application applied to the cluster | **NOT applied** — founder-gated cluster op |
| oauth2-proxy forward-auth + `integration.restormel.dev` DNS | **NOT wired** — founder-gated ingress/DNS op |

The integration env is therefore **built but not running**: it is held PRs plus founder-gated
provisioning. Operating it once it is live: see the `restormel-integration-train` skill.

---

## 4. Build surface notes

All boxes are now K3s nodes; there is **no off-cluster docker runner**. Two build mechanisms:

- **Prod** builds on an **in-cluster privileged BuildKit** surface (the on-cluster forgejo-runner is
  privileged via gitops config) — or, as a founder-sanctioned one-off, a privileged
  `moby/buildkit` **Kubernetes Job** on node2 that builds + pushes + bumps and is REC-INC-006-clean
  (operator/kubectl, not the CI runner). Mac builds are **not** a ship path (Apple-Silicon needs
  `--platform linux/amd64`, and a home-uplink push of large layers hits the 60s Traefik timeout;
  in-cluster pushes go over the fast internal network).
- **Integration** builds on a **dedicated rootless BuildKit isolated build surface** (founder
  decision, 2026-06-28) — confining build privilege away from the prod runner. Outbound-only: it
  pushes to the Forgejo registry and the gitops repo only.

---

## 5. References

- **REC-PLAN-022** — the Integration Train plan of record (`docs/design/staging-env-integration-train-plan-2026-06-27.md`).
- **REC-ADR-011** — prod Argo auto-sync decision.
- **REC-ADR-008** — host-managed Postgres graph store (the `connectHostManagedGraphStore` flag; PR #288).
- **REC-INC-006** — the outbound-only / pull-based invariant (ephemeral-subnet route collision).
- **AST-031** — the `restormel-integration` environment asset (logical DB + `/integration` scope).
- Skill: `restormel-integration-train` — operator runbook for the train.
- Superseded: `deploy/k3s/gitops/DEPLOY-PIPELINE.md` (stale: Helm `values/*.yaml` + `registry.allotmentology.tech`).
