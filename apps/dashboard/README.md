# Keys dashboard

SvelteKit 2 + Svelte 5 **single app** for Restormel Keys: Keys landing, docs, walkthrough, and authenticated dashboard. **Neon Auth** (GitHub OAuth, proxied at `/api/auth/*`) and **Neon Postgres** (workspaces, projects, environments, Gateway keys, provider integrations, models, routes, policies, request logs). Run migrations 001–005 as needed. Base path `/keys`.

**Product surface:** `/keys` (landing), `/keys/pricing`, `/keys/docs` (including integration walkthrough Phase 0–6 with optional **agent prompts** per phase; `RESTORMEL_DOCS_AGENT_PROMPTS=false` hides them site-wide), `/keys/dashboard` (authenticated app). One **SiteHeader** and **SiteFooter** site-wide; GitHub in footer. Docs and dashboard side navs are **collapsible** (state in localStorage). Max-width container `--rm-container-max` (72rem) used across docs and dashboard shells.

## Commands

- `pnpm dev` — dev server (open http://localhost:5173/keys/dashboard)
- `pnpm build` — build for Node (adapter-node)
- `pnpm preview` — preview production build
- `pnpm run seed:catalog` — ingest model catalog from `data/model-catalog-seed.json` (requires DATABASE_URL)

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

Run migrations in `migrations/` (001_initial.sql through 005_seed_model_catalog.sql as needed) against the Neon database.

## Terminology

- **Gateway Key** — Credential your app uses to authenticate to Restormel (format `rk_...`). Created under Access.
- **Provider credential** — Your OpenAI/Anthropic/Google etc. key. In v1, prefer gateway-backed access (OpenRouter/Vercel AI Gateway/Portkey) or keep provider keys in your own env/secret manager; Restormel stays the control layer.
