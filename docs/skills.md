# Skills

Skill inventory and when to use. **Single source** for the Phase 00 set; full definitions in `skills/<name>/SKILL.md`. Plan: [bootstrap-plan.md](archive/2026-03-build-pack/bootstrap-plan.md).

| Skill | Use when |
|-------|----------|
| skill-installer | Install curated skills or from GitHub ($CODEX_HOME/skills) |
| repo-bootstrapper | Create or align Phase 00 scaffold |
| docs-maintainer | Doc updates after process/structure changes |
| roadmap-status-sync | ROADMAP and STATUS need syncing |
| changelog-updater | Meaningful repo change; update CHANGELOG |
| prompt-librarian | Inventory/classify prompts; recommend promotions |
| security-review | Legacy name; use **restormel-high-risk-security** (`.cursor/skills/`) + [pre-pr-security-review.md](guides/pre-pr-security-review.md) before PRs |
| architecture-recorder | Record architecture or governance decisions |
| release-prep | Before Phase 01 or release; readiness audit |
| content-writing | Marketing/landing copy; align with brand voice and marketing best practice |

**Location:** `skills/<name>/`. Invoke by name; prefer over ad-hoc multi-step prompts.
