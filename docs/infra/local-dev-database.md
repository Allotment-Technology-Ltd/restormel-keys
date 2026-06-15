---
title: Local dev database (persistent Postgres for pnpm dev)
class: technical
owner: founder
status: approved
classification: internal
control-tier: 1
created: 2026-06-14
last-reviewed: 2026-06-14
review-interval: P12M
---

# Local dev database (persistent Postgres for `pnpm dev`)

A throwaway-but-**persistent** local Postgres for dashboard development on localhost, so you set
up once and reuse it every session — no Neon, no reconfiguration each time.

## TL;DR

```bash
cd apps/dashboard
pnpm dev:local      # starts Postgres (if not running) → applies migrations → starts dev
```

That's it, every session. Data lives in a Docker named volume (`restormel_dev_pgdata`), so your
signed-in user, sessions, and seeded catalogue all **survive restarts and reboots**.

## What it is

- `deploy/docker-compose.dev.yml` — Postgres 16, persistent named volume, healthcheck.
- `.env.local` (gitignored, per-developer) points `DATABASE_URL` at it and runs auth in-process
  via Better Auth (`AUTH_PROVIDER=self`) — so localhost does **not** depend on Neon Auth (which
  rate-limits) or any cloud DB.

Schema is 100% vanilla-Postgres-portable (verified in `p3-self-hosted-postgres-runbook.md`).

## Commands (from `apps/dashboard`)

| Command | Does |
|---|---|
| `pnpm dev:local` | up → migrate → dev (the everyday command) |
| `pnpm db:up` | start Postgres and wait until healthy (idempotent) |
| `pnpm migrate` | apply pending migrations (tracked in `schema_migrations`) |
| `pnpm db:down` | stop the container (data is kept) |
| `pnpm db:reset` | **wipe** the volume and rebuild from scratch + migrate |
| `pnpm db:logs` | tail Postgres logs |

## First-time `.env.local` (developer-local, not committed)

```
DATABASE_URL=postgres://restormel:restormel@localhost:5432/restormel_dev?sslmode=disable
AUTH_PROVIDER=self
BETTER_AUTH_URL=http://localhost:5173
GITHUB_CLIENT_ID=<your dev GitHub OAuth app>
GITHUB_CLIENT_SECRET=<your dev GitHub OAuth app>
BETTER_AUTH_SECRET=<openssl rand -base64 32>
```

GitHub OAuth (self path): create a **dev** GitHub OAuth app with callback
`http://localhost:5173/keys/dashboard/api/auth/callback/github` and use its client id/secret
(the prod app's single callback can't cover localhost).

## Notes

- **Auth on `self`** uses Better Auth tables (migrations `002` + `067`) — applied automatically by
  `pnpm migrate`. Sign in with GitHub; the user row persists in the volume.
- **Switching back to Neon:** set `DATABASE_URL` back to the Neon branch and unset
  `AUTH_PROVIDER` (defaults to `neon`). Your old `.env.local` is backed up as `.env.local.bak`.
- **Reset clean state:** `pnpm db:reset` (drops the volume; you'll re-sign-in, catalogue re-syncs).
- This is for **local dev only**. Prod/staging use the self-hosted box Postgres (`restormel_ops`)
  per the P3 runbook; per-PR preview databases are a separate, still-open decision.
