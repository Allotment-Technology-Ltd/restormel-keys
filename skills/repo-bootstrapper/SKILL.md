# repo-bootstrapper

Create or align the Phase 00 scaffold against docs/archive/2026-03-build-pack/bootstrap-plan.md.

## Purpose

Bring the repo to the agreed Phase 00 structure (root docs, docs/ canonical set, .cursor/rules, scripts, skills, subagents, .github, apps/packages/prompts placeholders) without adding product logic.

## When to use

- Initial bootstrap of Restormel Keys or a similar repo.
- Bringing an existing repo in line with the Phase 00 plan after drift.

## Inputs

- docs/archive/2026-03-build-pack/bootstrap-plan.md as controlling plan.
- Current repo state (inspect before proposing).

## Workflow

1. Read docs/archive/2026-03-build-pack/bootstrap-plan.md (target tree and Phase 00 objectives).
2. Inspect current repo: list root, docs/, .cursor/, .github/, apps/, packages/, scripts/, skills/, subagents/, prompts/, config files.
3. Diff current vs target: missing dirs/files, duplicates, misplaced items.
4. Propose minimal set of creates/edits (no product logic).
5. Implement scaffolding only: create missing files/dirs, fix obvious misplacement; output list of created/updated files, assumptions, open questions.

## Outputs

- List of files/dirs created and updated.
- Assumptions made.
- Open questions and blockers before Phase 01.

## Done criteria

- Repo structure matches plan’s Phase 00 tree as far as implemented; no provider/billing/hosted logic added; scripts and docs referenced in the plan exist.

## How it saves credits or reduces mistakes

- Single pass with a clear checklist instead of repeated “what’s missing?” reasoning. Avoids scope creep into product logic by tying every step to the plan.
