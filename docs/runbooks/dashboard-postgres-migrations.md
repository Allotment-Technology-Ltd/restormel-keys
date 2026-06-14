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
