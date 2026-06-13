#!/usr/bin/env bash
# Check required canonical docs exist and basic doc structure is coherent.
# Exit 0 if all required files present; exit 1 with actionable messages otherwise.
# Aligns to docs/bootstrap-plan.md Phase 00 canonical docs.
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MISSING=0

required_root="README.md ROADMAP.md STATUS.md CHANGELOG.md CONTRIBUTING.md ARCHITECTURE.md"
required_docs="docs/bootstrap-plan.md docs/bootstrap-checklist.md docs/governance/working-agreement.md docs/governance/security-baseline.md docs/governance/threat-model-starter.md docs/governance/reliability-standards.md docs/governance/testing-strategy.md docs/governance/release-readiness.md docs/governance/prompts-reference.md docs/governance/prompt-governance.md docs/governance/skills.md docs/governance/subagents.md docs/runbooks/README.md"
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
  if [ -f "$ROOT/scripts/routing-doc-drift-check.sh" ]; then
    bash "$ROOT/scripts/routing-doc-drift-check.sh"
  fi
  echo "Docs review OK"
  exit 0
else
  echo "Fix the missing items above, then re-run this script."
  exit 1
fi
