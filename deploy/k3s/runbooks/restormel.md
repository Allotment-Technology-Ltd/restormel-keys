# Cutover runbook — Restormel Keys → K3s + CNPG

**Move the live `restormel_ops` Postgres off the Coolify-hosted box onto the dedicated
`pg-restormel` CloudNativePG cluster, and move the dashboard + worker Deployments onto K3s,
using a short `pg_dump` maintenance window.**

- **Source of truth during the window:** the existing `restormel-postgres` instance on the box
  stays authoritative and writable-frozen until the K3s target is verified.
- **Cutover switch:** the application `DATABASE_URL` (CNPG `pg-restormel` service).
- **Rollback:** re-point `DATABASE_URL` back to the source instance.
- **Reference:** k3s-design §4.1 (`pg-restormel` dedicated cluster, `instances: 2`), §4.4,
  full-plan §D (A3/A4).

> Restormel is **pre-launch / low-traffic**, so the short freeze is acceptable. Logical
> replication is *not* used here (locked decision — full-plan §E.8).

---

## 0. Scope & invariants

| Item | Detail |
|---|---|
| **Database** | `restormel_ops` → CNPG `pg-restormel` (dedicated, HA primary + standby). |
| **Apps** | `dashboard` (SvelteKit, SSR) + `worker` Deployments. |
| **Migrations** | Deploy auto-applies pending DB migrations and is **fail-closed** — verify the migration set matches `apps/dashboard/migrations/` before cutover. |
| **Graph dependency** | Restormel's graph/retrieval path uses SurrealDB at `surreal.restormel.dev` — that name **must already resolve to the cluster ingress** (SurrealDB cutover A2 done first). Do not move both in one window. |
| **HARD INVARIANT** | Encrypted provider credentials (column-encrypted in `provider_credentials`) move as ciphertext — the **encryption key env var must be identical** on the K3s side or every credential becomes undecryptable. |
| **Secrets** | All via ESO ← Infisical (`projectSlug: restormel-ops`, `environmentSlug: prod`). No plaintext. |

---

## 1. Pre-checks (green-light gate)

- [ ] SurrealDB is already serving on `surreal.restormel.dev` → cluster ingress, and a Restormel
      graph read succeeds against it (A2 verified).
- [ ] `pg-restormel` CNPG cluster is `Cluster in healthy state` (`kubectl cnpg status pg-restormel -n data`),
      primary + standby both `Ready`, Barman WAL archiving green.
- [ ] The decryption key for `provider_credentials` is present in Infisical and rendered into the
      target app's `ExternalSecret` — **byte-identical** to the source value.
- [ ] dashboard + worker images built and pushed to the Forgejo registry; their manifests are in
      the `restormel-gitops` repo, Argo app `OutOfSync` and ready to sync.
- [ ] A fresh, restorable base backup of the source `restormel_ops` exists (independent of this window).
- [ ] Maintenance banner / status-page entry staged; window communicated.
- [ ] Two operators present (one drives, one verifies the connection-string flip).

```bash
# CNPG health
kubectl cnpg status pg-restormel -n data
# Confirm the target DB + extensions exist (created by the cluster bootstrap)
kubectl cnpg psql pg-restormel -n data -- -c '\l' -c '\dx'
```

---

## 2. Maintenance-window steps

> Keep the window tight. Target < 30 min. All steps logged to `migration-log.md`.

### 2.1 Freeze the source

```bash
# Scale the source dashboard + worker to zero so no new writes land mid-dump.
# (Coolify: stop the dashboard + worker resources; do NOT stop the source Postgres.)
# Confirm no active app connections remain on the source:
psql "$SOURCE_RESTORMEL_OPS_URL" -c \
  "SELECT count(*) FROM pg_stat_activity WHERE datname='restormel_ops' AND application_name NOT LIKE 'psql%';"
```

### 2.2 `pg_dump` the source

```bash
# Custom format, no owner/privs (CNPG roles differ), include the schema + data.
pg_dump --format=custom --no-owner --no-privileges \
  --file=/tmp/restormel_ops.dump "$SOURCE_RESTORMEL_OPS_URL"
# Record the dump size + sha256 in the migration log.
sha256sum /tmp/restormel_ops.dump
```

### 2.3 Restore into CNPG `pg-restormel`

```bash
# Stream the dump into the target via the CNPG primary service over the private network.
# (Run from a client pod / bastion that can reach pg-restormel-rw.data.svc.)
pg_restore --no-owner --no-privileges --exit-on-error \
  --dbname "$TARGET_PG_RESTORMEL_URL" /tmp/restormel_ops.dump
```

### 2.4 Verify the target (before any flip)

```bash
# Row-count parity on the load-bearing tables.
for t in users workspaces projects route_steps provider_credentials project_model_bindings; do
  echo -n "$t  src="; psql "$SOURCE_RESTORMEL_OPS_URL" -tAc "SELECT count(*) FROM $t;"
  echo -n "    tgt="; psql "$TARGET_PG_RESTORMEL_URL"  -tAc "SELECT count(*) FROM $t;"
done
# Spot-check that an encrypted credential DECRYPTS on the target with the same key
# (run the app's decrypt path against one known row in a one-off job — do not print plaintext).
```

- [ ] Row counts match on every checked table.
- [ ] Latest applied migration version on the target == source.
- [ ] One encrypted `provider_credentials` row decrypts successfully on the target.

### 2.5 Flip the connection string (the cutover)

```bash
# Update the dashboard + worker DATABASE_URL to the CNPG pg-restormel-rw service via ESO/Infisical,
# then Argo-sync the Restormel app so the new Deployments come up pointed at CNPG.
# DATABASE_URL → postgresql://<user>@pg-restormel-rw.data.svc.cluster.local:5432/restormel_ops
kubectl -n apps rollout status deploy/restormel-dashboard
kubectl -n apps rollout status deploy/restormel-worker
```

### 2.6 Smoke test on K3s

- [ ] `restormel.dev` loads; login works (Better Auth session).
- [ ] A `resolve`/`simulate` route call returns expected output (exercises Postgres reads + the
      catalogue + graph).
- [ ] Worker picks up a job from `hosted_runtime_jobs` and completes it (exercises writes).
- [ ] A BYOK provider credential is read + used on a live route (exercises decrypt with the moved key).
- [ ] DB migration head matches the repo; no fail-closed migration error in logs.
- [ ] DNS for `restormel.dev` resolves to the cluster ingress; cert valid.

### 2.7 Close the window

- [ ] Remove the maintenance banner.
- [ ] Keep the **source `restormel-postgres` instance untouched and warm** as the rollback target
      for the agreed soak period (≥ 48 h recommended) before decommission.

---

## 3. Rollback (re-point the connection string)

If smoke tests fail or unexpected behaviour appears during the soak:

```bash
# 1. Re-point DATABASE_URL back to the source instance (ESO/Infisical → re-sync), OR
#    redeploy the source dashboard + worker resources on Coolify.
# 2. Bring the source apps back up (Coolify start), DNS back to the source if it was moved.
```

- The source DB was **frozen, not mutated**, so it is still consistent — rollback loses only the
  writes attempted on the (now-abandoned) K3s side during the window. Because the apps were down
  on the source during that window, there should be **no divergent writes**.
- Log the rollback, the trigger, and the observed state to `migration-log.md`; file an incident
  record (REC-TPL-004) if the rollback was due to a failure, per CLAUDE.md.

---

## 4. Validation checklist (window close criteria)

- [ ] CNPG `pg-restormel` healthy; Barman WAL archiving + first base backup to Object Storage green.
- [ ] Row-count parity verified on all load-bearing tables.
- [ ] Encrypted credentials decrypt on the target.
- [ ] dashboard + worker serving from K3s; `restormel.dev` + cert OK.
- [ ] Graph path against `surreal.restormel.dev` works from the K3s app.
- [ ] Migration head correct; no fail-closed errors.
- [ ] Source instance preserved warm for the soak period.
- [ ] Actions logged to `migration-log.md`.
