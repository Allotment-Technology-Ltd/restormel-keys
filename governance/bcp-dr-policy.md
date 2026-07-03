---
id: REC-POL-005
title: Business Continuity & Disaster Recovery Policy
class: governance
owner: founder
status: approved
approved-by: Adam Boon
approved-on: 2026-06-20
classification: internal
control-tier: 2
created: 2026-06-20
last-reviewed: 2026-06-20
review-interval: P12M
retention: P6Y-after-superseded
related: [REC-PLAN-012, REC-PLAN-015, RISK-001, AST-003, AST-009, AST-010]
---

# Business Continuity & Disaster Recovery Policy

**Allotment Technology Ltd** · Version 2026-06-20 · **APPROVED — founder sign-off 2026-06-20**

> **Status: APPROVED** (founder sign-off 2026-06-20, Adam Boon). This document **anchors the
> RTO < 4 h continuity claim** referenced in the sovereign migration plan and is the
> previously-missing `governance/bcp-dr-policy.md` flagged in
> [`planning/full-migration-plan-k3s.md`](../planning/full-migration-plan-k3s.md) §E.4.
> Next review due per `review-interval` (P12M → 2027-06-20); revise only via a versioned update.

## 1. Purpose and scope

Define how **Allotment Technology Ltd** maintains and restores its services and data after a
disruptive event — from a single workload crash to total loss of the primary region — so that
recovery is **bounded, rehearsed, and evidenced**. Supports the Information Security Policy
(`REC-POL-001`) and implements ISO 27001:2022 Annex A controls **A.5.29 (information security
during disruption)**, **A.5.30 (ICT readiness for business continuity)**, **A.8.13 (information
backup)**, and **A.8.14 (redundancy of information processing facilities)**.

**In scope:** all production data stores and services in the asset inventory
(`asset-inventory.yaml`, REC-GOV-006) across the in-scope products — **Restormel Keys,
Allotmentology, UseSophia, PlotBudget** — and the self-hosted infrastructure that runs them. This
policy is written to the **target sovereign architecture** (self-hosted **K3s + CloudNativePG**,
Hetzner EU, OSS-only) described in [`k3s-cluster-target-design.md`](../planning/k3s-cluster-target-design.md);
where the migration is mid-flight it also covers the current Coolify-on-boxes state.

**Out of scope:** end-user device recovery; third-party SaaS the company merely consumes (covered by
the supplier register, `suppliers.yaml`, REC-GOV-005).

## 2. Objectives — RTO / RPO targets

The company commits to the following recovery objectives. **RTO** = maximum tolerable time to
restore service after a declared disaster; **RPO** = maximum tolerable data loss measured as time.

| Data store / service | RTO (restore time) | RPO (max data loss) | Mechanism |
|---|---|---|---|
| **Postgres — all CNPG clusters** (`pg-restormel`, `pg-platform`, `pg-plotbudget`) | **≤ 2 h** | **≤ 5 min** | CNPG + Barman continuous WAL archiving + PITR to Hetzner Object Storage |
| **SurrealDB** (knowledge graph / vector corpus) | **≤ 2 h** | **~1 h** | hourly `surreal export` CronJob → restic → BX11 Storage Box |
| **PVCs** (app volumes, SurrealDB data volume) | **≤ 2 h** | ≤ 24 h | restic / volume snapshot → BX11 |
| **etcd** (K3s cluster state) | **≤ 2 h** | scheduled snapshots | K3s etcd snapshots → Object Storage / BX11; `--cluster-reset` |
| **GitOps / config** (`restormel-gitops`, this repo) | minutes | n/a (it *is* the source of truth) | Forgejo + GitHub mirror; re-sync via Argo CD |
| **Secrets** (Infisical) | **≤ 2 h** | per Infisical backup cadence | Infisical kept off-cluster (bootstrap anchor); its PG backed up independently |

**Aggregate target: full production RTO ≤ 2 h from a clean cluster**, comfortably inside the
**4-hour continuity commitment**. These targets reflect the founder-locked decision: **RTO ≤ 2 h,
RPO ≤ 5 min (Postgres) / ~1 h (SurrealDB hourly export)**. (The hourly Surreal export tightens the
≤ 24 h figure in the design doc's §7 table for the knowledge corpus specifically.)

> **Pre-launch caveat.** Until products carry real-user write load, these are conservative ceilings;
> they are re-confirmed against measured restore drills (§5) and revised only via a versioned update
> to this policy.

## 3. Backup architecture (the recovery substrate)

### 3.1 Postgres — CNPG + Barman (continuous WAL + PITR)
- Every CNPG cluster archives **WAL continuously** to **Hetzner Object Storage**
  (endpoint `https://fsn1.your-objectstorage.com`, S3v4 — `fsn1`/Falkenstein is **deliberately a
  different region from the `hel1` compute**, so backups survive a `hel1`-wide loss; see §4.3) with a **daily base backup**
  (`ScheduledBackup`) and a **14-day retention policy**.
- Continuous WAL gives **PITR to within minutes** → the **≤ 5 min RPO**. DR restore bootstraps a
  **fresh** CNPG cluster from the same object store via `bootstrap.recovery` + `externalClusters`.
- S3 credentials are delivered by **External Secrets Operator ← Infisical** — never plaintext in git.
- *Note:* CNPG ≥ 1.26 deprecates the native `barmanObjectStore` in favour of the Barman Cloud Plugin;
  native is acceptable to ship now, adopt the plugin at the next major bump (tracked, not blocking).

### 3.2 SurrealDB — export → restic → BX11
- An **hourly** `surreal export` **CronJob** writes a logical dump, pushed via **restic** (encrypted)
  to the **BX11 Storage Box**, plus a periodic **PVC snapshot**. Hourly cadence yields the **~1 h RPO**.
- Restore = `surreal import` into a fresh 1-replica StatefulSet. **The `surreal.restormel.dev`
  hostname must be restored to resolve to the cluster ingress** (Sophia cross-product invariant).

### 3.3 PVCs, etcd, GitOps
- **PVCs:** restic / volume snapshots → BX11, daily.
- **etcd:** K3s scheduled etcd snapshots → Object Storage / BX11; recovery via `--cluster-reset`.
- **GitOps & this records repo:** the manifests/Helm values repo and the ISMS records repo are the
  source of truth; mirrored to GitHub; recovery = re-clone + Argo re-sync. No secrets in git.

### 3.4 Cold copies & isolation
- BX11 holds **encrypted** (restic) cold copies independent of Object Storage, so the loss of either
  target alone does not lose the data. Encryption passphrases are managed per the **Secret Management
  Policy** (`REC-POL-004`).
- **Bootstrap anchors stay off-cluster:** Infisical (the secret source ESO depends on) and Forgejo
  (the GitOps source Argo syncs from) are **not** in CNPG/the cluster, so a cold start can always be
  bootstrapped (k3s-design §4.5).

## 4. Recovery procedures (DR playbooks)

These are policy-level procedures; the executable, step-by-step break-glass detail lives in the
operational runbooks under `deploy/k3s/runbooks/` and `planning/infra-migration-rollback-runbook.md`
(REC-PLAN-015).

### 4.1 Single Postgres cluster loss (most likely)
1. Confirm scope (one CNPG cluster unhealthy, object store intact).
2. Provision a fresh CNPG cluster with `bootstrap.recovery` pointed at the cluster's Barman object
   store (`externalClusters`).
3. PITR to the latest consistent point (or a chosen timestamp).
4. Re-point the app `DATABASE_URL` (via ESO/Argo) at the recovered cluster; verify; resume.
   **Expected: well inside RTO ≤ 2 h, RPO ≤ 5 min.**

### 4.2 SurrealDB loss
1. Stand up a fresh SurrealDB StatefulSet (CSI PVC).
2. `surreal import` the latest hourly export from restic/BX11.
3. Recreate scoped users (`importer` etc.); restore `surreal.restormel.dev` → ingress.
4. Verify Restormel **and** Sophia graph/retrieval paths. **Expected RPO ~1 h.**

### 4.3 Full cluster / region loss (worst case)
1. Rebuild K3s (hetzner-k3s) — or restore etcd from snapshot via `--cluster-reset` if the nodes
   survive.
2. Re-install CCM/CSI, Traefik, cert-manager, **ESO ← off-cluster Infisical**, Argo CD.
3. Argo syncs all manifests from the off-cluster Forgejo GitOps repo.
4. Recover every CNPG cluster from Object Storage (§4.1) and SurrealDB from BX11 (§4.2) **in
   parallel**.
5. Validate per the runbooks; restore DNS. **Aggregate target RTO ≤ 2 h** (parallelised; the
   long pole is the largest Postgres PITR).

### 4.4 Cutover-window rollback (during the migration itself)
During the sovereign migration, each product's rollback is **re-point the connection string / DNS /
env back to the still-authoritative source** (managed Supabase / Neon / Railway / Coolify), which is
kept frozen-but-warm until the K3s target is verified. See the per-product runbooks in
`deploy/k3s/runbooks/`. This is a continuity control in its own right and is the primary safety net
through the migration.

## 5. DR drill cadence (test it, or it isn't real)

A backup that has never been restored is a hypothesis. The company runs:

| Drill | Cadence | Pass criteria |
|---|---|---|
| **Postgres PITR restore** (one CNPG cluster, to a scratch namespace) | **Quarterly** | Restores within RTO; data consistent to within RPO; evidence filed |
| **SurrealDB import** (latest export into a scratch STS) | **Quarterly** | Imports cleanly; graph query returns expected rows |
| **Full DR rehearsal** (rebuild cluster + recover all stores) | **Annually** | Aggregate RTO ≤ 2 h met or the gap is recorded + remediated |
| **Backup freshness / dead-man's-switch** | **Continuous** (alerting) | A missed backup raises an alert per `restormel-infra-alert-response` |
| **Restore-drill muscle** (Phase-8 procedure) | reused | per the `restormel-dr-recovery` skill |

- Each drill produces an **evidence record** under `evidence/` (append-only), capturing date,
  scope, measured RTO/RPO, and any gap + remediation. A failed drill triggers an **incident record**
  (REC-TPL-004) and review of this policy.
- Drill results feed the **risk register** (`risk-register.yaml`) — specifically **RISK-001**
  (single-region / single-orchestrator blast radius), which this policy and the K3s migration treat.

## 6. Roles & invocation

- **DR declaration & ownership:** the **founder** (sole operator) declares a disaster, selects the
  recovery procedure, and owns the outcome. A two-person check is used at destructive steps where a
  second operator is available.
- **Communication:** status-page / customer comms as appropriate to scope; all actions logged to
  `planning/migration-log.md` (during migration) or the incident record (steady state).
- **Post-incident:** an incident record (REC-TPL-004) is **mandatory** after any DR invocation, with
  a follow-up review of whether RTO/RPO were met and whether this policy needs revision.

## 7. Review

Reviewed at least **annually** (`review-interval: P12M`), after any **full DR rehearsal**, and after
any **material infrastructure change** (e.g. completion of the K3s migration, addition of a product,
or a change to a backup target). On the K3s migration reaching steady state, this policy is
re-confirmed against measured drill data and re-approved.

## 8. Related records

- `REC-POL-001` Information Security Policy · `REC-POL-004` Secret Management Policy
- `REC-PLAN-012` Infrastructure Split Migration · `REC-PLAN-015` Break-Glass Rollback Runbook
- `k3s-cluster-target-design.md` §7 (backups & DR) · `full-migration-plan-k3s.md` §D/§E
- `risk-register.yaml` (**RISK-001**) · `asset-inventory.yaml` (AST-003/009/010)
- Operational runbooks: `deploy/k3s/runbooks/` (per-product cutover) · `restormel-dr-recovery` skill
