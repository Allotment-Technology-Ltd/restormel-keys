# docs-maintainer

Keep canonical docs and root docs consistent when repo, process, or structure changes.

## Purpose

Identify which docs must be updated for a given change, update them minimally, and keep STATUS, ROADMAP, CHANGELOG (and optionally ARCHITECTURE) aligned so there is no duplicated or conflicting truth.

## When to use

- After a change that affects process, repo structure, governance, or scope (e.g. new workflow, new rule, phase gate change).
- When someone asks “what docs need updating for this change?”

## Inputs

- Description of the change (what changed and where).
- Optional: list of files already touched.

## Workflow

1. Determine which topics the change affects (e.g. release gate, security baseline, testing strategy).
2. Map topics to canonical docs (docs/*.md and root README, ROADMAP, STATUS, CHANGELOG, ARCHITECTURE, CONTRIBUTING).
3. For each affected doc: make the smallest edit that brings it in line with the change; do not duplicate the same truth elsewhere.
4. If milestones or next steps changed: update ROADMAP.md and STATUS.md so they stay in sync (or hand off to roadmap-status-sync).
5. If the change is a meaningful repo milestone: consider CHANGELOG (or hand off to changelog-updater).

## Outputs

- List of docs updated with a one-line summary per doc.
- Any recommended follow-up (e.g. “run roadmap-status-sync” or “add CHANGELOG entry”).

## Done criteria

- Every canonical doc that “owns” the changed topic is updated; STATUS/ROADMAP/CHANGELOG are consistent with the change; no new duplicate truth introduced.

## How it saves credits or reduces mistakes

- Focused doc pass instead of ad-hoc “update all docs.” Reduces duplicate truth and forgotten updates by mapping change → owning doc → single minimal edit.
