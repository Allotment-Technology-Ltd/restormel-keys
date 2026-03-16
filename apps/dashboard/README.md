# Keys dashboard

SvelteKit 2 + Svelte 5 dashboard for Restormel Keys. **Neon Auth** (GitHub OAuth, proxied at `/api/auth/*`) and **Neon Postgres** (projects, API keys). Served at `/keys/dashboard` (base path).

## Commands

- `pnpm dev` — dev server (open http://localhost:5173/keys/dashboard)
- `pnpm build` — build for Node (adapter-node)
- `pnpm preview` — preview production build

## Routes

- `/keys/dashboard` — Overview (project list)
- `/keys/dashboard/projects` — List + create project
- `/keys/dashboard/projects/[id]` — Project detail, generate/revoke API keys
- `/keys/dashboard/projects/[id]/usage` — Placeholder (Phase 4)
- `/keys/dashboard/billing` — Placeholder (3.5)
- `/keys/dashboard/settings` — Account (user id, email)
- `/keys/dashboard/login` — Sign in with GitHub
- `/keys/dashboard/logout` — Clear session, redirect to login

## API

- `GET/POST /keys/dashboard/api/projects` — List, create
- `GET/PATCH/DELETE /keys/dashboard/api/projects/[id]` — Project CRUD
- `GET/POST/DELETE /keys/dashboard/api/projects/[id]/keys` — API keys
- `GET/POST /keys/dashboard/api/auth/*` — Neon Auth proxy (sign-in, callback, sign-out)
- `GET /keys/dashboard/api/health` — Health check

## Environment (no secrets in repo)

- **DATABASE_URL** — Neon Postgres connection string
- **NEON_AUTH_BASE_URL** — Neon Auth URL from Neon Console (Project → Branch → Auth → Configuration). GitHub OAuth is configured in Neon Console, not in app env.

Run migrations in `migrations/` (001_initial.sql; optionally 002_better_auth.sql if you had in-app Better Auth) once against the Neon database.

## Gate

Dashboard runs. Sign in with GitHub. Create project. Generate API key.
