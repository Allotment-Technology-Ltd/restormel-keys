# roadmap-status-sync

Keep ROADMAP.md and STATUS.md aligned when milestones, completion status, or next steps change.

## Purpose

Ensure the roadmap and current status are a single consistent view: same phase, same next actions, same gate criteria. No drift between “what we said we’re doing” and “where we are.”

## When to use

- Milestones or phases have been updated (e.g. Phase 00 complete, Phase 01 started).
- Next actions or blockers have changed.
- Someone has updated one of ROADMAP or STATUS and the other is now out of date.

## Inputs

- ROADMAP.md and STATUS.md (current contents).
- Optional: explicit changes (e.g. “Phase 00 done; next = Phase 01 kickoff”).

## Workflow

1. Read ROADMAP.md and STATUS.md.
2. Compare: phase, next actions, blockers, gate to Phase 01 (or next phase).
3. Apply the minimal edits so both files describe the same phase, same next steps, same gate.
4. Do not duplicate long prose; cross-link (e.g. STATUS points to ROADMAP for gate details).

## Outputs

- Updated ROADMAP.md and/or STATUS.md (or confirmation they are already aligned).
- Short note on what was synced.

## Done criteria

- ROADMAP and STATUS agree on current phase, next actions, and gate; no contradictory statements.

## How it saves credits or reduces mistakes

- One focused sync instead of editing one file and forgetting the other. Reduces “which one is right?” confusion and duplicate maintenance.
