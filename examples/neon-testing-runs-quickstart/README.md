# Neon × `@restormel/testing-runs-server` quickstart

A minimal, runnable example: start the OSS **Restormel Testing Runs API**
(`@restormel/testing-runs-server`) with a **Neon** Postgres database as its durable run store,
and watch the Neon-backed endpoints answer.

The server keeps run history **in memory** by default. Point it at a Postgres URL and it uses
Neon instead (via [`@neondatabase/serverless`](https://github.com/neondatabase/serverless)) — so
run history survives restarts and is queryable straight from SQL.

## What this demonstrates

- Wiring `RESTORMEL_RUNS_DATABASE_URL` to a Neon branch.
- `GET /health` reporting `store: "neon"` and `db: "ok"` — a live Neon round-trip.
- `GET /v1/runs` reading durable run history from Neon.

Executing real test runs (`POST /v1/runs`) additionally needs a Restormel Testing–configured
workspace; see [`../testing-basic-web`](../testing-basic-web). This quickstart focuses on the
Neon-backed store.

## Prerequisites

- Node.js 20+ and `psql` (the PostgreSQL client, for the one-time schema apply).
- A Neon project and a branch — the free tier is plenty. Create a child branch of `production`
  (e.g. `runs-quickstart`) so you can throw it away afterwards. Full setup:
  [../../docs/guides/database-neon-for-self-hosters.md](../../docs/guides/database-neon-for-self-hosters.md).

## Run it

```bash
cd examples/neon-testing-runs-quickstart
cp .env.example .env
# edit .env — paste your Neon *pooled* connection string into RESTORMEL_RUNS_DATABASE_URL

pnpm install            # or: npm install

# load .env into the environment for the remaining steps
set -a; . ./.env; set +a

# one-time: create the run-history table on your Neon branch (idempotent).
# the SQL ships inside the installed package:
pnpm run migrate

# start the server (workspace can be this folder — the Neon store is what we're demoing)
pnpm start              # -> "…listening on http://127.0.0.1:8787 (…, store=neon)"
```

In another terminal (same `.env` loaded), smoke-test it:

```bash
set -a; . ./.env; set +a
pnpm run smoke
```

Expected:

```
== GET /health ==
{"ok":true,"store":"neon","service":"restormel-testing-runs-server","version":"…","db":"ok"}
== GET /v1/runs ==
{"items":[],"limit":50,"offset":0,"next_offset":null}
```

`store:"neon"` + `db:"ok"` means the server made a live round-trip to your Neon branch, and
`/v1/runs` is reading the (initially empty) `restormel_testing_run_jobs` table on it.

## Verify from SQL (optional)

```sql
select id, status, suite_id, created_at
from restormel_testing_run_jobs
order by created_at desc
limit 10;
```

## Clean up

Delete the Neon branch you created (Neon Console → Branches → ⋯ → Delete), or keep it —
branches are cheap and copy-on-write.

## How it fits

`@restormel/testing-runs-server` is one place Restormel Keys touches Postgres, and it treats
Neon as the recommended provider. For the full picture — self-hosting the control plane, Neon
Auth, and CI preview branches — see [NEON.md](../../NEON.md).
