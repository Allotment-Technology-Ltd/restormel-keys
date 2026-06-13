# release-prep

Run a readiness audit before Phase 01 or a meaningful release milestone.

## Purpose

Check that required docs, scaffolding, scripts, and workflows are in place and aligned with docs/archive/2026-03-build-pack/bootstrap-plan.md and docs/release-readiness.md so the gate to Phase 01 (or the release) is informed by evidence, not guesswork.

## When to use

- Before deciding to lift the Phase 00 bootstrap gate and start Phase 01.
- Before a first package publish, first deploy, or other meaningful release milestone.

## Inputs

- docs/archive/2026-03-build-pack/bootstrap-checklist.md and docs/release-readiness.md (acceptance criteria and gate definition).
- Current repo state: root docs, docs/, .cursor/rules, scripts/, skills/, subagents/, .github/, apps/packages placeholders.

## Workflow

1. Read docs/archive/2026-03-build-pack/bootstrap-checklist.md and docs/release-readiness.md.
2. For each checklist item: verify presence and coherence (e.g. required root docs exist, canonical docs/ set exists, rules/skills/subagents/scripts/workflows present, security/reliability/testing/release-readiness documented).
3. Run scripts as applicable: review-docs.sh, check-repo-hygiene.sh, check-secrets.sh, check-dependency-policy.sh.
4. Summarise: passed items, failed or missing items, and any blockers or open questions.
5. Do not lift the gate in this skill; only report readiness and blockers.

## Outputs

- Checklist status (per item: pass / fail / N/A) and a short summary.
- List of blockers or open questions before gate lift or release.
- Optional: recommendation (e.g. “ready for gate” or “address N items first”).

## Done criteria

- Every acceptance item has been checked; scripts have been run where applicable; summary and blockers are clear; no product logic has been added as part of this skill.

## How it saves credits or reduces mistakes

- One structured audit instead of ad-hoc “are we ready?” Reduces premature gate lift or release by tying the answer to the documented checklist and scripts.
