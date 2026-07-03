---
name: restormel-integration-train
description: >-
  Operate the Restormel "Integration Train" — the single long-lived pre-merge
  integration environment (ns restormel-integration, host integration.restormel.dev)
  that batches every open, non-draft, `stage`-labelled PR onto a disposable
  `integration` branch (reset-to-main → sequential pairwise merge), builds the batch on
  a rootless-buildkit isolated surface, and deploys it close-to-prod BEFORE any PR merges
  to main. Use when asked to: run or trigger the train, add/remove a PR from the next
  batch (the `stage` label), debug a merge conflict or `integration-conflict` skip, read
  the per-PR env-URL status comment, wake/sleep the env (idle scale-to-zero), reset the
  empty `restormel_integration` logical DB + re-run migrations from scratch, onboard a
  developer to the env (oauth2-proxy portal SSO), or extend/repair the integration-train
  workflow. The train NEVER auto-promotes to main — promotion stays manual PR→main→prod
  gated by the Security scan. NOT for prod deploys (that is the Argo auto-sync path,
  docs/DEPLOY-PIPELINE.md) and NOT for per-PR ephemeral envs (deferred, Phase 5).
---

# restormel-integration-train — operator skill

> **Status (2026-06-28): mechanism + invariants are final; the runbooks below that need a live
> env are marked _PENDING FIRST RUN_.** The env is **authored and HELD** — Phases 1–3 (env stand-up,
> the CI build engine, the train workflow) are built but not yet provisioned/armed (see
> `docs/DEPLOY-PIPELINE.md` §3). Until the founder-gated provisioning lands and the first batch runs,
> the marked runbooks are the _intended_ procedure, not yet operator-verified. Plan of record:
> **REC-PLAN-022**. Asset: **AST-031**.

## When to use vs other skills
- Running / triggering the train, managing the batch, env onboarding → **THIS skill**.
- Anything touching keys/auth/secrets/Connect/server-routes/Postgres in the train manifests or
  workflow → pair with `restormel-high-risk-security` before any PR.
- An incident/outage on the integration env → `restormel-isms-governance` (file the incident) +
  `restormel-infra-alert-response`.
- Cluster/DB/secret access PATH → `restormel-infra-access`.
- Prod deploy (Argo auto-sync) → NOT this skill; see `docs/DEPLOY-PIPELINE.md`.

## The mechanism (load-bearing invariants — REC-PLAN-022, locked 2026-06-28)

- **ONE env.** ns `restormel-integration`, host `integration.restormel.dev`, Argo project
  `restormel-nonprod`, automated sync. Manifests are a near-byte-for-byte clone of
  `applications/restormel-app-prod/` (only 3 edits: namespace, ingress host, replica floor). Same
  fail-closed migration entrypoint + `pg_advisory_lock` gate as prod.
- **Data plane.** A LOGICAL `restormel_integration` database on the **existing** `pg-restormel` CNPG
  cluster (no new PVC → stays under the 16-volume node cap), reached through a dedicated, scoped
  **`PG_INTEGRATION_APP_*`** role. **EMPTY seed, migrations from scratch each cycle.** NEVER prod
  data, NEVER `restormel_ops`, NEVER the `PG_RESTORMEL_APP_*` role.
- **Secrets.** A separate Infisical **`/integration`** store with its **own machine identity** (sandbox
  Paddle, separate auth/encryption keys + `DATABASE_URL`). NEVER `/dashboard/*` / prod secrets. The
  `connectHostManagedGraphStore` flag (REC-ADR-008) is **ON here**, **off in prod**.
- **Registry.** Forgejo (`git.allotmentology.tech/allotment-technology-ltd/...`) is the SOLE non-prod
  registry. Zero `registry.allotmentology.tech` references (that host was never created).
- **Trigger.** Opt-in, author-applied **`stage`** label (cost guard) + schedule. NOT default-on. Gated
  by the `INTEGRATION_TRAIN_ENABLED` Forgejo Actions var.
- **Batch.** `git reset --hard origin/main` on a disposable `integration` branch → **sequential
  pairwise merge**: `git merge` each open, non-draft, `stage`-labelled PR **one at a time**; on
  conflict, abort that merge, **SKIP** the PR, comment, add the `integration-conflict` label, continue.
  (Pairwise — not an all-or-nothing octopus merge — so a conflict is attributable to the exact PR.)
  Build is keyed to the integration HEAD; a raw-manifest image-line bump deploys it.
- **Build surface.** A dedicated **rootless BuildKit isolated build surface** (not the prod privileged
  runner). **Outbound-only** — push image to the Forgejo registry + push the gitops bump only; never
  the kube-API, never a box private IP (REC-INC-006 invariant).
- **Access.** Traefik forward-auth to the **portal SSO via oauth2-proxy** — pre-merge code is never
  public.
- **The train NEVER auto-promotes to main.** Promotion stays manual PR→main→prod, gated by the
  required Security scan.

## Runbooks

### A. Add / remove a PR from the next batch (the `stage` label) — _ready_
- **Add:** the PR author (or an operator) applies the **`stage`** label to an **open, non-draft** PR.
  The next scheduled run — or an on-demand dispatch — picks it up. Draft PRs are skipped by design.
- **Remove:** drop the `stage` label. It leaves the next batch; already-built batches are not rewound.
- **Conflict skip:** a PR the train could not merge carries an **`integration-conflict`** label + a
  comment. Rebase the PR on `origin/main`, resolve, push, then **remove `integration-conflict`** so the
  next run retries it (the label is the "known-conflicting, do not retry blindly" signal).
- Manage labels via the product-ops path / ticket CLI — do **not** create the `stage` /
  `integration-conflict` labels here; they are founder/CI-provisioned (creating labels is a gated op).

### B. Trigger the train on demand + read the run — _PENDING FIRST RUN_
- Dispatch `integration-train.yml` (`workflow_dispatch`) on Forgejo, or wait for the schedule. The run
  is a no-op unless `INTEGRATION_TRAIN_ENABLED=1`.
- Read the run: the workflow logs show the reset-to-main, each pairwise merge (merged / skipped), the
  rootless-buildkit build, the registry push, and the gitops bump commit. Per-PR **status comments**
  post the env URL on each batched PR.
- Forgejo's per-job log API may be unavailable in this version — isolate stages into separate JOBS so
  each job's status is the signal, and read full logs from the Forgejo UI.

### C. Diagnose a merge conflict / clear an `integration-conflict` skip — _PENDING FIRST RUN_
1. Reproduce locally: `git fetch origin`, `git checkout -B integration origin/main`, then
   `git merge --no-ff <pr-branch>` for the skipped PR to see the conflicting paths.
2. Fix in the **PR's own branch** (rebase on `origin/main` + resolve) — never resolve "in the train".
   The train holds no state; it resets to main every run.
3. Push the PR, drop the `integration-conflict` label; the next run re-attempts the merge.

### D. Read the per-PR env URL + confirm the batch is Healthy — _PENDING FIRST RUN_
- Each batched PR gets a status comment with `https://integration.restormel.dev` (behind oauth2-proxy).
- Confirm Argo `restormel-integration` (project `restormel-nonprod`) is **Synced + Healthy** (Argo is
  read-only anonymous; use the UI / a read-only check, never a write op here).

### E. Reset the empty `restormel_integration` DB + re-migrate from scratch — _PENDING FIRST RUN_
- The integration DB holds **only empty/synthetic data**, so a reset is cheap and safe: drop/recreate
  the **logical `restormel_integration` database on `pg-restormel`** (NOT the cluster, NOT
  `restormel_ops`) via the `PG_INTEGRATION_APP_*` role, then let the next deploy's fail-closed
  migration entrypoint rebuild the schema from scratch.
- This is a **founder-gated DB op** (psql against CNPG) — an operator does not run it casually; route
  it through the founder / the documented CNPG access path (`restormel-infra-access`,
  `k3s-db-access-pattern`). Never point the reset at any prod DB.

### F. Wake / sleep the env (idle scale-to-zero) — _PENDING FIRST RUN_
- An idle **scale-to-zero CronJob** (namespace-scoped RBAC only) scales the dashboard+worker
  Deployments to 0 on the idle schedule to spare the lean 3-node estate (node3 is 8 GiB).
- **Wake:** the train workflow scales back to the replica floor on deploy via the **gitops bump**
  (outbound-only) — not by the runner calling the kube-API. A manual wake is a founder-gated
  `kubectl scale` in ns `restormel-integration` only.

### G. Onboard a developer (oauth2-proxy portal SSO) — _PENDING FIRST RUN_
- `integration.restormel.dev` sits behind **oauth2-proxy forward-auth to the portal identity**
  (same fail-closed model as grafana./argo.). A developer needs a portal account; no extra in-app
  account. Pre-merge code is never exposed unauthenticated.

### H. Extend / repair the workflow + manifests — _PENDING FIRST RUN_
- Workflow: `.forgejo/workflows/integration-train.yml` + the build engine in `deploy-k3s.yml`'s
  integration path + the raw-manifest bump (`k3s-build-push-bump.sh` — fix it to bump the integration
  deployment image line, **not** a Helm `values/*.yaml`).
- Manifests (gitops): `applications/restormel-integration/` (clone of prod) +
  `applications/workloads/restormel-integration.yaml` + the Phase-4 ns guards
  (`90-resourcequota.yaml`, `91-limitrange.yaml`, `92-scale-to-zero-cronjob.yaml`) + the
  `restormel-nonprod` AppProject collapse + the wildcard-TLS reflector allow-list.
- Any change touching secrets/ingress/DB/server-routes → run `restormel-high-risk-security` first.

## Guards (Phase 4)
- `ResourceQuota` + `LimitRange` on `restormel-integration` cap the blast radius (node3 is 8 GiB —
  see `kube-overcommit-alerts-lean-cluster`).
- Idle scale-to-zero CronJob — namespace-scoped Role (get/list/patch on deployments + deployments/scale)
  bound to a dedicated ServiceAccount in ns `restormel-integration` ONLY. **No ClusterRole** (no
  cross-ns scale).

## Hard invariants (do not violate)
- The train **NEVER auto-promotes to main**.
- **Never** prod data, **never** `restormel_ops`, **never** prod secrets (`/dashboard/*`,
  `PG_RESTORMEL_APP_*`) — separate logical DB, scoped `PG_INTEGRATION_APP_*` role, `/integration`
  store + identity.
- **Outbound-only** build/deploy (registry + gitops push; Argo pulls) — REC-INC-006.
- No `registry.allotmentology.tech` references — Forgejo is the only registry.

## References
- **REC-PLAN-022** — plan of record (`docs/design/staging-env-integration-train-plan-2026-06-27.md`).
- `docs/DEPLOY-PIPELINE.md` — the whole prod + integration pipeline (BUILT-vs-not-live status).
- **AST-031** — the integration environment asset (`governance/asset-inventory.yaml`).
- **REC-ADR-008** (`connectHostManagedGraphStore`), **REC-ADR-011** (prod auto-sync), **REC-INC-006**
  (outbound-only).
- Memory: `deploy-pipeline-k3s`, `kube-overcommit-alerts-lean-cluster`, `k3s-db-access-pattern`.
