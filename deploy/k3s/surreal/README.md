# SurrealDB on K3s — sovereign migration manifests

> **Config authoring only. No infra is applied by this PR.** These are reviewable
> Kubernetes manifests for Phase A (A2) of the sovereign K3s migration. Apply happens later,
> via GitOps (Argo CD), gated by the founder.

Source of truth: `planning/k3s-cluster-target-design.md` §5 (SurrealDB) and
`planning/full-migration-plan-k3s.md` §C/§D (Sophia cross-phase dependency). Operational
lineage: `docs/infra/surreal-self-host-runbook.md` (the current Coolify single-box deployment
these manifests replace).

## What's here

| File | Purpose |
|---|---|
| `00-namespace.yaml` | `data` namespace (node role=data, design §2). |
| `10-externalsecret.yaml` | ESO `SecretStore` (Infisical) + `ExternalSecret`s. **No real secrets** — placeholders/refs only. |
| `20-statefulset.yaml` | SurrealDB **1-replica StatefulSet**, rocksdb single-writer, Hetzner CSI PVC (20Gi). |
| `30-service.yaml` | Headless `surreal` + ClusterIP `surreal-db` (in-cluster target). |
| `40-ingress.yaml` | Traefik Ingress keeping **`surreal.restormel.dev` stable** (Sophia invariant). |
| `50-backup-cronjob.yaml` | Hourly `surreal export` → restic → BX11 Storage Box. |

## Key design facts

- **1 replica, never more.** rocksdb is a single-writer embedded engine. HA is
  restore-from-backup, not multi-writer. `replicas: 1` is a hard invariant — scaling up
  corrupts/forks storage.
- **Version pinned `v3.2.0`** to match the version the live data was created with. Same
  major+minor makes `surreal export`/`import` trivially safe. Never `:latest`.
  > **Note:** Docker Hub's current latest stable v3 line is `v3.1.5` (checked 2026-06-20);
  > the live store is on `3.2.x`. If the registry doesn't carry a `v3.2.0` arm/amd tag at
  > apply time, confirm the exact patch the live box runs and pin to it before applying.
- **In-cluster consumers** dial `surreal-db.data.svc.cluster.local:8000` (the dashboard graph
  paths). **External/Sophia** use `wss://surreal.restormel.dev` via the Ingress.
- **Capabilities locked down**: `--deny-all --allow-funcs` (BM25 analyzer + vector/KNN only),
  net + scripting denied (runbook §3.8).

## Retiring the shared root credential (security change — high-risk)

Today a single shared **root** credential is used by every consumer. The design (§5) calls for
**scoped, per-consumer database-level users**:

- `surreal-root` (ESO) — used **only** by the migration import and the backup CronJob (admin).
- `surreal-scoped-users` (ESO) — `DASHBOARD_*` and `SOPHIA_*` database-level **EDITOR** users
  (read/write data inside their db, no user/token/IAM access). These are what the app consumers
  sign in with.

After the data is imported, define the scoped users (runbook §3.9 syntax), e.g. for Sophia
(NS `main` / DB `sophia`, replacing the old `importer`):

```surql
USE NS main DB sophia;
DEFINE USER sophia_app ON DATABASE PASSWORD '<from ESO>' ROLES EDITOR
  COMMENT 'Sophia app — db-scoped, non-root';
```

Scoped users **must** supply namespace + database at sign-in (different from root):
`db.signin({ namespace: 'main', database: 'sophia', username: 'sophia_app', password: '…' })`.

> **This auth change must be routed through the `restormel-high-risk-security` review before
> the PR that wires consumers onto scoped users** (CLAUDE.md standing norm — touches auth/creds).
> This PR only authors the ESO scaffolding and documents the plan; it does **not** flip any
> consumer onto the new creds.

## Cross-phase note — Sophia re-points env-only AFTER this lands

Sequencing (full-migration-plan §C, §D):

1. **Phase A (this work):** stand SurrealDB up in K3s, restore the
   `sophia-prod-2026-06-13.surql` dump (NS `main` / DB `sophia`), recreate the scoped user,
   then **flip the `surreal.restormel.dev` DNS A record to the K3s ingress IP**. Because the
   hostname is unchanged, the move is **transparent to Sophia** (still on Railway). Verify
   Restormel *and* Sophia graph/retrieval paths against the new instance **before** touching
   Sophia.
2. **Phase B (later, separate):** move Sophia to K3s and optionally switch its `SURREAL_URL`
   to the **internal cluster service DNS** (`surreal-db.data.svc.cluster.local:8000`) to drop
   the public hop. This is an **env-only** change for Sophia — four env vars (`SURREAL_URL`,
   `SURREAL_USER`, `SURREAL_PASS`, `SURREAL_NAMESPACE`/`SURREAL_DATABASE`), no code change.
3. **Do not** move SurrealDB and re-point Sophia in the same window. Keep the old `.150` box
   warm as rollback until reads/writes are verified in-cluster.

## Backups & RPO

`surreal export` → restic → **BX11 Storage Box** (`50-backup-cronjob.yaml`), reusing the
existing restic/rclone topology (`restormel-dr-recovery` skill). Restore = `restic restore` the
latest `dump-*.surql`, then `surreal import` into a fresh StatefulSet (design §7).

> **Founder flag — RPO:** this CronJob runs **hourly** (per the task's RPO decision), which is
> **tighter than the design's stated Surreal RPO anchor of ≤24h** (`k3s-cluster-target-design.md`
> §7, an open §10 question). Hourly logical exports of the current corpus are cheap and restic
> dedupes, so this is affordable — but confirm hourly is the intended target (vs daily) and that
> a dedicated restic repo path (e.g. `restic-surreal-k3s`) is provisioned on BX11.

## Apply order (later, not now)

`00 → 10 (after cluster-wide ESO + the Infisical bootstrap secret exist) → 20 → 30 → 40 → 50`.
The `hcloud-volumes` storage class, the `letsencrypt-dns01` ClusterIssuer, the `traefik`
IngressClass, and the `restormel.dev/role=data` node label are cluster prerequisites owned by
the cluster-bootstrap manifests (separate PRs).
