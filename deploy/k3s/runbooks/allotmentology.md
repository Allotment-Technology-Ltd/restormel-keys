# Cutover runbook — Allotmentology → K3s + CNPG

**Move `allotmentology-postgres` off the Coolify box onto the shared `pg-platform`
CloudNativePG cluster, and move the Next.js app onto K3s, using a short `pg_dump`
maintenance window.**

- **Source of truth during the window:** the existing `allotmentology-postgres` instance stays
  authoritative and writable-frozen until the K3s target is verified.
- **Cutover switch:** the application `DATABASE_URL` (CNPG `pg-platform`, `allotmentology` DB).
- **Rollback:** re-point `DATABASE_URL` back to the source instance.
- **Reference:** k3s-design §4.1 (`pg-platform` shared cluster, `instances: 2`), §4.4, full-plan §D (A3/A4).

> Allotmentology runs **Next.js + Drizzle ORM + Better Auth** (no Supabase, no SurrealDB
> dependency) — the simplest of the four moves. It is a good early proof of the cluster.

---

## 0. Scope & invariants

| Item | Detail |
|---|---|
| **Database** | `allotmentology-postgres` → CNPG `pg-platform` (shared cluster, dedicated DB/role). |
| **App** | Next.js (`web/`) Deployment; Better Auth tables live in the same Postgres → they move with the dump. |
| **Auth** | Better Auth is **self-contained in Postgres** — no external auth provider to re-register. Sessions live in the DB and survive the dump, so logged-in users stay logged in. |
| **Schema isolation** | On the shared `pg-platform` cluster, Allotmentology gets its **own database + role**; Cilium NetworkPolicy keeps its traffic isolated from co-tenant DBs (k3s-design §3.2). |
| **Secrets** | Via ESO ← Infisical. The Better Auth secret + OAuth client secrets must render byte-identical on K3s (else existing sessions/JWTs break). |

---

## 1. Pre-checks (green-light gate)

- [ ] `pg-platform` CNPG cluster healthy (`kubectl cnpg status pg-platform -n data`); the
      `allotmentology` database + role exist (bootstrapped) and are empty/ready to receive.
- [ ] Better Auth `secret`, OAuth client id/secret render byte-identical via the target `ExternalSecret`.
- [ ] Next.js image built + pushed; manifest in `restormel-gitops`; Argo app ready to sync.
- [ ] Fresh independent base backup of the source DB exists.
- [ ] Maintenance banner staged; window communicated.
- [ ] Two operators present.

```bash
kubectl cnpg status pg-platform -n data
kubectl cnpg psql pg-platform -n data -- -c '\l' | grep allotmentology
```

---

## 2. Maintenance-window steps

### 2.1 Freeze the source

```bash
# Stop the Allotmentology app on Coolify (do NOT stop the source Postgres).
# Confirm no app connections remain on the source DB:
psql "$SOURCE_ALLOTMENTOLOGY_URL" -c \
  "SELECT count(*) FROM pg_stat_activity WHERE datname='allotmentology' AND application_name NOT LIKE 'psql%';"
```

### 2.2 `pg_dump` the source

```bash
pg_dump --format=custom --no-owner --no-privileges \
  --file=/tmp/allotmentology.dump "$SOURCE_ALLOTMENTOLOGY_URL"
sha256sum /tmp/allotmentology.dump   # record in migration-log.md
```

### 2.3 Restore into CNPG `pg-platform`

```bash
pg_restore --no-owner --no-privileges --exit-on-error \
  --dbname "$TARGET_PG_PLATFORM_ALLOTMENTOLOGY_URL" /tmp/allotmentology.dump
```

### 2.4 Verify the target (before any flip)

```bash
# Row-count parity, including Better Auth tables (sessions must survive so users stay logged in).
for t in "user" session account verification; do
  echo -n "$t  src="; psql "$SOURCE_ALLOTMENTOLOGY_URL" -tAc "SELECT count(*) FROM \"$t\";"
  echo -n "    tgt="; psql "$TARGET_PG_PLATFORM_ALLOTMENTOLOGY_URL" -tAc "SELECT count(*) FROM \"$t\";"
done
```

- [ ] Row counts match (app tables **and** Better Auth `user`/`session`/`account`).
- [ ] Drizzle migration head on the target == source.

### 2.5 Flip the connection string (the cutover)

```bash
# Point DATABASE_URL at pg-platform-rw (allotmentology DB) via ESO/Infisical, then Argo-sync.
# DATABASE_URL → postgresql://<role>@pg-platform-rw.data.svc.cluster.local:5432/allotmentology
kubectl -n apps rollout status deploy/allotmentology-web
```

### 2.6 Smoke test on K3s

- [ ] `allotmentology.tech` loads.
- [ ] An **existing** session is still valid (no forced re-login) → confirms `session` rows + Better
      Auth secret moved intact.
- [ ] A fresh login + logout works (OAuth + password paths).
- [ ] A write (create/update a record) persists and reads back.
- [ ] Drizzle migration head correct; no migration errors in logs.
- [ ] DNS → cluster ingress; cert valid.

### 2.7 Close the window

- [ ] Remove the maintenance banner.
- [ ] Keep the source `allotmentology-postgres` warm as rollback target for the soak (≥ 48 h).

---

## 3. Rollback (re-point the connection string)

```bash
# 1. Re-point DATABASE_URL back to the source instance (ESO/Infisical re-sync) OR redeploy on Coolify.
# 2. Bring the source app back up; DNS back to the source if moved.
```

Source DB was frozen, not mutated → consistent. No divergent writes (app was down on the source
during the window). Log the rollback to `migration-log.md`; file an incident record (REC-TPL-004)
if the trigger was a failure.

---

## 4. Validation checklist (window close criteria)

- [ ] CNPG `pg-platform` healthy; Barman WAL + base backup green; `allotmentology` DB isolated by role + NetworkPolicy.
- [ ] Row-count parity on app + Better Auth tables.
- [ ] Existing sessions survived; fresh login works.
- [ ] App serving from K3s; `allotmentology.tech` + cert OK.
- [ ] Migration head correct.
- [ ] Source instance preserved warm for the soak period.
- [ ] Actions logged to `migration-log.md`.
