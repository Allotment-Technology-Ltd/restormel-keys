---
title: Dashboard Postgres migrations (CI/CD)
class: technical
owner: founder
status: approved
classification: internal
control-tier: 1
created: 2026-04-10
last-reviewed: 2026-06-13
review-interval: P12M
---

# Dashboard Postgres migrations (CI/CD)

Canonical note for the Postgres schema used by `apps/dashboard`. SQL lives under [`apps/dashboard/migrations/`](../../apps/dashboard/migrations/). The runner ([`apps/dashboard/scripts/apply-migrations.mts`](../../apps/dashboard/scripts/apply-migrations.mts) → [`migration-runner.ts`](../../apps/dashboard/src/lib/server/migration-runner.ts), invoked by `pnpm --filter dashboard run migrate`) applies pending `*.sql` files in **numeric order**, tracking each applied file in the `schema_migrations` table. It is **idempotent** (already-applied files are skipped; each migration runs in its own transaction with an `ON CONFLICT DO NOTHING` tracking insert) and **fail-closed** (any migration error → non-zero exit).

## Production (Coolify — applied automatically on deploy)

The prod dashboard runs on **Coolify** (self-hosted box, plain Postgres via `DATABASE_URL`), built from [`Dockerfile.dashboard`](../../Dockerfile.dashboard). **Migrations are applied automatically on every deploy** by the container entrypoint ([`apps/dashboard/docker-entrypoint.sh`](../../apps/dashboard/docker-entrypoint.sh)) **before** the SvelteKit server starts. This closes the gap that caused the 2026-06-15 catalogue 503 — deployed code needed migration `068` while prod was still at `067`, because Coolify deploys do not run migrations and the Forgejo CI "Apply dashboard migrations" step only targets the **CI** DB, never prod.

How it works (issue #18):

1. `ENTRYPOINT` runs `node --import tsx apps/dashboard/scripts/apply-migrations.mts` against the container's `DATABASE_URL` (tsx + the runner ship in the serve stage — same full-workspace image the ingest worker uses).
2. **Fail-closed:** if any migration errors, the entrypoint (`set -e`) exits non-zero, the server is never started, `/healthz` never goes green, and **Coolify marks the deploy failed** — a half-migrated DB is never served, and the previous (healthy) container keeps running.
3. On success the entrypoint `exec`s the server CMD (node stays PID 1 for clean SIGTERM).

**Multi-replica concurrency (advisory lock — implemented):** the runner gates the whole migration run behind a Postgres **session advisory lock** ([`apps/dashboard/src/lib/server/migration-lock.ts`](../../apps/dashboard/src/lib/server/migration-lock.ts) — `pg_advisory_lock(21067, 1)`). When the dashboard runs **>1 replica** and a migration-carrying deploy starts two pods concurrently, exactly **one** replica acquires the lock and applies migrations; the other(s) **block** on the lock, then proceed and find every migration already applied → a clean **no-op**. The lock is acquired on a dedicated client from the **same** `DATABASE_URL` pool the migrator uses, held across the entire run, and always released in a `finally` (the connection close is a backstop). The **fail-closed contract is preserved**: a real migration error still propagates and exits non-zero; the lock is never used to swallow errors. This is the prerequisite that unblocks scaling the dashboard to 2 replicas (HA). The lock applies on the **pg** driver (in-cluster CNPG — the HA target); the **neon-http** path (CI / legacy Neon) is a single-runner step and runs unguarded (a session lock is not expressible over stateless HTTP).

**Manual / hotfix (operator):** the same runner can be invoked by hand against prod (see [Local / operator](#local--operator)) — it is safe to re-run (idempotent).

## Legacy: Neon + GitHub Actions (historical)

> The section below describes the **pre-Coolify** Neon + Vercel/GitHub-Actions flow. It is retained for history; production is now the Coolify entrypoint above. The Forgejo CI `apply-migrations` job still runs the same runner against the **CI** DB only.

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

### Neon compute: preview branches and cost

**Two sources of `preview/…` branches are common:**

1. **This repo’s GitHub Actions** (`neon_workflow.yml`) — creates `preview/<head_ref>` (with expiry) for non-Dependabot PRs, runs migrations + catalog seed, and deletes matching branches when the PR **closes** (also tries `preview-pr-<n>`). Dependabot PRs are **skipped** here (`github.actor != dependabot[bot]`), so Actions does not create preview DBs for those PRs.
2. **Vercel’s Neon Git integration** — can create Neon preview branches for **preview deployments** (branch metadata often shows `creation_source: vercel`). That can include **Dependabot** head branches and other PRs **independently** of the workflow above. If those branches are not removed when previews end, they keep **compute / storage** until deleted in Neon or by automation.

**Product policy (this repo):** **Dependabot and other dependency-only PR previews do not need an isolated Neon database.** GitHub Actions already skip creating preview DBs for Dependabot (`neon_workflow.yml`). Branches named `preview/dependabot/…` with **`creation_source: vercel`** in Neon almost always come from a **Neon ↔ Vercel Marketplace integration**, not from `vercel.json` in this repo (there is no Neon branching config in [`vercel.json`](../../vercel.json)).

#### Why you may not see a “turn off branching” toggle

Neon’s own comparison ([**Integrating Neon with Vercel**](https://neon.com/docs/guides/vercel-overview)) states that **both** the [Vercel-Managed](https://neon.com/docs/guides/vercel-managed-integration) and [Neon-Managed](https://neon.com/docs/guides/neon-managed-vercel-integration) integrations support **preview branching**. There is **no** per-integration “disable preview branches only” switch in those docs—the alternative path is a **[manual connection](https://neon.com/docs/guides/vercel-manual)** (env vars only), which does **not** auto-create branches.

**Where the integration is configured (not in this repo):**

| Product | Where to look |
|--------|----------------|
| **Vercel** | Project **Settings → Integrations**: **Native Integrations** (“Neon Postgres”, Vercel-managed billing) vs **Connectable Accounts** (“Neon”, Neon-managed billing)—see Neon’s [overview](https://neon.com/docs/guides/vercel-overview). |
| **Neon** | [Neon Console](https://console.neon.tech) → your project → **Integrations** → **Manage** (Neon-managed flow): optional **Automatically delete obsolete Neon branches**, **Disconnect** to stop creating new preview branches. See [Neon-Managed integration](https://neon.com/docs/guides/neon-managed-vercel-integration#managing-the-integration). |

**Ways to stop Vercel from minting Neon preview branches**

1. **Disconnect + manual env (strongest)** — In Neon: **Integrations → Manage → Disconnect** (stops new branches; [Neon docs](https://neon.com/docs/guides/neon-managed-vercel-integration#disconnect-integration)). In Vercel: **Settings → Environment Variables**—set `DATABASE_URL`, `NEON_AUTH_BASE_URL`, etc. yourself per [manual setup](https://neon.com/docs/guides/vercel-manual). Preview deployments then **reuse whatever URL you set for Preview** (often one shared branch, or production if you accept that risk—decide explicitly). Our **GitHub Actions** preview DB workflow (`neon_workflow.yml`) remains available if you want **per-PR Postgres only from CI**, not from Vercel.

2. **Keep the integration but reduce waste** — [Managing Vercel preview branch cleanup](https://neon.com/docs/guides/vercel-branch-cleanup): shorten **Vercel → Settings → Security → Deployment retention** for pre-production; enable Neon’s **Automatically delete obsolete Neon branches** when offered; keep this repo’s **Prune stale Neon preview branches** workflow.

**Operational levers:**

- **Dependabot batching** — [`.github/dependabot.yml`](../../.github/dependabot.yml) opens **at most one** npm grouped PR and **one** GitHub Actions grouped PR per week (`weekly-*` groups, `open-pull-requests-limit: 1`), so dependency bumps do not fan out into many preview deployments (and Neon `preview/…` branches from the Vercel integration). Merge or supersede that weekly PR before the next run if you want a single slot for updates.
- **Prune stale Neon preview branches** — [`.github/workflows/neon-prune-preview-branches.yml`](../../.github/workflows/neon-prune-preview-branches.yml). Manual runs default to **dry-run**; the **weekly schedule** runs a **live** prune (stale candidates only, respecting open PRs and minimum age). Use **Actions → Prune stale Neon preview branches → Run workflow** with `dry_run` unchecked for an immediate cleanup after changing defaults.
- **Neon Console** — delete obsolete `preview/*` branches by hand if you hit branch limits or need a fast reduction.
- **Neon project settings** — default branch autosuspend, min/max CU, and branch limits are the billing levers once branch count is under control.

**Application queries (dashboard):** The dashboard uses `@neondatabase/serverless` with a pooled `DATABASE_URL` in production. Further efficiency (single shared client instance per isolate, batching writes, avoiding N+1 in hot routes) is **code-level** work in [`apps/dashboard/src/lib/server/neon.ts`](../../apps/dashboard/src/lib/server/neon.ts); keep schema indexes aligned with common `WHERE` / join paths when adding features.

## Local / operator

```bash
export DATABASE_URL='postgresql://…'
bash scripts/apply-dashboard-migrations.sh
```

Or a single file: `psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f apps/dashboard/migrations/NNN_name.sql`

## Security

Do not commit connection strings. Treat **`DASHBOARD_DATABASE_URL_PROD`** as **production** access; rotate if leaked. See [`docs/governance/security-baseline.md`](../governance/security-baseline.md).
