# Cutover runbook — UseSophia → K3s (+ SurrealDB re-point, Neon→CNPG, Neon Auth→Better Auth)

**Move UseSophia off Railway onto K3s. It has three distinct data moves, sequenced so the
SurrealDB change is transparent and the riskier database+auth move is a deliberate, separate
step.**

UseSophia is the only product with **two databases** plus a shared store:

1. **Shared SurrealDB** (knowledge graph / vector corpus) — moved in Phase A2; UseSophia just
   **re-points an env var** to it. No data move on Sophia's side.
2. **Its own Neon Postgres** (Drizzle ORM — operational/ingestion/training data) → CNPG
   `pg-platform` via a short `pg_dump` window.
3. **Neon Auth** (JWT/JWKS) → **Better Auth** (mirrors Restormel + the founder's auth decision).

- **Source of truth during each window:** the relevant source (Neon PG / Neon Auth / old SurrealDB
  on `.150`) stays authoritative and warm until the target is verified.
- **Cutover switches:** `SURREAL_URL` (+ NS/DB/creds), `DATABASE_URL` (Neon → CNPG), and the auth
  config.
- **Rollback:** re-point each env var / connection string back to its source.
- **Reference:** full-plan §C (the "simpler app, with a twist"), §D (A2→B1), §E.2; k3s-design §3.5, §5.

> **Do these as separate, ordered steps — never all in one window** (full-plan §C sequencing).
> The Neon-Auth → Better-Auth move is its own gated mini-cutover, scheduled *after* the app is
> stable on K3s + CNPG.

---

## 0. Scope & invariants

| Item | Detail |
|---|---|
| **App** | SvelteKit (Svelte 5) on Node 22, `adapter-node`, SSR. Built from `Dockerfile`. |
| **Scheduled work** | The `ingestion-job-tick` GitHub Actions cron (every 2 min) → becomes a **K8s CronJob** (or worker Deployment from `Dockerfile.ingest-worker`). |
| **SurrealDB invariant** | `surreal.restormel.dev` **must stay resolving to the cluster ingress** (HARD INVARIANT, k3s-design §3.5). Sophia's coupling is **four env vars only** — pure env cutover, no code change. |
| **SurrealDB identity** | NS `main` / DB `sophia`, user `importer`. Recreate the scoped `importer` user on the in-cluster instance. |
| **Sophia's own DB** | Neon Postgres (eu-west-2) + Drizzle. Migrating to CNPG is a **sovereignty win** (off managed US-owned SaaS), not a data-leaving-EU fix — frame accordingly. |
| **Auth** | Neon Auth (JWT/JWKS) → Better Auth. Existing user identities migrate; JWKS consumers re-point. |
| **Secrets** | Via ESO ← Infisical. No plaintext. |

---

## Step 1 — SurrealDB re-point (env-only, transparent)

> Precondition: **Phase A2 is done** — SurrealDB is running in-cluster on Hetzner CSI, the
> `sophia-prod-…surql` dump is restored (NS `main`/DB `sophia`), the `importer` user is recreated,
> and `surreal.restormel.dev` already points at the cluster ingress. Restormel's graph path is
> verified against it. **At that point Sophia — still on Railway — already talks to the new
> SurrealDB via the unchanged hostname.** No action needed for the transparent move itself.

### 1a. Pre-checks
- [ ] `surreal.restormel.dev` resolves to the cluster ingress; a Sophia graph **read** and **write**
      both succeed against it (from a one-off probe with the `importer` cred).
- [ ] The old SurrealDB on `.150` is kept **warm** as rollback until Sophia is verified in-cluster.

### 1b. Optional internal re-point (only once Sophia is on K3s — see Step 2)
```bash
# Drop the public hop: SURREAL_URL → surrealdb.data.svc.cluster.local:8000
# (and normalise scheme to ws/http for the in-cluster client). Env-only change.
```

### 1c. Rollback
Re-point `SURREAL_URL` back to the **old** instance's hostname/IP. Because the cutover is env-only
and the old instance is warm, rollback is a single env change + redeploy.

---

## Step 2 — Move the app + Neon Postgres → CNPG (short `pg_dump` window)

### 2.1 Pre-checks
- [ ] `pg-platform` CNPG healthy; the `sophia` database + role exist (bootstrapped), ready to receive.
- [ ] Sophia image built + pushed; manifest + the **ingestion CronJob** manifest in `restormel-gitops`;
      Argo ready to sync.
- [ ] The GitHub Actions ingestion cron is **paused** for the window (so no tick writes mid-dump).
- [ ] Fresh independent base backup of the Neon DB exists.
- [ ] Two operators present; maintenance window communicated.

### 2.2 Freeze the source
```bash
# Stop the Railway Sophia service (or scale to zero) + pause the ingestion-tick cron.
# Confirm no app connections remain on the Neon DB:
psql "$SOURCE_SOPHIA_NEON_URL" -c \
  "SELECT count(*) FROM pg_stat_activity WHERE application_name NOT LIKE 'psql%';"
```

### 2.3 `pg_dump` Neon → restore into CNPG
```bash
pg_dump --format=custom --no-owner --no-privileges \
  --file=/tmp/sophia.dump "$SOURCE_SOPHIA_NEON_URL"
sha256sum /tmp/sophia.dump   # record in migration-log.md

pg_restore --no-owner --no-privileges --exit-on-error \
  --dbname "$TARGET_PG_PLATFORM_SOPHIA_URL" /tmp/sophia.dump
```
> Note: Neon's `@neondatabase/serverless` driver is HTTP-based; CNPG is standard wire protocol.
> Confirm the app's DB client works over a plain `postgresql://` connection (the Drizzle config
> may need the standard `pg`/`postgres` driver instead of the Neon serverless driver). Validate in
> staging **before** the window.

### 2.4 Verify the target
```bash
for t in ingest_runs documents training_examples eval_runs; do  # adjust to Sophia's real tables
  echo -n "$t  src="; psql "$SOURCE_SOPHIA_NEON_URL" -tAc "SELECT count(*) FROM $t;"
  echo -n "    tgt="; psql "$TARGET_PG_PLATFORM_SOPHIA_URL" -tAc "SELECT count(*) FROM $t;"
done
```
- [ ] Row-count parity; Drizzle migration head matches.

### 2.5 Flip + deploy on K3s
```bash
# DATABASE_URL → pg-platform-rw (sophia DB) via ESO/Infisical. Argo-sync the Sophia app + CronJob.
kubectl -n apps rollout status deploy/usesophia-web
kubectl -n apps get cronjob usesophia-ingestion-tick
```
- [ ] App serves; `usesophia.app` → cluster ingress; cert valid.
- [ ] Graph read/write against SurrealDB works from the K3s pod (Step 1 verified end-to-end here).
- [ ] The ingestion CronJob fires on schedule and completes one tick (writes to CNPG + SurrealDB).

### 2.6 Rollback (re-point the connection string)
```bash
# DATABASE_URL → back to Neon (ESO/Infisical re-sync); redeploy Sophia on Railway; DNS back to Railway.
# SURREAL_URL → back to old .150 instance if Step 1's internal re-point was applied.
```
Source Neon DB was frozen, not mutated → consistent; no divergent writes. Old SurrealDB kept warm.

---

## Step 3 — Neon Auth → Better Auth (separate gated mini-cutover)

> Schedule **after** Step 2 is stable. This changes how users authenticate, so treat it as its own
> window with its own go/no-go. Route any auth/token change through `restormel-high-risk-security`
> before the PR (CLAUDE.md).

### 3.1 Plan
- Stand up Better Auth tables in the Sophia CNPG DB (mirrors Restormel's Better Auth schema).
- Migrate user identities from Neon Auth into Better Auth (email + provider links). Password-based
  accounts: if Neon Auth exposes hashes in a compatible format, import them; otherwise enrol users
  via password-reset/magic-link on first login (rehash-on-login) — **decide and document which**.
- Re-point any JWKS/JWT consumers to Better Auth's issuer.

### 3.2 Pre-checks (go/no-go)
- [ ] User-identity export from Neon Auth obtained and row-counted.
- [ ] Better Auth schema applied to the Sophia CNPG DB; secret + OAuth clients in Infisical/ESO.
- [ ] A **rehearsal** on a throwaway copy: import identities, log in as a test user via each method
      (password / OAuth / magic-link), confirm a session is issued and a protected route works.
- [ ] Rollback path defined (re-point auth config back to Neon Auth; Neon Auth kept live).

### 3.3 Cutover
- Freeze auth-mutating traffic (or accept a short login outage).
- Import identities; flip the app's auth config to Better Auth; redeploy.
- Smoke: fresh login (each method), session persists, logout, protected route.

### 3.4 Rollback
Re-point the auth config back to Neon Auth (kept live) and redeploy. No user data destroyed on Neon
Auth during the window.

---

## 4. Consolidated validation checklist

- [ ] **SurrealDB:** `surreal.restormel.dev` → cluster; Sophia graph read+write OK; old `.150` kept warm.
- [ ] **Postgres:** CNPG `pg-platform` (sophia DB) healthy; row-count parity; Barman backup green.
- [ ] **App:** serving on K3s; `usesophia.app` + cert OK; DB client works on standard wire protocol.
- [ ] **Ingestion CronJob:** fires on schedule, completes a tick, writes land in CNPG + SurrealDB.
- [ ] **Auth (Step 3):** users authenticate via Better Auth; each login method verified; sessions persist.
- [ ] Source Neon PG, Neon Auth, and old SurrealDB all kept warm through their soak periods.
- [ ] Actions logged to `migration-log.md`; incident record filed (REC-TPL-004) on any rollback.
