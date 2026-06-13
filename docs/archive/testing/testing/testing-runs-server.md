# Runs API server (`@restormel/testing-runs-server`)

**Purpose:** Minimal HTTP surface matching [runs-api-v1.md](runs-api-v1.md) so CI or a controller can **enqueue** a suite run and **poll** to completion without shelling out to `testing run` directly.

**Production layout (TLS, Unix socket, rate limits, logs):** [testing-runs-server-deployment.md](testing-runs-server-deployment.md).

## Security

- **Bind:** Defaults to **`127.0.0.1`** — do not expose raw to the internet without TLS and auth.
- **Auth:** Optional **`RESTORMEL_RUNS_API_TOKEN`** — clients must send `Authorization: Bearer <token>`.
- **Workspace:** **`RESTORMEL_RUNS_WORKSPACE`** must be an **absolute** path to the repo root; config paths and `.restormel-testing/` artefacts are constrained under that tree (same rules as the CLI).
- **Database URL:** Treat like any Postgres credential — **GitHub Actions secrets** or your secret manager only; never commit.

## Neon Postgres (recommended for Restormel stack)

Use the **same Neon project** as the dashboard (one more table) **or** a **dedicated Neon branch** for isolation.

1. Apply migration **`027_restormel_testing_run_jobs.sql`**:
   - **Monorepo path:** [`apps/dashboard/migrations/027_restormel_testing_run_jobs.sql`](../../apps/dashboard/migrations/027_restormel_testing_run_jobs.sql) (runs with existing dashboard migration jobs), or
   - **Package copy:** [`packages/testing-runs-server/schema/027_restormel_testing_run_jobs.sql`](../../packages/testing-runs-server/schema/027_restormel_testing_run_jobs.sql)
2. Point the server at a connection string:
   - **`RESTORMEL_RUNS_DATABASE_URL`** — **preferred** (explicit sidecar config), or
   - **`DATABASE_URL`** — fallback if you already set it for Neon (e.g. same value as the dashboard app).

On startup, the server **pings** the database (`SELECT 1`). If the URL is set but the table is missing, startup **fails** with a message referencing migration **027**.

Without a URL, the server uses an **in-memory** store (fine for local dev; run history is lost on restart).

## Run

From the monorepo (after `pnpm run build:testing-packages`):

```bash
export RESTORMEL_RUNS_WORKSPACE="$(pwd)"
# optional Neon:
# export RESTORMEL_RUNS_DATABASE_URL="postgresql://…?sslmode=require"
# optional: export RESTORMEL_RUNS_API_TOKEN="your-random-token"
pnpm exec restormel-testing-runs-server --port=8787
```

Environment variables:

| Variable | Description |
|----------|-------------|
| `RESTORMEL_RUNS_WORKSPACE` | Required — repo root |
| `RESTORMEL_RUNS_DATABASE_URL` | Optional — Neon / Postgres connection string (persists job rows) |
| `DATABASE_URL` | Optional fallback if `RESTORMEL_RUNS_DATABASE_URL` unset |
| `RESTORMEL_RUNS_PORT` | Default `8787` |
| `RESTORMEL_RUNS_HOST` | Default `127.0.0.1` |
| `RESTORMEL_RUNS_MAX_CONCURRENT` | Default `1` (Playwright is heavy) |
| `RESTORMEL_RUNS_API_TOKEN` | Optional Bearer secret |
| `RESTORMEL_RUNS_SOCKET_PATH` | Optional — absolute path; listen on **Unix socket** instead of TCP (`RESTORMEL_RUNS_HOST` / `PORT` ignored for bind) |
| `RESTORMEL_RUNS_LOG_LEVEL` | `debug` / `info` / `warn` / `error` (default `info`) — structured JSON logs on stderr |
| `RESTORMEL_RUNS_RATE_LIMIT_RPM` | `0` or unset = off; otherwise max HTTP requests per minute per client IP (or see trust proxy) |
| `RESTORMEL_RUNS_TRUST_PROXY` | Set to `1` only behind **your** proxy to use first `X-Forwarded-For` hop for rate-limit key |

## API

- **`POST /v1/runs`** — JSON body per [runs-api-v1.md](runs-api-v1.md) (`suite_id`, optional `environment_id`, `target_url`, `config_path`, `goal_ids`, …). Returns **`201`** with `{ id, status: "queued", created_at }`.
- **`GET /v1/runs`** — List runs: `?limit=50&offset=0` (see contract doc).
- **`GET /v1/runs/:id`** — Progress or terminal payload (`status`, `verdict`, `summary`, `artifact_manifest_hint` directory path).
- **`GET /health`** — `{ ok: true, store: "neon"|"memory", version, db: "ok"|"skipped"|"error" }`.

All JSON responses include **`X-Request-Id`** (echo a UUID in the request header to correlate with your trace).

Artefacts: `.restormel-testing/runs-api/<run-id>/` under the workspace (same bundle as CLI: `run.json`, `report.json`, `junit.xml`, …).

## Limitations

- **`503`** when `RESTORMEL_RUNS_MAX_CONCURRENT` is reached.
- List pagination is **offset**-based (simple; fine for moderate volume).
