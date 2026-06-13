# Subagents

Subagent inventory and boundaries. **Single source** for the Phase 00 set; definitions in `subagents/<name>.md`. Plan: [bootstrap-plan.md](archive/2026-03-build-pack/bootstrap-plan.md).

| Subagent | Purpose |
|----------|---------|
| repo-auditor | Compare repo structure to plan; report drift/missing |
| docs-maintainer | Review docs consistency; duplicate truth, missing updates |
| security-reviewer | Narrow review on sensitive files/flows |
| test-designer | Recommend minimum verification for a change |
| prompt-librarian | Classify prompts; recommend governance actions |
| release-readiness-checker | Assess Phase 00 or release gate completion |

**Use when:** Specialist pass is clear and reduces context. Not for routine file creation or obvious doc edits.

**Location:** `subagents/<name>.md`.
