# CloudNativePG (CNPG) manifests — sovereign k3s migration

> **Status: design / review artefacts only. NOTHING here has been applied to a cluster.**
> These are the reviewable CNPG `Cluster` + Barman backup manifests and the Postgres
> migration runbook for the sovereign (UK/EU self-host) k3s target. They are authored from
> the topology decisions in the infra-split plan (REC-PLAN-012 / REC-PLAN-015) and the
> P3 self-hosted-Postgres runbook. **No infra is provisioned by these files.**

## What's here

| File | Purpose |
|---|---|
| `objectstore-fsn1.yaml` | Barman Cloud **Plugin** `ObjectStore` → Hetzner Object Storage **fsn1** (cross-region PITR target). Shared by all three clusters. |
| `cluster-pg-platform.yaml` | Shared cluster — `allotmentology`, `restormel-staging`, and `UseSophia` (after Sophia's DB migration). |
| `cluster-pg-restormel.yaml` | The **live prod app DB** (`restormel_ops`). Highest criticality; isolated cluster. |
| `cluster-pg-plotbudget.yaml` | Cluster backing **self-hosted Supabase** for plotbudget (replaces managed Supabase). |
| `scheduledbackup.yaml` | One `ScheduledBackup` per cluster (`method: plugin`). |
| `recovery-example.yaml` | **Reference-only** PITR/DR `bootstrap.recovery` cluster — how to restore from fsn1 to a point in time. Do not apply alongside the live clusters. |
| `eso-secret-placeholders.yaml` | External Secrets Operator (ESO) `ExternalSecret` placeholders that render the S3 creds + superuser secrets. **No real secret material.** |
| `MIGRATION.md` | The pg_dump/restore cutover mechanics, per-DB order, and rollback. |

## Key decision: Barman Cloud **Plugin**, not in-tree `barmanObjectStore`

We target the **Barman Cloud Plugin** (`barman-cloud.cloudnative-pg.io`, CNPG-I, plugin
**v0.x** line — pin a release at apply time) with an `ObjectStore` CRD
(`barmancloud.cnpg.io/v1`), **not** the in-tree `spec.backup.barmanObjectStore`.

- The in-tree `barmanObjectStore` is **deprecated since CloudNativePG 1.26** and scheduled
  for **removal in 1.30.0**. CNPG ≥ 1.27 is strongly recommended for the plugin (better
  error/status reporting).
- Current CNPG stable at authoring time: **v1.29.1** (2026-05-08). v1.30.0 is in RC — the
  release that removes the in-tree path — so building on the plugin avoids a forced rewrite.
- The mapping is mechanical: everything that used to live under
  `.spec.backup.barmanObjectStore` now lives under an `ObjectStore`'s `.spec.configuration`,
  and the `Cluster` references it via a `.spec.plugins[]` entry
  (`isWALArchiver: true`, `parameters.barmanObjectName`).

Sources (verified at authoring):
- CNPG plugin intro / usage / migration: <https://cloudnative-pg.io/plugin-barman-cloud/docs/>
- CNPG 1.26 release notes (deprecation): <https://cloudnative-pg.io/documentation/1.26/release_notes/v1.26/>
- CNPG releases (v1.29.1 stable, v1.30 RC): <https://github.com/cloudnative-pg/cloudnative-pg/releases>

## Topology summary

| Cluster | Databases | Criticality | Storage | walStorage |
|---|---|---|---|---|
| `pg-platform` | `allotmentology`, `restormel_staging`, `usesophia` | Medium | shared, tight | separate PVC |
| `pg-restormel` | `restormel_ops` (live prod) | **Highest** | isolated | separate PVC |
| `pg-plotbudget` | `plotbudget` (self-hosted Supabase) | Medium | shared, tight | separate PVC |

All three: `instances: 2` (1 primary + 1 hot-standby), Hetzner CSI storage class
(`hcloud-volumes`), separate `walStorage`, and continuous WAL archiving + base backups to
**fsn1** (cross-region from the compute region — sovereign PITR off-box).

## Explicitly OUT of these clusters during migration

`restormel_ops` is **in** `pg-restormel` (it is the app DB and the migration target).
**Bootstrap-sensitive Postgres instances stay OFF-cluster** and are NOT migrated into CNPG
during this work — moving the database that the cluster's own tooling depends on into that
same cluster is a chicken-and-egg failure mode:

- **Forgejo's Postgres** — Forgejo is the git/CI system of record that ships these very
  manifests; its DB must not depend on the cluster it deploys.
- **Infisical's Postgres** — Infisical (secret store, `secrets.restormel.dev`) is what ESO
  reads to render the S3 + DB credentials these clusters need at boot.

See `MIGRATION.md` §"Bootstrap-sensitive: do not migrate" for the rationale and the
later, separate treatment.

## Prerequisites (NOT created here — owner/operator items)

- CNPG operator ≥ 1.27 installed in the cluster.
- Barman Cloud Plugin installed (CNPG-I sidecar/operator components).
- External Secrets Operator (ESO) installed and wired to Infisical (`secrets.restormel.dev`).
- Hetzner CSI driver installed; `hcloud-volumes` StorageClass present.
- A Hetzner Object Storage bucket in **fsn1** + an S3 access key/secret, stored in Infisical.
