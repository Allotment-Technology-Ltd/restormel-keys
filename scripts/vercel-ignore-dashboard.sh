#!/usr/bin/env bash
# Vercel "Ignored Build Step": exit 0 = skip build (no deploy); exit 1 = run build.
# Watches paths that affect root `pnpm install` and `pnpm --filter dashboard build`
# (see apps/dashboard prebuild: keys-tokens, keys, keys-svelte).
#
# https://vercel.com/docs/project-configuration/vercel-json#ignorecommand

set -euo pipefail

PATHS=(
  apps/dashboard
  packages/keys-tokens
  packages/core
  packages/svelte
  scripts/vercel-copy-build-output.mjs
  vercel.json
  package.json
  pnpm-lock.yaml
  pnpm-workspace.yaml
)

current="${VERCEL_GIT_COMMIT_SHA:-}"
if [[ -z "$current" ]]; then
  current="HEAD"
fi

# Redeploy / promote same SHA: never skip (env-only or explicit redeploy must still build).
prev="${VERCEL_GIT_PREVIOUS_SHA:-}"
if [[ -n "$prev" && -n "${VERCEL_GIT_COMMIT_SHA:-}" && "$prev" == "$VERCEL_GIT_COMMIT_SHA" ]]; then
  exit 1
fi

base=""
if [[ -n "$prev" ]] && git rev-parse --verify "${prev}^{commit}" >/dev/null 2>&1; then
  base="$prev"
elif git rev-parse --verify HEAD^ >/dev/null 2>&1; then
  base="HEAD^"
else
  exit 1
fi

if ! git rev-parse --verify "${current}^{commit}" >/dev/null 2>&1; then
  exit 1
fi

if git diff --quiet "$base" "$current" -- "${PATHS[@]}"; then
  exit 0
fi

exit 1
