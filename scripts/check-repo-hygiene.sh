#!/usr/bin/env bash
# Check expected folders and files exist; report bootstrap drift.
# Exit 0 if structure matches Phase 00 plan; exit 1 with actionable messages.
# Aligns to docs/bootstrap-plan.md "Final recommended Phase 00 repository tree".
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MISSING=0

# Top-level dirs
for dir in .cursor/rules .github/workflows .github/ISSUE_TEMPLATE apps packages scripts Docs prompts skills subagents; do
  if [ ! -d "$ROOT/$dir" ]; then
    echo "Missing dir: $dir — create with: mkdir -p $dir"
    MISSING=1
  fi
done

# App and package placeholders
for dir in apps/dashboard apps/demo-next apps/site packages/core packages/svelte packages/elements packages/react packages/cli; do
  if [ ! -d "$ROOT/$dir" ]; then
    echo "Missing dir: $dir — create with: mkdir -p $dir && touch $dir/.gitkeep"
    MISSING=1
  fi
done

# Prompt classification dirs
for dir in prompts/canonical prompts/reference prompts/archive; do
  if [ ! -d "$ROOT/$dir" ]; then
    echo "Missing dir: $dir — create with: mkdir -p $dir"
    MISSING=1
  fi
done

# Root config (Phase 00)
for f in package.json pnpm-workspace.yaml; do
  if [ ! -f "$ROOT/$f" ]; then
    echo "Missing file: $f — add at repo root (see docs/bootstrap-plan.md)."
    MISSING=1
  fi
done

if [ "$MISSING" -eq 0 ]; then
  echo "Repo hygiene OK"
  exit 0
else
  echo "Fix the missing items above, then re-run this script."
  exit 1
fi
