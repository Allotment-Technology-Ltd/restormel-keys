#!/usr/bin/env bash
set -euo pipefail

# Apply dashboard SQL migrations in order.
# Intended for CI/CD on merge to main (idempotent via IF EXISTS / IF NOT EXISTS where possible).
#
# Requires:
# - DATABASE_URL env var (Neon Postgres connection string)
# - psql installed (postgresql-client)

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL is not set"
  exit 1
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MIGRATIONS_DIR="$ROOT_DIR/apps/dashboard/migrations"

if [[ ! -d "$MIGRATIONS_DIR" ]]; then
  echo "Migrations dir not found: $MIGRATIONS_DIR"
  exit 1
fi

echo "Applying dashboard migrations from: $MIGRATIONS_DIR"

# Ensure predictable ordering (001_..., 002_..., etc).
mapfile -t files < <(ls -1 "$MIGRATIONS_DIR"/*.sql | sort)
if [[ "${#files[@]}" -eq 0 ]]; then
  echo "No migration files found"
  exit 1
fi

for f in "${files[@]}"; do
  base="$(basename "$f")"
  echo "==> $base"
  # ON_ERROR_STOP ensures CI fails on any SQL error.
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$f" >/dev/null
done

echo "All dashboard migrations applied successfully."

