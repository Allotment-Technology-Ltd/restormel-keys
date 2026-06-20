# Cutover runbook — Restormel Keys → K3s + CNPG

**Move the live `restormel_ops` Postgres off the Coolify-hosted box onto the dedicated
`pg-restormel` CloudNativePG cluster, and move the dashboard + worker onto K3s, using a short
`pg_dump`/restore maintenance window.**

- **Source of truth during the window:** the existing self-hosted `restormel_ops` Postgres
  (the box PG stood up by the P3 runbook) stays authoritative and writable-frozen until the
  K3s target is verified.
- **Cutover switch:** the application `DATABASE_URL`. The dashboard selects its DB driver from
  the URL scheme (plain `postgres://` → `pg` Pool), so this is a **`DATABASE_URL` change with
  zero call-site changes** (P3 runbook §0).
- **Rollback:** re-point `DATABASE_URL` back to the source instance — one env var.
- **Reference:** k3s-design §4.1 (`pg-restormel` dedicated cluster, `instances: 2`), §4.4;
  full-plan §D (A3/A4); cutover *mechanics* canonical in `deploy/k3s/cnpg/MIGRATION.md`
  (this is migration #5 — LAST, highest blast radius); restore method mirrors
  `docs/infra/p3-self-hosted-postgres-runbook.md`.

> Restormel is **pre-launch / low-traffic**, so a short freeze is acceptable. Logical
> replication is **not** used here (locked decision — full-plan §E.8 / MIGRATION.md). This is
> the LAST database to move: `allotmentology` (#1) and `restormel_staging` (#2) prove the exact
> mechanics on low-risk DBs first — do not start this until they are green and soaked.

---

## 0. Scope & invariants

| Item | Detail |
|---|---|
| **Database** | `restormel_ops` → CNPG `pg-restormel` (dedicated cluster, HA primary + 1 standby). ~55 operational tables; schema verified PG16-portable (P3 §0). |
| **Restore method** | **Schema-first, data-second** (NOT a blind full restore). The dashboard owns its schema via its migration runner; `schema_migrations` is authoritative from the runner and never copied. See §2.3–2.4 + MIGRATION.md §restormel_ops. |
| **Apps** | `restormel-dashboard-prod` + `restormel-worker-prod` (Argo Applications, namespace `restormel-prod`). |
| **Migrations** | The dashboard image runs pending migrations on start against `pg-restormel`, **fail-closed**: a bad migration crash-loops the pod and Argo reports Degraded — it never silently serves old schema (CLAUDE.md standing norm; dashboard-prod app header). |
| **Sync gate** | Prod is **MANUAL sync** — there is deliberately no `syncPolicy.automated` on either app (design §8). The operator runs `argocd app sync` by hand. The worker carries `sync-wave: "1"` so it rolls **after** the dashboard (wave 0) — migrations land first. |
| **Graph dependency** | Restormel's graph/retrieval path uses SurrealDB at `surreal.restormel.dev`. That name **must already resolve to the cluster ingress** (SurrealDB cutover A2 done + verified first — HARD INVARIANT, ingress §3.5). Do not move Postgres and SurrealDB in the same window. |
| **HARD INVARIANT — encryption key** | Encrypted provider credentials (column-encrypted in `provider_credentials`) move as **ciphertext**. The env var **`RESTORMEL_CREDENTIALS_ENCRYPTION_KEY`** must be **byte-identical** on the K3s side (rendered from the same Infisical value) or every credential becomes undecryptable. Verify this in pre-checks AND in the post-flip smoke test. |
| **Secrets** | All via ESO ← Infisical (project `restormel-ops`, env `prod`). The app `DATABASE_URL` is pulled under `/restormel/dashboard` (and `/restormel/worker`) into the `restormel-dashboard-env` Secret. **No plaintext in any manifest or in this runbook.** |

---

## 1. Pre-checks (green-light gate)

- [ ] Migrations #1 (`allotmentology`) and #2 (`restormel_staging`) completed, verified, and
      soaked — the dump/restore mechanics are proven on low-risk DBs (MIGRATION.md order).
- [ ] SurrealDB already serves on `surreal.restormel.dev` → cluster ingress, and a Restormel
      graph read succeeds against it (A2 verified).
- [ ] `pg-restormel` is healthy: `kubectl cnpg status pg-restormel -n cnpg-system` shows
      *Cluster in healthy state*, primary + 1 standby both `Ready`, the standby streaming and
      caught up, and *Continuous archiving: OK* (WAL archiving to fsn1 green).
- [ ] Target DB + app role exist from cluster bootstrap: `restormel_ops` owned by
      `restormel_app` (created by `initdb`, NOT by `bootstrap.recovery`).
- [ ] **Encryption key parity:** `RESTORMEL_CREDENTIALS_ENCRYPTION_KEY` is present in Infisical
      under `/restormel/dashboard` and renders **byte-identical** to the source value into the
      `restormel-dashboard-env` Secret (and the worker's equivalent). Confirm without printing
      the value (compare hashes, not plaintext).
- [ ] dashboard + worker images built and pushed to `registry.allotmentology.tech/restormel/*`;
      the image tag is bumped in `restormel-gitops`; both Argo apps show **OutOfSync** and ready
      for a manual sync (DEPLOY-PIPELINE.md).
- [ ] A fresh, independent, restorable base backup of the source `restormel_ops` exists
      (separate from this window — the rollback floor).
- [ ] Maintenance banner / status-page entry staged; window communicated.
- [ ] Two operators present (one drives, one verifies the `DATABASE_URL` flip + decrypt check).

```bash
# CNPG health (note: namespace is cnpg-system, service suffix is .cnpg-system.svc)
kubectl cnpg status pg-restormel -n cnpg-system

# Confirm the target DB exists, owned by restormel_app, and is empty/ready.
kubectl cnpg psql pg-restormel -n cnpg-system -- -c '\l' -c '\du'
```

Connection-string conventions used below (run dump/restore from an in-cluster one-shot
pod/job, or over `kubectl port-forward`, so traffic stays on the cluster network):

```bash
# SOURCE (box PG) — the live self-hosted restormel_ops from the P3 cutover.
SOURCE_URL='postgres://<role>:<pw>@<source-host>:5432/restormel_ops?sslmode=disable'
# TARGET (CNPG pg-restormel primary, read-write).
TARGET_URL='postgresql://<role>@pg-restormel-rw.cnpg-system.svc.cluster.local:5432/restormel_ops'
```

---

## 2. Maintenance-window steps

> Keep the window tight. Target < 30 min. Log every step (command, timestamp, sha256, row
> counts) to `migration-log.md`.

### 2.1 Freeze the source

```bash
# Stop the SOURCE dashboard + worker so no new writes land mid-dump.
# (Coolify: stop the dashboard + worker resources; do NOT stop the source Postgres — reads
#  must continue against the source for verification + as the rollback target.)
# Confirm no app connections remain on the source DB:
psql "$SOURCE_URL" -c \
  "SELECT count(*) FROM pg_stat_activity WHERE datname='restormel_ops' AND application_name NOT LIKE 'psql%';"
# Expect 0. If non-zero, find the holdout writer before dumping.
```

### 2.2 Stand up the schema on the target (migration runner FIRST)

The dashboard owns its schema. Run **all** migrations against the empty target so it comes up
correctly versioned with `schema_migrations` authoritative from the runner (never copied):

```bash
# Creates the full, correctly-versioned schema on pg-restormel. Fail-closed.
DATABASE_URL="$TARGET_URL" pnpm --filter dashboard run migrate

# Confirm the schema landed and the migration head matches the repo / source.
psql "$TARGET_URL" -c "SELECT count(*) FROM schema_migrations;"   # expect == source count (P3 baseline ~67)
psql "$TARGET_URL" -c "\dt"                                       # expect ~55 operational tables
psql "$SOURCE_URL" -tAc "SELECT count(*) FROM schema_migrations;" # cross-check the source head
```

### 2.3 Dump DATA-ONLY from the source and load into the target

Data-only, excluding runner-owned and auth-owned tables exactly as the P3 runbook does
(`schema_migrations` stays from §2.2; the Better-Auth / legacy auth tables are excluded):

```bash
pg_dump "$SOURCE_URL" --data-only --no-owner --no-privileges \
  --exclude-table-data='schema_migrations' \
  --exclude-table-data='"user"' \
  --exclude-table-data='session' \
  --exclude-table-data='account' \
  --exclude-table-data='verification' \
  --exclude-table-data='users' \
  --file=/tmp/restormel_ops.data.dump
sha256sum /tmp/restormel_ops.data.dump   # record size + sha256 in migration-log.md

# Load the data into the freshly-migrated target schema.
pg_restore --data-only --no-owner --no-privileges --exit-on-error \
  --dbname "$TARGET_URL" /tmp/restormel_ops.data.dump
```

> `knowledge_source_documents.text` may still hold cached source text (the BYO-principle
> violation flagged in P2b). This copies it **as-is** to preserve rollback parity — do NOT
> NULL/drop it here; the purge is a separate owner-present P2b step (P3 runbook §3).

### 2.4 Verify the target (BEFORE any flip)

```bash
# Row-count parity on the load-bearing tables (MIGRATION.md hot-table list + the encrypted one).
for t in workspaces api_keys routes knowledge_graph_units provider_credentials; do
  printf '%-26s src=' "$t"; psql "$SOURCE_URL" -tAc "SELECT count(*) FROM $t;"
  printf '%-26s tgt=' '' ;  psql "$TARGET_URL" -tAc "SELECT count(*) FROM $t;"
done

# Decrypt smoke test: prove ONE provider_credentials row decrypts on the target with the
# moved RESTORMEL_CREDENTIALS_ENCRYPTION_KEY. Run the app's decrypt path in a one-off job
# against a known row. DO NOT print plaintext — assert success/failure only.
```

- [ ] Row counts match on every checked table.
- [ ] `schema_migrations` head on the target == source (from §2.2).
- [ ] One encrypted `provider_credentials` row decrypts successfully on the target (key parity
      proven against real ciphertext).

> **STOP** — if any check fails, do **not** flip. The source is untouched; tear down/re-init
> the target data and retry, or abort the window.

### 2.5 Flip the connection string (the cutover)

Driver/code do not change — only `DATABASE_URL`, via the ESO path:

```bash
# 1. In Infisical (project restormel-ops, env prod), set DATABASE_URL to the CNPG target:
#      DATABASE_URL = postgresql://<role>@pg-restormel-rw.cnpg-system.svc.cluster.local:5432/restormel_ops
#    Update it under BOTH /restormel/dashboard and /restormel/worker (the worker shares the DB).
#
# 2. Force ESO to re-render the restormel-dashboard-env Secret immediately (don't wait for the
#    1h refreshInterval):
kubectl -n restormel-prod annotate externalsecret restormel-dashboard-env \
  force-sync="$(date +%s)" --overwrite
#    (repeat for the worker's ExternalSecret if it is separate). Confirm it re-synced:
kubectl -n restormel-prod get externalsecret restormel-dashboard-env -o jsonpath='{.status.conditions[*].reason}'

# 3. Operator-sync the two Argo apps (MANUAL gate — dashboard first, worker follows via sync-wave).
argocd app sync restormel-dashboard-prod
argocd app sync restormel-worker-prod
kubectl -n restormel-prod rollout status deploy/restormel-dashboard
kubectl -n restormel-prod rollout status deploy/restormel-worker
```

### 2.6 Smoke test on K3s

- [ ] `GET https://restormel.dev/healthz` → 200 (DB-independent liveness).
- [ ] `GET https://restormel.dev/keys/v1/catalog` → 200 with **real rows** (proves Postgres
      reads hit `pg-restormel`).
- [ ] `restormel.dev` loads; login works (Better Auth session).
- [ ] A `resolve`/`simulate` route call returns expected output (Postgres reads + catalogue + graph).
- [ ] Worker picks up a job (e.g. `hosted_runtime_jobs`) and completes it (exercises writes).
- [ ] A BYOK provider credential is read + used on a live route (decrypt with the moved
      `RESTORMEL_CREDENTIALS_ENCRYPTION_KEY` on the live path).
- [ ] Migration head matches the repo; no fail-closed migration error in the dashboard logs
      (pod not crash-looping; Argo app Healthy, not Degraded).
- [ ] DNS for `restormel.dev` resolves to the cluster ingress; cert valid.

### 2.7 Confirm a Barman backup lands in fsn1

The `pg-restormel-daily` ScheduledBackup is `immediate: true`, so a base backup fires on
create; WAL archives continuously via the `isWALArchiver` plugin. Confirm both reach the
bucket **`restormel-cnpg-backups-fsn1`** (region fsn1):

```bash
# Backup objects + their phase (expect a Completed base backup).
kubectl -n cnpg-system get backup -l cnpg.io/cluster=pg-restormel
# Cluster status should show: First Point of Recoverability set, Continuous Archiving OK,
# and the last successful base backup time.
kubectl cnpg status pg-restormel -n cnpg-system | grep -iE 'archiv|backup|recoverab'
# (Optional) confirm objects exist under the cluster's serverName subpath:
#   s3://restormel-cnpg-backups-fsn1/  via the fsn1 endpoint https://fsn1.your-objectstorage.com
```

- [ ] At least one **Completed** base backup for `pg-restormel` in `restormel-cnpg-backups-fsn1`.
- [ ] Continuous WAL archiving is OK (first point of recoverability set).

### 2.8 Close the window

- [ ] Remove the maintenance banner.
- [ ] Keep the **source `restormel_ops` instance untouched and warm** as the rollback target
      for the agreed soak period (≥ 48 h recommended) — do NOT decommission yet (§3 + §4).

---

## 3. Rollback (re-point the connection string)

If smoke tests fail or unexpected behaviour appears during the soak — **roll back fast**
(any writes made to CNPG after the flip would need manual reconciliation):

```bash
# 1. Revert DATABASE_URL in Infisical (/restormel/dashboard + /restormel/worker) back to the
#    SOURCE box-PG string, then force ESO re-sync:
kubectl -n restormel-prod annotate externalsecret restormel-dashboard-env \
  force-sync="$(date +%s)" --overwrite
#    then re-sync the Argo apps:
argocd app sync restormel-dashboard-prod && argocd app sync restormel-worker-prod
#    — OR, faster, bring the SOURCE dashboard + worker back up on Coolify (they still point at
#      the source string) and route traffic back.
# 2. If DNS was moved to the cluster ingress, point restormel.dev back to the source.
```

- The source DB was **frozen, not mutated** during the window, so it is consistent. Because the
  apps were down on the source, there should be **no divergent writes** to reconcile.
- Log the rollback, the trigger, and the observed state to `migration-log.md`; **file an
  incident record (REC-TPL-004)** if the rollback was triggered by a failure (mandatory —
  CLAUDE.md / restormel-isms-records).

---

## 4. Validation checklist (window-close criteria)

- [ ] CNPG `pg-restormel` healthy (primary + standby `Ready`, standby caught up).
- [ ] First base backup **Completed** to `restormel-cnpg-backups-fsn1` (fsn1); WAL archiving OK.
- [ ] Row-count parity verified on all load-bearing tables; `schema_migrations` head correct.
- [ ] Encrypted `provider_credentials` decrypt on the target AND on the live route
      (`RESTORMEL_CREDENTIALS_ENCRYPTION_KEY` parity proven).
- [ ] dashboard + worker serving from K3s (`restormel-prod`); both Argo apps Healthy/Synced.
- [ ] `restormel.dev` + cert OK; `/healthz` 200; `/keys/v1/catalog` 200 with rows.
- [ ] Graph path against `surreal.restormel.dev` works from the K3s app.
- [ ] No fail-closed migration errors; no pod crash-loop.
- [ ] Source instance preserved warm for the soak period.
- [ ] **Decommission the source only after** the target has soaked in production **and** a
      restore drill from `restormel-cnpg-backups-fsn1` has succeeded (MIGRATION.md /
      REC-PLAN-015 Phase 8). Until then the source is the rollback target — do not delete it.
- [ ] All actions logged to `migration-log.md`.
