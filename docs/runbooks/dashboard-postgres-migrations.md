# Dashboard Postgres migrations (CI/CD)

Canonical note for **Neon** schema used by `apps/dashboard`. SQL lives under [`apps/dashboard/migrations/`](../../apps/dashboard/migrations/). Apply script: [`scripts/apply-dashboard-migrations.sh`](../../scripts/apply-dashboard-migrations.sh) (runs every `*.sql` in **sorted** order; idempotent where files use `IF NOT EXISTS` / `IF EXISTS`).

## Production (GitHub Actions)

The **[CI/CD workflow](https://github.com/Allotment-Technology-Ltd/restormel-keys/blob/main/.github/workflows/ci.yml)** job **`apply-dashboard-migrations-prod`** runs on **`push` to `main`** when path filters detect:

- changes under `apps/dashboard/migrations/**`, or  
- changes to model catalog seed inputs (`apps/dashboard/data/model-catalog-seed.json` or `apps/dashboard/scripts/ingest-model-catalog.mjs`).

**Requirements:**

1. Repository secret **`DASHBOARD_DATABASE_URL_PROD`** — connection string for the **production** Neon branch (same DB the live dashboard uses).  
2. **`test`** job must **succeed** on that push (migrations do not run if the main pipeline is red).

The job installs `postgresql-client` and runs `apply-dashboard-migrations.sh` with `DATABASE_URL` set from that secret.

**Model catalog seed** in the same workflow run executes only when the path filter flags catalog-seed files **or** you use **workflow dispatch** with **`run_model_catalog_seed`**. Pure SQL migration pushes do **not** re-run the full catalog ingest (saves time; migrations remain fully applied).

**Manual / hotfix:** Actions → **CI/CD** → **Run workflow** → enable **`Apply dashboard SQL migrations to production DB`** (`run_db_migrations`) and/or **`Re-run model catalog JSON seed`** (`run_model_catalog_seed`) as needed.

**Concurrency:** The prod DB job uses a **`concurrency` group** so overlapping runs on `main` do not apply migrations in parallel.

## Pull requests (preview databases)

[`.github/workflows/neon_workflow.yml`](../../.github/workflows/neon_workflow.yml) creates or reuses a **Neon preview branch** and runs the same `apply-dashboard-migrations.sh` script against it (then optional catalog seed). Requires **`NEON_API_KEY`** and **`NEON_PROJECT_ID`**. If the Neon branch limit is hit, migrations for that PR are skipped with a warning (workflow still succeeds).

## Local / operator

```bash
export DATABASE_URL='postgresql://…'
bash scripts/apply-dashboard-migrations.sh
```

Or a single file: `psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f apps/dashboard/migrations/NNN_name.sql`

## Security

Do not commit connection strings. Treat **`DASHBOARD_DATABASE_URL_PROD`** as **production** access; rotate if leaked. See [`docs/security-baseline.md`](../security-baseline.md).
