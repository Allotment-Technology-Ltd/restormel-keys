---
title: P3 — Self-hosted Postgres cutover runbook
class: technical
owner: founder
status: approved
classification: internal
control-tier: 1
created: 2026-06-13
last-reviewed: 2026-06-13
review-interval: P12M
---

# P3 — Self-hosted Postgres cutover runbook

> **Scope.** Move the dashboard's **operational** database off Neon onto a self-hosted
> Postgres on the shared box (`77.42.125.150`, internal Docker network only). This is
> step **P3** of the database-strategy roadmap (`docs/infra/database-strategy-roadmap.md`).
> It does **not** touch auth (that's P4 — Neon Auth → self-hosted Better Auth) and it
> does **not** delete any Neon data: Neon stays live as an **instant rollback** target.
>
> **Prerequisite:** the dual-driver adapter (**P3a**, PR `feat/p3a-dual-driver-pg`) must be
> merged first. Until then the migration runner and app talk neon-http only; after it,
> the driver is selected by the `DATABASE_URL` scheme (plain `postgres://` → `pg` Pool),
> so this whole cutover is a **`DATABASE_URL` change with zero call-site changes**.
>
> Convention (same as `coolify-cutover-runbook.md`): **[OWNER]** = a human does it in a
> browser/Coolify UI/DNS panel; **[AGENT]** = a Claude agent does it with repo + Coolify
> API access. **STOP** gates must not be crossed without the preceding verification green.

---

## 0. Why this is low-risk (verified 2026-06-13)

- **Schema is 100% portable to vanilla Postgres 16.** A scan of all 67 `apps/dashboard/migrations/*.sql`
  found **no Neon-specific SQL** and **no extensions**: only standard constructs
  (`TIMESTAMPTZ`, `NOW()`, `EXTRACT(EPOCH FROM NOW())`, `INTERVAL`, `gen_random_uuid()::text`
  — `gen_random_uuid()` is core in PG13+). No `pgvector`/`vector()`, no `postgres_fdw`/
  `FOREIGN TABLE`, no `pg_cron`. Embeddings are **not** in Postgres. The "Neon" strings in
  the migrations are all comments/operational notes, not features.
- **Auth is decoupled.** Sessions come from Neon Auth over HTTP, not the local DB, so the
  operational DB carries no live auth state (see exclude list in §3).
- **Rollback is one env var.** `DATABASE_URL` back to the Neon string + redeploy ≈ 2 min.

---

## 1. [OWNER or AGENT-with-token] Provision the box Postgres

Needs the **Coolify API token** (Coolify → Keys & Tokens, read+write+deploy) or the Coolify UI.

1. Coolify → the shared-box project → **+ New Resource → Database → PostgreSQL 16**.
2. Settings:
   - **Not** publicly exposed — leave "Make it publicly available" **off**. It must be
     reachable only on Coolify's internal Docker network (the dashboard + worker containers
     resolve it by service name).
   - Generate a strong password (do **not** reuse any existing secret):
     ```
     openssl rand -base64 32 | tr -d '/+=' | cut -c1-40
     ```
   - DB name: `restormel_ops` (or keep the Coolify default and note it).
3. Start it. Note the **internal** connection string Coolify shows, of the form:
   ```
   postgres://<user>:<password>@<service-name>:5432/restormel_ops?sslmode=disable
   ```
   `sslmode=disable` is correct for an internal-network-only Postgres (no TLS hop inside the
   Docker bridge). The P3a adapter parses `sslmode` from the URL.
4. Store that string in Coolify as a **new** env var on **staging** dashboard+worker first
   (e.g. `OPS_DATABASE_URL`) — do **not** point prod at it yet.

> **STOP** — do not change any prod `DATABASE_URL` until §4 (staging) is green.

---

## 2. [AGENT] Apply the schema to the box Postgres

Requires P3a merged (so the runner routes plain `postgres://` to the `pg` Pool).

```bash
# From the box / a host that can reach the internal PG, or via a staging shell:
DATABASE_URL='postgres://<user>:<pw>@<service>:5432/restormel_ops?sslmode=disable' \
  pnpm --filter dashboard run migrate
```

Verify every migration applied:

```bash
psql "$DATABASE_URL" -c "SELECT count(*) FROM schema_migrations;"   # expect 67 (or current count)
psql "$DATABASE_URL" -c "\dt"                                       # ~55 operational tables present
```

---

## 3. [AGENT] Copy operational data from Neon → box Postgres

Source = the **prod** Neon `DATABASE_URL` (in Coolify prod env / `apps/dashboard/.env.coolify-prod`).

**Exclude these tables' data** — they are auth-owned or derived, not operational, and P4 will
own them on the box:

| Table | Why excluded |
|---|---|
| `"user"`, `"session"`, `"account"`, `"verification"` | Better Auth / Neon Auth core (from `002_better_auth.sql`); auth state lives in Neon Auth |
| `users` | Neon Auth app **mirror** (`028_users_app_mirror.sql`) — re-derives from auth |
| `schema_migrations` | Repopulated by the runner in §2 — never copy |

```bash
NEON_URL='<prod neon DATABASE_URL>'
BOX_URL='postgres://<user>:<pw>@<service>:5432/restormel_ops?sslmode=disable'

pg_dump "$NEON_URL" \
  --data-only --no-owner --no-privileges \
  --exclude-table-data='"user"' \
  --exclude-table-data='session' \
  --exclude-table-data='account' \
  --exclude-table-data='verification' \
  --exclude-table-data='users' \
  --exclude-table-data='schema_migrations' \
  | psql "$BOX_URL"
```

> **Decision — `knowledge_source_documents.text`:** existing rows still hold cached user
> source text (the BYO-principle violation; new writes were stopped in P2b, the **purge is
> deferred** until store-resolution is proven and Adam is present). This dump copies them
> **as-is** to preserve rollback parity. Do **not** NULL/drop the column here — handle that
> under P2b as a deliberate, owner-present step.

Spot-check row counts match between Neon and the box for a few hot tables (`workspaces`,
`api_keys`, `routes`, `knowledge_graph_units`).

---

## 4. [OWNER or AGENT-with-token] Validate on staging

1. Point **staging** dashboard+worker `DATABASE_URL` → the box PG string. Redeploy (Coolify API).
2. Smoke test against staging:
   - `GET /healthz` → 200 (DB-independent; should already be 200).
   - `GET /keys/v1/catalog` → 200 with real rows (proves reads hit the box PG).
   - Sign in (Neon Auth still serves auth) → dashboard loads workspace/keys (proves the
     join across auth-from-Neon + ops-from-box works).
   - Trigger a small ingest run on staging → job state writes/reads against the box PG.

> **STOP** — prod cutover only after staging is green for all four.

---

## 5. [OWNER or AGENT-with-token] Prod cutover

1. (Optional, recommended) Re-run §3's `pg_dump` to capture the latest prod rows just before
   flipping, so the box is current.
2. Set **prod** dashboard+worker `DATABASE_URL` → the box PG string. Redeploy (Coolify API,
   serial: dashboard → poll terminal → worker).
3. Verify prod: `/healthz` 200, `/keys/v1/catalog` 200 with rows, a real sign-in loads data.

**Keep the Neon prod string saved** (in Coolify as `NEON_DATABASE_URL_ROLLBACK` and in
`apps/dashboard/.env.coolify-prod`).

### Rollback (≈2 min)
Set prod `DATABASE_URL` back to the saved Neon string, redeploy. No code change. Because §3
copied data forward only (Neon was never written-down), Neon still holds everything up to the
cutover moment; any writes made to the box after cutover would need manual reconciliation if
rolling back later — so roll back **fast** if the box proves unhealthy.

---

## 6. After P3 is stable

- P4 (Better Auth) then owns `"user"/"session"/"account"/"verification"` on this same box PG
  (schema already present from `002_better_auth.sql`).
- Once P3 **and** P4 are stable, Neon can be decommissioned (roadmap P5) with retention
  disclosure — **not** before, so the rollback target survives the auth cutover too.
