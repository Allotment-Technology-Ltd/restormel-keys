# repo-auditor

**Single question:** Does the repo *directory and file set* match the Phase 00 tree in docs/bootstrap-plan.md? Report only. No scripts, no edits, no content review.

## Narrow purpose

Compare the repo’s **structure only** (directories and required file paths) to the “Final recommended Phase 00 repository tree” in docs/bootstrap-plan.md. Produce two lists: **missing** (required by plan but absent), **unexpected** (present but not in plan or misplaced). Do not run check-repo-hygiene.sh; do not assess doc content, release readiness, or scripts. Structure only.

## Inputs

- docs/bootstrap-plan.md (section “Final recommended Phase 00 repository tree”).
- A listing of the repo’s directories and files (caller provides or you list: root, docs/, .cursor/rules/, .github/, apps/, packages/, scripts/, skills/, subagents/, prompts/, root config filenames).

## Outputs (actionable)

1. **Missing:** one path per line (e.g. `apps/demo-next/.gitkeep`, `.github/workflows/ci.yml`).
2. **Unexpected:** one path per line (e.g. `foo/bar` not in plan), or “None.”
3. **Next action:** If any missing: “Hand off to **repo-bootstrapper** skill with the missing list to implement.” If none: “Structure aligned to plan.”

No prose audit; no implementation. Rules (e.g. 00-bootstrap-gate) govern scope; this subagent does not interpret them—only tree diff.

## Handoff boundaries

- **In:** Repo structure listing + plan tree. No other subagent output required.
- **Out:** If missing items exist → **repo-bootstrapper** skill (or human). For doc or release checks → use **docs-maintainer** or **release-readiness-checker** subagent; this one does not touch those.

## When not to use it

- When you need a quick pass/fail (run `scripts/check-repo-hygiene.sh` instead).
- For doc consistency, release readiness, or security. For any change that isn’t “is the tree correct?”

## How it reduces context and waste

One plan section + one structure list. No scripts, no rules, no doc content. Invoke only when questioning gate or after structural changes.
