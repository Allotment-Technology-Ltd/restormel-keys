# Postgres → CloudNativePG migration mechanics

> **Authoring-only.** This is the runbook for moving the existing self-hosted
> Postgres databases into the CNPG clusters defined in this directory. It
> describes the **decided cutover method (short pg_dump/restore maintenance
> window)**, the per-database order, and the rollback posture. **No commands
> here are run automatically; nothing is applied by merging this PR.**

## Decided cutover method: short pg_dump/restore maintenance window

The founder chose **short maintenance windows** over a zero-downtime logical-
replication cutover. For databases this size (PoC traffic; the operational DB is
~55 tables), a `pg_dump | pg_restore` inside a brief window is simpler, easier to
verify, and easier to roll back than streaming logical replication — and it
avoids the sequence/large-object/DDL edge cases that bite logical-replication
cutovers. We accept a few minutes of write-downtime per database.

Logical replication (`pglogical` / native `CREATE SUBSCRIPTION`) is explicitly
**not** used for this migration.

### The window shape (per database)

```
1. Announce window. Put the consuming app into read-only / maintenance, OR stop
   its writer (the dashboard worker for restormel_ops; the Supabase API for
   plotbudget). Reads can continue against the SOURCE.
2. Final dump from the SOURCE (consistent snapshot):
      pg_dump --format=custom --no-owner --no-privileges \
        --dbname="$SOURCE_URL" --file=/tmp/<db>.dump
3. Restore into the CNPG target (connect to the cluster's -rw service):
      pg_restore --no-owner --no-privileges --clean --if-exists \
        --dbname="$TARGET_URL" /tmp/<db>.dump
   (For restormel_ops, run the dashboard migration runner against the target
    FIRST to create the schema, then restore --data-only — see §restormel_ops.)
4. Verify (see "Verification gate" below) BEFORE repointing anything.
5. Repoint the app's connection string (DATABASE_URL / Supabase DB host) at the
   CNPG cluster's `-rw` service; redeploy/restart the app; lift maintenance.
6. KEEP THE SOURCE RUNNING and authoritative-capable until the target is proven
   in production (see Rollback).
```

`$TARGET_URL` connects to the in-cluster service `<cluster>-rw.cnpg-system.svc`
(primary, read-write). Run the dump/restore from a one-shot pod/job in-cluster
(or over a port-forward) so traffic stays inside the cluster network.

## Per-database order (least-risk first)

Migrate in ascending order of blast radius so the mechanics are proven on
low-risk DBs before the live prod app DB:

| # | Database | Target cluster | Source today | Risk | Notes |
|---|----------|----------------|--------------|------|-------|
| 1 | `allotmentology` | `pg-platform` | Coolify/box PG (or fresh) | Low | Light web app; smallest blast radius — proves the pipeline. |
| 2 | `restormel_staging` | `pg-platform` | staging box PG | Low | Non-prod; safe place to rehearse the exact restormel_ops steps. |
| 3 | `plotbudget` | `pg-plotbudget` | **managed Supabase** | Medium | See "plotbudget / Supabase" — extensions + Supabase roles are the real work, not the data move. |
| 4 | `usesophia` | `pg-platform` | **Firestore (not PG yet)** | Medium | **Deferred** — see "UseSophia after migration". Only a PG move once Sophia's DB is relational. |
| 5 | `restormel_ops` | `pg-restormel` | live self-hosted PG (P3) | **High** | LAST. The live prod app DB. Schema-first restore (below). |

Do each fully — **dump → restore → verify → repoint → soak** — before starting
the next. A failure on #1 must not have touched #5.

### restormel_ops (the live prod app DB) — schema-first restore

The dashboard owns its schema via its migration runner (the P3 runbook's
`pnpm --filter dashboard run migrate`, schema verified portable to PG16). So for
`restormel_ops` do **schema-first, data-second**, not a blind full-DB restore:

```
a. Point the migration runner at the pg-restormel target and run ALL migrations
   (incl. the latest), creating an empty, correctly-versioned schema:
      DATABASE_URL="$TARGET_URL" pnpm --filter dashboard run migrate
b. Dump DATA ONLY from the source, excluding runner-owned / auth-owned tables
   exactly as the P3 runbook does:
      pg_dump "$SOURCE_URL" --data-only --no-owner --no-privileges \
        --exclude-table-data='schema_migrations' \
        --exclude-table-data='"user"' --exclude-table-data='session' \
        --exclude-table-data='account' --exclude-table-data='verification' \
        --exclude-table-data='users' \
        | psql "$TARGET_URL"
c. Spot-check row counts on hot tables (workspaces, api_keys, routes,
   knowledge_graph_units) between source and target.
```

This keeps `schema_migrations` authoritative from the runner (never copied) and
preserves the P3 auth-table exclusions.

### plotbudget / self-hosted Supabase

The hard part is **not** the data — it's Supabase's roles and extensions:

- Self-hosted Supabase expects roles like `supabase_admin`, `authenticator`,
  `anon`, `authenticated`, `service_role`, and extensions such as `pgcrypto`,
  `pgjwt`, `uuid-ossp`, and (if used) `pgvector` / `pg_graphql`.
- The stock CNPG `postgresql:16` image does **not** ship every Supabase
  extension. Before the data move, confirm the extension set against the chosen
  image; if `pgvector`/`pgjwt`/`pg_graphql` are required, build a custom CNPG
  image (or wrap the Supabase Postgres image) — **flagged as a founder gap.**
- Sequence: stand up Supabase's roles + extensions on the target, then
  `pg_dump`/restore the `plotbudget` data, then point the self-hosted Supabase
  services (GoTrue/PostgREST/Realtime/Storage) at the `pg-plotbudget-rw` service.

### UseSophia after migration

`usesophia` is created pre-emptively in `pg-platform` but **stays empty/unused
until Sophia's database is migrated off Firestore to relational Postgres**.
Sophia's conversation docs live in Firestore today; there is no Postgres source
to dump yet. Do the `usesophia` PG move only after Sophia is relational — until
then this is a placeholder DB + role, nothing to cut over.

## Bootstrap-sensitive: do NOT migrate into CNPG during this work

Two Postgres instances **stay off-cluster** and are explicitly **excluded** from
CNPG during this migration. Migrating the database that the cluster's own
deploy/secret tooling depends on **into that same cluster** is a chicken-and-egg
failure mode — a cluster issue would then take down the tooling needed to fix it.

| Off-cluster PG | Why it must NOT go into CNPG now |
|---|---|
| **Forgejo's Postgres** | Forgejo is the git + CI system of record that ships and deploys these manifests. If its DB lived in the cluster these manifests build, a cluster outage would block the very tooling needed to recover — and Forgejo couldn't deploy its own fix. Keep it on its own box. |
| **Infisical's Postgres** | Infisical (`secrets.restormel.dev`) is the source ESO reads to render the S3 creds + DB passwords these clusters need **at boot**. If Infisical's DB depended on a cluster that can't start without Infisical's secrets, the cluster can never cold-start. Classic bootstrap deadlock. |

> `restormel_ops` is **different** — it is the app DB and the intended migration
> target, so it **does** go into `pg-restormel`. Only the *bootstrap/control-plane*
> databases (Forgejo, Infisical) stay out. Their eventual treatment (if ever
> brought under CNPG) is a **separate, later** exercise with its own break-glass
> plan, sequenced so the cluster can always cold-start without them.

## Verification gate (must be green before repoint)

For each database, before changing any connection string:

1. **Row counts** match source vs target on the hot tables (per-DB list above).
2. **App smoke test** against the target via a staging/temporary connection:
   reads return real rows; a representative write succeeds.
3. **Backups working**: the cluster's `ScheduledBackup` has produced at least one
   base backup to fsn1, and WAL is archiving (check the cluster status /
   `kubectl cnpg status <cluster>` shows continuous archiving healthy).
4. **Standby healthy**: the second instance is streaming and caught up.

If any check fails, **do not repoint** — fix or roll back the target; the source
is untouched.

## Rollback — keep the source authoritative until verified

The rollback posture mirrors the infra-split runbook (REC-PLAN-015): the
**source database stays running and authoritative-capable** until the CNPG
target is proven in production.

- **Before repoint:** trivial — nothing changed; just don't repoint. Tear down /
  re-init the CNPG target and retry.
- **After repoint, target unhealthy:** repoint the app's connection string back
  to the **source** and redeploy/restart (≈ the P3 "rollback is one env var"
  property). Because the dump copied data *forward only* (the source was never
  written-down), the source still holds everything up to the cutover moment.
  Roll back **fast** — any writes made to the CNPG target after cutover would
  need manual reconciliation if you roll back later.
- **Decommission the source only** after the target has soaked in production and
  a restore drill from fsn1 has succeeded (mirrors REC-PLAN-015 Phase 8). Until
  then the source is the rollback target; do not delete it.

## DR / PITR (post-migration)

Once live on CNPG, recovery uses `recovery-example.yaml`:
- **Full DR:** bootstrap a fresh cluster from the fsn1 ObjectStore (recover to
  end of WAL).
- **PITR:** set `bootstrap.recovery.recoveryTarget.targetTime` to roll back to a
  moment before a bad change. Restore into a **new** cluster name, verify, then
  repoint — never restore over the live cluster in place.

Because backups land in **fsn1** (a different region from compute), a compute-
region loss does not take the backups with it — this is the cross-region
sovereign DR property.

## Open items / owner gates

- Confirm the Supabase extension set vs the CNPG image for `pg-plotbudget`
  (custom image may be required).
- Confirm the `allotmentology` source of truth (fresh init vs existing box PG).
- A restore drill from fsn1 must pass before any source is decommissioned.
