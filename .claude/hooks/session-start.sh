#!/usr/bin/env bash
# SessionStart hook — prepares a fresh web/CI container so a review agent can run the
# Connect ingestion review immediately, without spending model budget on environment setup.
#
# Idempotent and fast: installs workspace deps only when missing, then emits orientation
# (stdout becomes session context). Never fails the session — exits 0 even if install fails,
# so the agent still starts (it will just see the note and can install manually).
set -u

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$repo_root" || exit 0

if ! command -v pnpm >/dev/null 2>&1; then
  echo "[session-start] pnpm not found on PATH — install it, then 'pnpm install'." >&2
else
  if [ ! -d node_modules ]; then
    echo "[session-start] node_modules missing — installing workspace deps (pnpm install)…" >&2
    pnpm install --frozen-lockfile >&2 2>&1 || pnpm install >&2 2>&1 || \
      echo "[session-start] pnpm install failed — run it manually before the review." >&2
  fi
  # connect-core's typecheck/test need these workspace deps built (dist/*.d.ts). The repro
  # runs under tsx without them; build them so 'typecheck'/'test' work without the agent
  # discovering the chain. Skip if connect-core is already built. Quiet + non-fatal.
  if [ ! -d packages/connect-core/dist ]; then
    echo "[session-start] building connect-core deps (contracts, aaif, keys)…" >&2
    pnpm --filter @restormel/contracts --filter @restormel/aaif --filter @restormel/keys run build >&2 2>&1 \
      && pnpm --filter @restormel/connect-core run build >&2 2>&1 \
      || echo "[session-start] prerequisite build failed — run 'pnpm run build:platform-packages' manually." >&2
  fi
fi

# stdout → added to the agent's context.
cat <<'CONTEXT'
Connect review environment is ready. Entry points (docs/reviews/):

  connect-ingest-context.md         — ingestion reviewer context pack (read first)
  connect-ingest-review-prompts.md  — sweep + bounded-fix prompts (ingestion)
  connect-ingest-failopen-fix.md    — ready-to-run fix prompt for the C1–C3 fail-open cluster
  connect-wizard-ux-review.md       — UX/UI review kit for the setup wizard

Ingestion review (no LLM keys needed for the repro):
  pnpm exec tsx scripts/reviews/connect-ingest-failopen-repro.ts
  pnpm --filter @restormel/connect-core typecheck
  pnpm --filter @restormel/connect-core test

Wizard UX review:
  pnpm --filter dashboard run check     # static svelte-check (builds deps via precheck; slow)
  pnpm --filter dashboard run dev       # rendered, best-effort (needs backend/auth for populated state)

Scope: ingestion = packages/connect-core/src/{ingest,stages,kg-audit}/**
       wizard UX  = apps/dashboard/src/lib/components/connect/pipeline/**
CONTEXT

exit 0
