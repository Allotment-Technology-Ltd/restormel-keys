# Cutover runbook — Allotmentology → K3s + CNPG

**Move `allotmentology-postgres` off the Coolify box onto the shared `pg-platform`
CloudNativePG cluster, and move the Next.js app onto K3s, using a short `pg_dump`
maintenance window.**

- **Source of truth during the window:** the existing `allotmentology-postgres` instance stays
  authoritative and writable-frozen until the K3s target is verified.
- **Cutover switch:** the application `DATABASE_URL` (CNPG `pg-platform`, `allotmentology` DB).
- **Rollback:** re-point `DATABASE_URL` back to the source instance (Coolify env), or re-start the
  source app on Coolify.
- **Reference:** k3s-design §4.1 (`pg-platform` shared cluster, `instances: 2`), §4.4, full-plan §D
  (A3/A4). Phase-A scope: [`phase-0-prereqs.md`](phase-0-prereqs.md) (Allotmentology IS in Phase A).

> Allotmentology runs **Next.js 16 + Drizzle ORM + Better Auth** (no Supabase, no SurrealDB
> dependency) — the simplest of the four moves. It is a good early proof of the cluster.

> **Two repos, two homes.** The app lives in the **`allotment-technology-ltd`** repo (`web/`),
> NOT this repo. Today it deploys via **Coolify** on `.150` and **sources its env from Coolify
> env, not Infisical app-wide** — so the `DATABASE_URL` cutover, the Better Auth secret, and the
> Neon-Auth gate variable are all changed **on the Coolify / gitops side**, not here. The target
> K3s app deploys from the **`restormel-gitops`** repo (`charts/allotmentology` + values), Argo
> app **`allotmentology-prod`** (manual sync), namespace **`allotmentology-prod`**. Only the
> **DB** lands on infrastructure described in *this* repo (`deploy/k3s/cnpg/`).

---

## 0. Scope & invariants

| Item | Detail |
|---|---|
| **Database** | `allotmentology-postgres` (Coolify) → CNPG `pg-platform` (shared cluster, dedicated DB `allotmentology` + role `allotmentology_app`; see `cnpg/cluster-pg-platform.yaml`). |
| **App** | Next.js (`web/`, `allotment-technology-ltd` repo) Deployment. Better Auth tables live in the same Postgres → they move with the dump. |
| **Auth** | Better Auth is **self-contained in Postgres** — no external auth provider to re-register. Sessions live in the DB and survive the dump, so logged-in users stay logged in. magic-link + password; no MFA. |
| **Neon-Auth gate (fragile)** | The workspace approval gate (`ensureAppUser()`) is guarded by `NEON_AUTH_BASE_URL` still being set (`isNeonAuthConfigured()`). **Do NOT drop `NEON_AUTH_BASE_URL` as part of this cutover** — unsetting it silently breaks the gate. Decouple it in a separate change, not under the window. |
| **Schema isolation** | On the shared `pg-platform` cluster, Allotmentology gets its **own database + role**; Cilium NetworkPolicy keeps its traffic isolated from co-tenant DBs (`restormel_staging`, `usesophia`) (k3s-design §3.2). |
| **Secrets** | App secrets move **Coolify env → gitops values + ESO**. The DB role/password is ESO-rendered into Secret `pg-platform-allotmentology-creds` (ns `cnpg-system`). The Better Auth secret + the Neon-Auth gate var must render **byte-identical** on K3s (else existing sessions/JWTs break and the gate flips). |

> **Secrets boundary — route the gitops/app-side secret moves via `restormel-high-risk-security`**
> before opening the gitops PR (auth + DB credentials). NEVER paste a live connection string into
> shell history or a ticket — pull it from Infisical at the moment of use.

---

## 1. Pre-checks (green-light gate)

- [ ] `pg-platform` CNPG cluster healthy (`kubectl cnpg status pg-platform -n cnpg-system`); primary
      + standby both `Ready`; the `allotmentology` database + `allotmentology_app` role exist
      (bootstrapped) and are empty/ready to receive.
- [ ] Barman WAL archiving is green on `pg-platform` and the **first base backup has landed** in
      `restormel-cnpg-backups-fsn1` (fsn1) — confirm before you depend on it for rollback safety.
- [ ] App secrets staged on the **gitops side**: Better Auth `secret`, `NEON_AUTH_BASE_URL`,
      `AUTH_ALLOWED_EMAILS`, and any OAuth client id/secret render **byte-identical** via the
      Allotmentology ExternalSecret. (Secret-store reconciliation: per `phase-0-prereqs.md`, the
      store is being unified — target store **`infisical-allotmentology`** on branch
      `fix/eso-folder-stores` / PR #200. Confirm the ExternalSecrets all report `SecretSynced`
      before the window: `kubectl get externalsecrets -A`.)
- [ ] Next.js image built + pushed to the Forgejo registry; `charts/allotmentology` values bumped
      to that tag in `restormel-gitops`; Argo app `allotmentology-prod` is `OutOfSync` and ready
      to sync (it is **manual-sync** — it will not flip itself).
- [ ] A fresh, independent base backup of the **source** `allotmentology-postgres` exists (separate
      from this window — your safety net if both the source freeze and the new target go wrong).
- [ ] Maintenance banner staged; window communicated. **All times UTC.**
- [ ] Two operators present (one drives, one verifies the connection-string flip).

```bash
# CNPG health + the target DB exists in the shared cluster.
kubectl cnpg status pg-platform -n cnpg-system
kubectl cnpg psql pg-platform -n cnpg-system -- -c '\l' | grep allotmentology
# Confirm Barman base-backup history is non-empty (latest backup Completed).
kubectl get backups.postgresql.cnpg.io -n cnpg-system \
  -l cnpg.io/cluster=pg-platform
```

---

## 2. Maintenance-window steps

> Keep the window tight. Target < 30 min. All steps logged to
> [`planning/migration-log.md`](../../../planning/migration-log.md).

### 2.1 Freeze the source

```bash
# Stop the Allotmentology app on Coolify (do NOT stop the source Postgres) so no new
# writes land mid-dump. Coolify: stop the allotmentology app resource.
# Confirm no app connections remain on the source DB:
psql "$SOURCE_ALLOTMENTOLOGY_URL" -c \
  "SELECT count(*) FROM pg_stat_activity WHERE datname='allotmentology' AND application_name NOT LIKE 'psql%';"
```

### 2.2 `pg_dump` the source

```bash
# Custom format, no owner/privs (CNPG role differs from the Coolify role).
pg_dump --format=custom --no-owner --no-privileges \
  --file=/tmp/allotmentology.dump "$SOURCE_ALLOTMENTOLOGY_URL"
# Record the dump size + sha256 in the migration log.
sha256sum /tmp/allotmentology.dump
```

### 2.3 Restore into CNPG `pg-platform`

```bash
# Stream the dump into the target `allotmentology` DB via the primary (rw) service,
# over the private network. Run from a throwaway client pod / bastion that can reach
# pg-platform-rw.cnpg-system.svc — never expose the DB publicly for the window.
pg_restore --no-owner --no-privileges --exit-on-error \
  --dbname "$TARGET_PG_PLATFORM_ALLOTMENTOLOGY_URL" /tmp/allotmentology.dump
```

### 2.4 Verify the target (before any flip)

```bash
# Row-count parity, including Better Auth tables (sessions must survive so users stay
# logged in). Better Auth table names are unquoted-lowercase-reserved → quote "user".
for t in "user" session account verification; do
  echo -n "$t  src="; psql "$SOURCE_ALLOTMENTOLOGY_URL" -tAc "SELECT count(*) FROM \"$t\";"
  echo -n "    tgt="; psql "$TARGET_PG_PLATFORM_ALLOTMENTOLOGY_URL" -tAc "SELECT count(*) FROM \"$t\";"
done
# Also spot-check the load-bearing app + gate tables (the Neon-Auth approval gate reads
# public.users — confirm it came across so approved users stay approved).
for t in users; do
  echo -n "$t  src="; psql "$SOURCE_ALLOTMENTOLOGY_URL" -tAc "SELECT count(*) FROM $t;"
  echo -n "    tgt="; psql "$TARGET_PG_PLATFORM_ALLOTMENTOLOGY_URL" -tAc "SELECT count(*) FROM $t;"
done
```

- [ ] Row counts match — app tables **and** Better Auth `user`/`session`/`account`/`verification`.
- [ ] `public.users` (approval-gate source) row count matches.
- [ ] Drizzle migration head on the target == source (no pending migrations to "discover" on first
      boot). Check the Drizzle migrations table:
      `psql "$TARGET_…" -tAc 'SELECT hash, created_at FROM "__drizzle_migrations" ORDER BY id DESC LIMIT 1;'`

### 2.5 Flip the connection string (the cutover)

> The `DATABASE_URL` for the K3s app is composed from the ESO-rendered DB role
> (`pg-platform-allotmentology-creds`) + the CNPG primary service host, and set on the
> **gitops side** (`charts/allotmentology` values / its ExternalSecret), **not in this repo**.
> Form:
> `postgresql://allotmentology_app@pg-platform-rw.cnpg-system.svc.cluster.local:5432/allotmentology`

```bash
# Ensure DATABASE_URL (and the unchanged Better Auth secret + NEON_AUTH_BASE_URL) resolve to
# pg-platform for the K3s app, then SYNC the manual Argo app so the new Deployment comes up
# pointed at CNPG.
kubectl get externalsecret -n allotmentology-prod              # all SecretSynced
argocd app sync allotmentology-prod                            # manual sync — it won't self-flip
kubectl -n allotmentology-prod rollout status deploy/allotmentology-web
```

### 2.6 Smoke test on K3s

- [ ] `allotmentology.tech` loads from the cluster ingress; cert valid.
- [ ] An **existing** session is still valid (no forced re-login) → confirms `session` rows + the
      Better Auth secret moved intact.
- [ ] A fresh login + logout works (magic-link **and** password paths).
- [ ] **The approval gate still gates** — an allow-listed user reaches the workspace, a non-listed
      one is blocked (confirms `NEON_AUTH_BASE_URL` still set + `public.users` migrated).
- [ ] A write (create/update a record) persists and reads back from `pg-platform`.
- [ ] Drizzle migration head correct; no migration errors in the app logs
      (`kubectl -n allotmentology-prod logs deploy/allotmentology-web | grep -i migrat`).
- [ ] DNS for `allotmentology.tech` resolves to the cluster ingress.

### 2.7 Confirm the new DB is in the backup loop

```bash
# The target's WAL is archived continuously by the pg-platform isWALArchiver plugin; base
# backups come from the pg-platform-daily ScheduledBackup (03:00 UTC) → ObjectStore
# backups-fsn1 → bucket restormel-cnpg-backups-fsn1 (fsn1). Force one base backup now so
# the migrated data is covered immediately, don't wait for the schedule:
kubectl cnpg backup pg-platform -n cnpg-system --backup-name allotmentology-postcutover
kubectl get backup allotmentology-postcutover -n cnpg-system -o jsonpath='{.status.phase}'   # → completed
# Confirm WAL is flowing (no archive errors) and the base backup object landed in fsn1.
kubectl cnpg status pg-platform -n cnpg-system | grep -iE 'archiv|backup'
```

- [ ] Post-cutover base backup `completed` and visible under `pg-platform`'s `serverName` in
      `restormel-cnpg-backups-fsn1`.
- [ ] Continuous WAL archiving green (no `Continuous Archiving` errors in `cnpg status`).

### 2.8 Close the window

- [ ] Remove the maintenance banner.
- [ ] Keep the **source `allotmentology-postgres` instance untouched and warm** as the rollback
      target for the agreed soak period (≥ 48 h recommended) before decommission.

---

## 3. Rollback (re-point the connection string)

If smoke tests fail or unexpected behaviour appears during the soak:

```bash
# Option A — stay on Coolify (fastest, no data lost on the source):
#   1. Re-start the source Allotmentology app on Coolify (its DATABASE_URL still points at
#      allotmentology-postgres). A Coolify env change needs a FULL deploy to take effect, not a
#      restart — see the `coolify-env-cutover` skill if you also need to change the env value.
#   2. DNS for allotmentology.tech back to the source ingress if it was moved.
#
# Option B — already partly on K3s and only the DB is wrong:
#   Re-point the K3s app's DATABASE_URL back to the source instance (gitops values / ESO re-sync)
#   and re-sync Argo. (Cross-region reach from the cluster to the Coolify box is required for this.)
```

- The source DB was **frozen, not mutated**, so it is still consistent — rollback loses only the
  writes attempted on the (now-abandoned) K3s side during the window. Because the app was **down on
  the source** during that window, there should be **no divergent writes**.
- The Better Auth secret never changed, so sessions remain valid on whichever side you land.
- Log the rollback, the trigger, and the observed state to `migration-log.md`; **file an incident
  record (REC-TPL-004)** if the rollback was due to a failure, per CLAUDE.md.

---

## 4. Validation checklist (window close criteria)

- [ ] CNPG `pg-platform` healthy; Barman WAL archiving green; **post-cutover base backup landed in
      `restormel-cnpg-backups-fsn1` (fsn1)**; `allotmentology` DB isolated by role + NetworkPolicy.
- [ ] Row-count parity on app + Better Auth + `public.users` tables.
- [ ] Existing sessions survived; fresh login (magic-link + password) works.
- [ ] Approval gate still enforced (`NEON_AUTH_BASE_URL` intact); allow-listed in, others out.
- [ ] App serving from K3s `allotmentology-prod`; `allotmentology.tech` + cert OK.
- [ ] Drizzle migration head correct; no fail-closed migration errors.
- [ ] Source `allotmentology-postgres` preserved warm for the soak period.
- [ ] All actions logged to `migration-log.md` (UTC).
