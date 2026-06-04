#!/usr/bin/env bash
# Vercel "Ignored Build Step": exit 0 = skip build (no deploy); exit 1 = run build.
# Watches paths that affect root `pnpm install` and `pnpm --filter dashboard build`
# (see apps/dashboard prebuild / precheck workspace package graph).
#
# https://vercel.com/docs/project-configuration/vercel-json#ignorecommand

set -euo pipefail

log() {
  echo "[vercel-ignore-dashboard] $*" >&2
}

# Ignore step may run with Root Directory = apps/dashboard; git paths are repo-relative.
cd "$(git rev-parse --show-toplevel)"

PATHS=(
  apps/dashboard
  packages
  scripts/vercel-copy-build-output.mjs
  scripts/vercel-ignore-dashboard.sh
  vercel.json
  apps/dashboard/vercel.json
  package.json
  pnpm-lock.yaml
  pnpm-workspace.yaml
)

# PR / preview deployments should always build so reviewers get a fresh URL.
if [[ "${VERCEL_ENV:-}" == "preview" ]] || [[ -n "${VERCEL_GIT_PULL_REQUEST_ID:-}" ]]; then
  log "preview/PR deployment — build"
  exit 1
fi

current="${VERCEL_GIT_COMMIT_SHA:-}"
if [[ -z "$current" ]]; then
  current="HEAD"
fi

# Redeploy / promote same SHA: never skip (env-only or explicit redeploy must still build).
prev="${VERCEL_GIT_PREVIOUS_SHA:-}"
if [[ -n "$prev" && -n "${VERCEL_GIT_COMMIT_SHA:-}" && "$prev" == "$VERCEL_GIT_COMMIT_SHA" ]]; then
  log "same SHA redeploy — build"
  exit 1
fi

base=""
if [[ -n "$prev" ]] && git rev-parse --verify "${prev}^{commit}" >/dev/null 2>&1; then
  base="$prev"
elif git rev-parse --verify HEAD^ >/dev/null 2>&1; then
  base="HEAD^"
else
  log "no diff base — build"
  exit 1
fi

if ! git rev-parse --verify "${current}^{commit}" >/dev/null 2>&1; then
  log "current SHA unavailable — build"
  exit 1
fi

if git diff --quiet "$base" "$current" -- "${PATHS[@]}"; then
  log "no dashboard-relevant changes ($base..$current) — skip"
  exit 0
fi

log "dashboard-relevant changes ($base..$current) — build"
exit 1
