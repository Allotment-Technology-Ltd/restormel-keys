# Release Readiness

Phase and release gate expectations. **Single source** for “when can we move?” Checklist content in [bootstrap-checklist.md](bootstrap-checklist.md).

**Phase 00 → Phase 01:** May begin when bootstrap-checklist is satisfied, root and docs/ are coherent, rules/skills/subagents/scripts/workflows exist per [bootstrap-plan.md](bootstrap-plan.md), baselines are documented, no product logic added, and release-readiness-checker (or equivalent) has been run and approved.

**Approval:** Gate lift is manual. **Gate lifted:** Phase 00 complete; Phase 01 implementation may begin. No provider, routing, billing, or hosted logic was added during Phase 00.

**Later releases:** Run readiness audit against required docs, scaffolding, scripts, workflows. Use release-prep skill and release-readiness-checker as needed.
