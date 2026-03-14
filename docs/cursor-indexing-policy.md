# Cursor indexing and context policy

Minimal policy so Cursor stays aligned with the bootstrap plan and companion prompts without wasting context or credits.

## Governing context

- **Controlling plan:** [docs/bootstrap-plan.md](bootstrap-plan.md) — Phase 00 operating plan.
- **Execution companion:** [docs/Reference/bootstrap_prompts.md](Reference/bootstrap_prompts.md) — use alongside the plan for bootstrap execution.

Cursor should treat the plan as source of truth and the prompts doc as the execution companion. Do not treat prompt packs as canonical without governance.

## What is indexed (high value)

Root docs, canonical docs/ (bootstrap-plan, working-agreement, security, threat-model, reliability, testing, release-readiness, prompt-governance, prompts-reference, skills, subagents, runbooks, bootstrap-checklist), .cursor/rules/, skills/*/SKILL.md, subagents/*.md, scripts/*.sh, and .github templates. These define scope, architecture, security, reliability, testing, prompt governance, and bootstrap completion.

## What is excluded (.cursorignore)

Build/deps (node_modules, dist, build), .env, OS junk, logs/temp; duplicate **docs/bootstrap_plan.md**; **docs/Archive/**; Phase 1–4 prompt packs (07–10) so default context stays Phase 00–focused. Add those files explicitly with @ when working on a later phase.

## Cursor Docs (add manually)

Add as Cursor Docs for persistent guidance: **docs/bootstrap-plan.md** and **docs/Reference/bootstrap_prompts.md**. Optionally root **README.md**, **STATUS.md**, **docs/working-agreement.md**.

## Maintenance

Keep .cursorignore in sync with .gitignore for build/deps/env. When adding new reference or archive material, consider whether it should be excluded to reduce noise.
