# Keys dashboard

SvelteKit 2 + Svelte 5 **single app** for Restormel Keys: Keys landing, docs, walkthrough, and authenticated dashboard. **Neon Auth** (GitHub OAuth, proxied at `/api/auth/*`) and **Neon Postgres** (workspaces, projects, environments, Gateway keys, provider integrations, models, routes, policies, request logs). Run migrations 001–029 as needed (011 seeds full model catalog; 013 adds route version history; 014/015 add provenance + policy version events + coverage indexes; 016 backfills provenance defaults; **020** project model index bindings; **022** CLI device sessions; **023** service operator allowlist; **028** app `users` mirror for `upsertUser`; **029** workspace outbound webhooks). Base path `/keys`.

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
- `/keys/dashboard/integrations` — **Connections**: connect providers; optional **hosted API key** (encrypted at rest) or vault **credential reference**
- `/keys/dashboard/testing` — **Restormel Testing**: project/environment IDs, Gateway key reminder, copy-ready `RESTORMEL_*` snippets ([keys-testing-onboarding.md](../../docs/keys-testing-onboarding.md))
- `/keys/dashboard/models` — **Models**: catalog (lifecycle, variants)
- `/keys/dashboard/routes` — **Routes**: list routes across projects
- `/keys/dashboard/policies` — **Policies**: list/create policies
- `/keys/docs/guides/canonical-catalog` — **Canonical catalog guide**: public integration steps for provider/model feed (`GET /keys/dashboard/api/catalog`)
- `/keys/dashboard/analytics` — **Analytics**: request count, latency, error rate, provider/model/route mix, spend placeholder
- `/keys/dashboard/logs` — **Logs & Traces**: request logs (filter by project/route)
- `/keys/dashboard/lifecycle` — **Lifecycle & Migrations**: placeholder and migration guidance
- `/keys/dashboard/billing` — **Billing & Forecasting**: placeholder
- `/keys/dashboard/settings` — Account (user id, email); **User management** link for service owners
- `/keys/dashboard/admin/users` — **User management** (service owners): list registered users, toggle `service_admins`
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
- `POST /keys/dashboard/api/support-chat` — **Restormel Support** (session-only JSON `{ "messages": [{ "role": "user"|"assistant", "content": "…" }] }`; streams `text/plain`). See [docs/restormel/RESTORMEL-SUPPORT.md](../../docs/restormel/RESTORMEL-SUPPORT.md).
- `GET /keys/dashboard/api/admin/users` — List registered users (**session + service owner**).
- `PATCH /keys/dashboard/api/admin/users/[userId]` — Set `service_admins` membership: `{ "serviceOwner": boolean }` (**session + service owner**).

## Environment (no secrets in repo)

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | Neon Postgres connection string |
| `NEON_AUTH_BASE_URL` | Yes | Neon Auth URL from Neon Console (Project → Branch → Auth → Configuration). GitHub OAuth is configured in Neon Console, not in app env. |
| `FEEDBACK_GITHUB_TOKEN` | Optional | GitHub PAT with `issues:write` for feedback issue creation from `/keys/dashboard/api/feedback`. If unset, feedback is logged locally and API still returns `200`. |
| `FEEDBACK_GITHUB_REPO` | Optional | Target repo in `owner/repo` format for issue creation. Defaults to `Allotment-Technology-Ltd/restormel-keys`. |
| `RESTORMEL_SERVICE_ADMIN_USER_IDS` | Optional | Comma-separated Better Auth user IDs for **service operators**: subscription-style limits and Pro UI gates waived. See [docs/runbooks/service-admin-operators.md](../../docs/runbooks/service-admin-operators.md). Also supports Neon Auth `user.role` (`admin`, `operator`, …), **`RESTORMEL_SERVICE_OWNER_EMAILS`**, and `service_admins` table. |
| `RESTORMEL_SERVICE_OWNER_EMAILS` | Optional | Comma-separated sign-in emails treated as **service owners** (case-insensitive). When **unset**, built-in primary-operator defaults apply; set to empty to disable email-based grants. See runbook. |
| `RESTORMEL_CREDENTIALS_ENCRYPTION_KEY` | Optional | **Required** to store **hosted API keys** under Connections (32-byte key, base64-encoded). If unset, POST with `apiKey` returns **503** `server_misconfigured`. See [docs/security-baseline.md](../../docs/security-baseline.md). |
| `OPENAI_API_KEY` | Optional | **Required** for **Restormel Support** (`/keys/dashboard/api/support-chat`). If unset, support returns **503**. |
| `RESTORMEL_SUPPORT_ENABLED` | Optional | Set to `false` to disable Restormel Support (API **503**). |
| `RESTORMEL_SUPPORT_MODEL` | Optional | OpenAI model id for support (default `gpt-4o-mini`). |

### Public env (build-time)

| Variable | Description |
|----------|-------------|
| `PUBLIC_RESTORMEL_SUPPORT_UI` | Set to `false` to hide the Support FAB for signed-in users (default: show). |

### Dashboard UI feature flags (optional)

Set **`RESTORMEL_DASHBOARD_UI_HIDDEN`** to a comma-separated list of sections to **hide from the dashboard UI** only (sidebar, onboarding quick links, setup checklist links, project context switcher when `projects` is listed). Signed-in users who open a hidden URL are redirected to Overview with a short notice. **REST API routes and CLI behaviour are unchanged** — use them for full control when the UI is simplified.

Allowed tokens: `policies`, `routes`, `models`, `providers` (Integrations), `analytics`, `logs`, `healthcheck`, `sandbox`, `copy-for-ci`, `dev-tools`, `billing`, `projects`. The **Lifecycle** pages are grouped with **`models`** for hiding. Project route editors (`/projects/.../routes`) are grouped with **`routes`**.

Example (minimal in-browser surface: overview + Access + Profile only):

`RESTORMEL_DASHBOARD_UI_HIDDEN=policies,routes,models,providers,analytics,logs,healthcheck,sandbox,copy-for-ci,dev-tools,billing`

**Caution:** including **`projects`** hides the project switcher and blocks project pages in the UI; use only when operators rely on the API for project lifecycle.

Unset or empty **RESTORMEL_DASHBOARD_UI_HIDDEN** = full dashboard (default).

Run migrations in `migrations/` (001 through `029` as needed) against the Neon database. Provider credential encryption and Testing project flags: `024`–`026`; app user mirror: `028`; workspace webhooks: `029`.

## Terminology

- **Gateway Key** — Credential your app uses to authenticate to Restormel (format `rk_...`). Created under Access.
- **Provider credential** — Under **Connections**: optional **hosted API key** (encrypted at rest when `RESTORMEL_CREDENTIALS_ENCRYPTION_KEY` is set) or a **credential reference** (vault label only). Restormel Testing resolve can use decrypted material server-side; the CLI still uses a **Gateway key** as `RESTORMEL_GATEWAY_KEY` (alias `RESTORMEL_KEYS_API_TOKEN`). See [docs/keys-testing-onboarding.md](../../docs/keys-testing-onboarding.md).
