# Database for self-hosters: Neon (recommended)

**Status:** Canonical (adopter-facing). **Published in-product:** [https://restormel.dev/keys/docs/guides/database-neon-for-self-hosters](https://restormel.dev/keys/docs/guides/database-neon-for-self-hosters)

**Purpose:** Tell operators and integrators **which database to use** when self-hosting Restormel products, **why Neon is the default recommendation**, and **what to configure**—without duplicating every migration filename here. This file and the in-dashboard page stay aligned.

**Security:** Do not paste real connection strings, API keys, or account emails into issues or docs. Use placeholders and secret stores only.

---

## Recommendation

**Restormel already recommends [Neon](https://neon.tech/) (serverless Postgres) as the default database** for self-hosted deployments that need the full **Restormel Keys** dashboard: durable workspaces, projects, Gateway key metadata, integrations metadata, and related control-plane features. **Neon Auth** is the documented choice for GitHub sign-in on that stack. This page is the public-facing summary; the in-dashboard copy stays in sync with this file.

- **Neon documentation (index):** [https://neon.com/docs/llms.txt](https://neon.com/docs/llms.txt) (links into the full doc set).
- **Neon Open Source Program** (credits and partnership for eligible OSS): [https://neon.com/programs/open-source](https://neon.com/programs/open-source).
- **Neon Console** (create projects, branches, Auth): [https://console.neon.tech](https://console.neon.tech).

Other Postgres-compatible providers can work in principle if you apply the same SQL migrations and accept operational trade-offs (branching per PR, Neon Auth integration, and the serverless driver are tested paths in this project).

---

## When you need a database

| Surface | Database required? | Notes |
|--------|-------------------|--------|
| **Restormel Keys dashboard** (BYOK, workspaces, Testing hub, billing-aware features) | **Yes** | Postgres + Neon Auth for the documented self-host path. |
| **Restormel Testing CLI** (deterministic suites against your app) | **No** | You can run the GA path without self-hosting Keys or any DB. |
| **Restormel Testing run jobs API** (durable job history) | **Optional** | In-memory when no DB URL is configured; Postgres when you set a runs database URL (see Testing runs docs in-repo). |

---

## Restormel Keys dashboard: what to set up in Neon

1. **Create a Neon project** in a region close to your app (e.g. EU for EU-hosted dashboards).
2. **Branches:** Use a **`production`** (or similarly named) branch for live traffic. For development and CI, use **child branches** or automation-driven preview branches so schema changes are tested before touching production.
3. **Connection string:** Prefer the **pooled** connection string for serverless hosts (Vercel, Cloud Run, etc.). Set it as **`DATABASE_URL`** on the dashboard runtime. Never commit it; use the host’s secret manager or environment UI.
4. **Neon Auth:** Enable Auth on the branch you use for the dashboard, add **GitHub** as an OAuth provider in the Neon Console, and set **`NEON_AUTH_BASE_URL`** to the Auth base URL Neon shows for that branch. Your GitHub OAuth App’s **callback URL** must match the **dashboard** route that completes GitHub sign-in for your deployment (see your host’s deployment notes for the exact path).
5. **Schema:** Apply the versioned SQL migrations shipped in the open **restormel-keys** repository under `apps/dashboard/migrations/` in **sorted filename order** against the target branch (see repository runbooks for production vs preview automation).

---

## CI and preview databases

The open repository’s GitHub Actions workflows can **create or reuse Neon preview branches** for pull requests, run the same migration script against a preview connection string, then tear down or expire branches. That pattern reduces “works on my machine” risk for schema changes. Configure **`NEON_API_KEY`** and **`NEON_PROJECT_ID`** (and related variables) only in GitHub Actions secrets and variables—not in git.

**Cost control:** Preview branches may also be created by a **Neon ↔ Vercel Marketplace integration** (Neon shows `creation_source: vercel`); that is **not** configured in this repo’s `vercel.json`. There is typically **no** “disable branching only” toggle—Neon’s docs compare [managed integrations](https://neon.com/docs/guides/vercel-overview) (preview branching on) vs a **[manual Vercel connection](https://neon.com/docs/guides/vercel-manual)** (no auto branches). **Dependabot PR previews do not need Neon** for Keys: disconnect the integration and use manual env vars, or keep the integration and rely on retention + [prune/cleanup](https://neon.com/docs/guides/vercel-branch-cleanup). Maintainer detail: [dashboard-postgres-migrations.md](../runbooks/dashboard-postgres-migrations.md) (*Neon compute: preview branches and cost*).

---

## Ingestion, knowledge graphs, and Restormel Graph

Example products (such as the open **[SOPHIA](https://github.com/Allotment-Technology-Ltd/sophia)** application) use **Neon Postgres** as a **durable spine** for long-running **ingestion**: orchestration rows, staging, checkpoints, document tables, and worker coordination. A **graph-native database** (for example **SurrealDB**) may hold the **knowledge graph** used for retrieval and exploration; Neon remains valuable for **everything that must survive restarts and scale horizontally** before or alongside that graph layer.

For **graph rendering and integrator contracts**, Restormel publishes **`@restormel/graph-core`** and **`@restormel/ui-graph-svelte`** from this monorepo. If you build on SvelteKit, start from the public integrator guide: [https://restormel.dev/graph/docs/integration/sveltekit](https://restormel.dev/graph/docs/integration/sveltekit).

---

## Optional: Postgres for Restormel Testing run persistence

If you operate the **Testing runs** HTTP API with durable job storage, use a Postgres URL (often the same Neon project or a dedicated branch/database) and apply the **run-jobs** migration set described in the repository’s Testing runs server documentation. Prefer a **separate** env var for runs if you want isolation from the dashboard database.

---

## Related (repo)

- Dashboard env and Vercel-oriented notes: `docs/archive/reference/extraction-vercel.md`
- Production migration runbook: `docs/runbooks/dashboard-postgres-migrations.md`
- Default stack (includes Neon): `docs/architecture/restormel-module-default-stack.md`
- Keys + Testing onboarding: `docs/guides/keys-testing-onboarding.md`
