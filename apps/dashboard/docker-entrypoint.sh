#!/bin/sh
# Dashboard container entrypoint (issue #18 — apply pending DB migrations on deploy).
#
# Root cause this fixes: a deploy ships code that expects schema migration NNN, but
# Coolify deploys do NOT run migrations — only the Forgejo CI step does, and that step
# targets the CI DB, never prod. So prod could sit one migration behind the code (e.g.
# 2026-06-15: code needed 068 while prod was at 067 → catalogue 503). This entrypoint
# closes that gap: every deploy applies pending migrations against the prod DATABASE_URL
# BEFORE the SvelteKit server starts.
#
# Fail-closed contract: if any migration errors, the runner exits non-zero, `set -e`
# aborts this script, and the container never reaches `exec node ...`. The process dies,
# Coolify's healthcheck (GET /healthz) never goes green, and the deploy is marked failed
# — so a half-migrated DB is NEVER served. A bad migration fails the deploy, it does not
# silently serve broken schema.
#
# Idempotent + ordered: the runner (apply-migrations.mts → migration-runner.ts) tracks
# applied files in schema_migrations and applies only pending ones, in numeric order,
# each in its own transaction. Running it on every container start is safe — already-applied
# migrations are skipped. This is a once-per-deploy step (entrypoint), not per request.
#
# CONCURRENCY CAVEAT (multi-replica): the runner does NOT take a Postgres advisory lock.
# If two dashboard replicas ever start concurrently they could both attempt the same
# pending migration. Each migration is atomic (transaction) and the schema_migrations
# insert is ON CONFLICT DO NOTHING, so the worst case is one replica's transaction failing
# on a duplicate object (e.g. CREATE TABLE without IF NOT EXISTS) and that replica exiting
# non-zero — fail-closed, not data corruption. The dashboard is deployed as a SINGLE
# container on Coolify today (no horizontal scaling), so this cannot occur. If/when the
# dashboard is scaled to >1 replica, gate this step behind a Postgres advisory lock
# (pg_advisory_lock) in the runner, or run migrations as a separate one-shot deploy job
# instead of in the per-replica entrypoint. See docs/runbooks/dashboard-postgres-migrations.md.
set -e

echo "[entrypoint] Applying pending dashboard DB migrations before server start..."

# Run the migration runner directly via tsx (same mechanism the ingest worker uses to run
# TypeScript at runtime — Dockerfile.worker). We invoke node --import tsx rather than
# `pnpm --filter dashboard run migrate` so container startup does not depend on resolving a
# pnpm process; tsx + the runner ship in the serve stage (full workspace + devDeps copied
# from the build stage). TSX_TSCONFIG_PATH lets tsx resolve the $lib / $env path aliases the
# runner's imports rely on (mirrors Dockerfile.worker).
TSX_TSCONFIG_PATH=/app/apps/dashboard/scripts/tsconfig.json \
  node --import tsx /app/apps/dashboard/scripts/apply-migrations.mts

echo "[entrypoint] Migrations applied (or already up to date). Starting server..."

# exec so node replaces this shell as PID 1 — docker stop's SIGTERM reaches node directly
# for clean shutdown (a wrapper shell would swallow it). "$@" is the image CMD.
exec "$@"
