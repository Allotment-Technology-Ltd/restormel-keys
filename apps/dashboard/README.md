# Keys dashboard

SvelteKit 2 + Svelte 5 **single app** for Restormel Keys: Keys landing, docs, walkthrough, and authenticated dashboard. **Neon Auth** (GitHub OAuth, proxied at `/api/auth/*`) and **Neon Postgres** (workspaces, projects, environments, Gateway keys, provider integrations, models, routes, policies, request logs). Run migrations 001–020 as needed (011 seeds full model catalog; 013 adds route version history; 014/015 add provenance + policy version events + coverage indexes; 016 backfills provenance defaults; **020** project model index bindings). Base path `/keys`.

**Product surface:** `/keys` (landing), `/keys/pricing`, `/keys/docs` (including integration walkthrough Phase 0–6 with optional **agent prompts** per phase; `RESTORMEL_DOCS_AGENT_PROMPTS=false` hides them site-wide), `/keys/dashboard` (authenticated app). One **SiteHeader** and **SiteFooter** site-wide (API portal + account live in the header only; the dashboard inner topbar is collapse + section title). Docs and dashboard side navs are **collapsible** (state in localStorage). Max-width container `--rm-container-max` (72rem) used across docs and dashboard shells.

## Commands

- `pnpm dev` — dev server (open http://localhost:5173/keys/dashboard)
- `pnpm build` — build for Node (adapter-node)
- `pnpm preview` — preview production build
- `pnpm run seed:catalog` — ingest model catalog from `data/model-catalog-seed.json` (requires DATABASE_URL)
- `pnpm run seed:catalog:from-keys` — derive model catalog from `@restormel/keys` provider adapters (requires DATABASE_URL)

## Routes (match sidebar)

- `/keys/dashboard` — **Overview** (project list; onboarding checklist when no project/keys/integrations)
- `/keys/dashboard/projects` — List + create project
- `/keys/dashboard/projects/[id]` — Project detail (environments, usage placeholder)
- `/keys/dashboard/projects/[id]/routes` — Routes for project
- `/keys/dashboard/projects/[id]/routes/[routeId]` — Route detail (steps, default model, lifecycle warnings)
- `/keys/dashboard/access` — **Access**: list/create/revoke Gateway Keys (across projects)
- `/keys/dashboard/integrations` — **Provider Integrations**: connect OpenAI, Anthropic, Google, etc.
- `/keys/dashboard/models` — **Models**: catalog (lifecycle, variants)
- `/keys/dashboard/routes` — **Routes**: list routes across projects
- `/keys/dashboard/policies` — **Policies**: list/create policies
- `/keys/docs/guides/canonical-catalog` — **Canonical catalog guide**: public integration steps for provider/model feed (`GET /keys/dashboard/api/catalog`)
- `/keys/dashboard/analytics` — **Analytics**: request count, latency, error rate, provider/model/route mix, spend placeholder
- `/keys/dashboard/logs` — **Logs & Traces**: request logs (filter by project/route)
- `/keys/dashboard/lifecycle` — **Lifecycle & Migrations**: placeholder and migration guidance
- `/keys/dashboard/billing` — **Billing & Forecasting**: placeholder
- `/keys/dashboard/settings` — Account (user id, email)
- `/keys/dashboard/login` — Sign in with GitHub
- `/keys/dashboard/logout` — Clear session, redirect to login

## API

- `GET/POST /keys/dashboard/api/projects` — List, create
- `GET/PATCH/DELETE /keys/dashboard/api/projects/[id]` — Project CRUD
- `GET/POST/DELETE /keys/dashboard/api/projects/[id]/keys` — Gateway keys
- `GET /keys/dashboard/api/request-logs` — Request logs (workspace-scoped)
- `GET /keys/dashboard/api/usage-aggregates` — Usage aggregates or on-the-fly from request_logs
- `GET/POST /keys/dashboard/api/auth/*` — Neon Auth proxy (sign-in, callback, sign-out)
- `GET /keys/dashboard/api/health` — Health check

## Environment (no secrets in repo)

- **DATABASE_URL** — Neon Postgres connection string
- **NEON_AUTH_BASE_URL** — Neon Auth URL from Neon Console (Project → Branch → Auth → Configuration). GitHub OAuth is configured in Neon Console, not in app env.

### Dashboard UI feature flags (optional)

Set **`RESTORMEL_DASHBOARD_UI_HIDDEN`** to a comma-separated list of sections to **hide from the dashboard UI** only (sidebar, onboarding quick links, setup checklist links, project context switcher when `projects` is listed). Signed-in users who open a hidden URL are redirected to Overview with a short notice. **REST API routes and CLI behaviour are unchanged** — use them for full control when the UI is simplified.

Allowed tokens: `policies`, `routes`, `models`, `providers` (Integrations), `analytics`, `logs`, `healthcheck`, `sandbox`, `copy-for-ci`, `dev-tools`, `billing`, `projects`. The **Lifecycle** pages are grouped with **`models`** for hiding. Project route editors (`/projects/.../routes`) are grouped with **`routes`**.

Example (minimal in-browser surface: overview + Access + Profile only):

`RESTORMEL_DASHBOARD_UI_HIDDEN=policies,routes,models,providers,analytics,logs,healthcheck,sandbox,copy-for-ci,dev-tools,billing`

**Caution:** including **`projects`** hides the project switcher and blocks project pages in the UI; use only when operators rely on the API for project lifecycle.

Unset or empty **RESTORMEL_DASHBOARD_UI_HIDDEN** = full dashboard (default).

Run migrations in `migrations/` (001 through `021_project_model_bindings_kind.sql` as needed) against the Neon database.

## Terminology

- **Gateway Key** — Credential your app uses to authenticate to Restormel (format `rk_...`). Created under Access.
- **Provider credential** — Your OpenAI/Anthropic/Google etc. key. In v1, prefer gateway-backed access (OpenRouter/Vercel AI Gateway/Portkey) or keep provider keys in your own env/secret manager; Restormel stays the control layer.
