#!/usr/bin/env bash
# Print a short checklist of docs that should be reviewed after repo/process changes.
# Informational only; always exit 0. Run after structural or process changes.
# Aligns to docs/bootstrap-plan.md doc governance.
echo "After repo or process changes, consider updating:"
echo "  - STATUS.md (current state, next actions)"
echo "  - ROADMAP.md (milestones, next steps)"
echo "  - CHANGELOG.md (meaningful changes)"
echo "  - ARCHITECTURE.md (if structure or decisions changed)"
echo "  - docs/governance/security-baseline.md (if security posture changed)"
echo "  - docs/governance/release-readiness.md (if gate or readiness changed)"
echo "  - The canonical doc under docs/ that owns the changed topic"
echo ""
echo "Use the docs-maintainer skill to apply updates; use docs-maintainer subagent to review consistency."
