#!/usr/bin/env bash
# Check required canonical docs exist and basic doc structure is coherent.
# Exit 0 if all required files present; exit 1 with actionable messages otherwise.
# Aligns to docs/bootstrap-plan.md Phase 00 canonical docs.
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MISSING=0

required_root="README.md ROADMAP.md STATUS.md CHANGELOG.md CONTRIBUTING.md ARCHITECTURE.md"
required_docs="docs/bootstrap-plan.md docs/bootstrap-checklist.md docs/working-agreement.md docs/security-baseline.md docs/threat-model-starter.md docs/reliability-standards.md docs/testing-strategy.md docs/release-readiness.md docs/prompts-reference.md docs/prompt-governance.md docs/skills.md docs/subagents.md docs/runbooks.md"
required_extra="docs/decisions/README.md docs/archive/README.md"

for f in $required_root; do
  if [ ! -f "$ROOT/$f" ]; then
    echo "Missing root doc: $f — add it at repo root."
    MISSING=1
  fi
done
for f in $required_docs; do
  if [ ! -f "$ROOT/$f" ]; then
    echo "Missing doc: $f — add under docs/ (see docs/bootstrap-plan.md)."
    MISSING=1
  fi
done
for f in $required_extra; do
  if [ ! -f "$ROOT/$f" ]; then
    echo "Missing: $f — create the file (see docs/bootstrap-plan.md)."
    MISSING=1
  fi
done

if [ "$MISSING" -eq 0 ]; then
  echo "Docs review OK"
  exit 0
else
  echo "Fix the missing items above, then re-run this script."
  exit 1
fi
