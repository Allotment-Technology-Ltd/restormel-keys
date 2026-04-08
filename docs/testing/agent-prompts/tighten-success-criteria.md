# Prompt: Tighten success criteria (less vague, less flake, less unnecessary judging)

## Purpose

Improve **existing goals** by making **`success_criteria`** more **concrete**, **deterministic**, and **stable**, and by **reducing** unjustified **`judge_rubric`** use—without expanding suite scope.

## When to use it

- Runs fail **ambiguously** or goals read **vague**.
- **`judge_rubric`** appears on goals that could use URL/DOM/text checks.
- **Timeouts/retries** feel padded everywhere.

## What the coding agent should inspect first

- Full **`restormel-testing.yaml`** / **`.json`**.
- Any **flaky run logs** or comments the user provides.
- External setup scripts the user mentions (MVP YAML does not run hooks).
- [`docs/writing-good-goals.md`](../writing-good-goals.md).

## Paste into Cursor

```text
You are tightening Restormel / Testing success criteria in this repository.

Before editing:
1. Read the entire restormel-testing.yaml or restormel-testing.json.
2. For each goal, list which success_criteria keys are set (url_matches, dom_signals, text_present, text_absent, structured_checks, judge_rubric) and classify deterministic fields vs judge_rubric.
3. Note any external setup the user relies on (hooks in YAML are not executed in MVP).

Task:
- Replace vague text_present patterns with more stable product copy or narrower checks where possible.
- Remove or narrow unnecessary judge_rubric by adding or strengthening url_matches, text_present/text_absent, or dom_signals when they can assert the same user-visible outcome (MVP: at most one judge_rubric per goal).
- Keep the same user intent per goal; only rename goal id or description if it is misleading after tightening.
- Adjust timeouts/retries only with explicit justification in comments or the deliverable summary (avoid blanket increases).
- Do not add new goals or new suites unless the user explicitly asked.

Allowed to modify:
- restormel-testing.yaml and/or restormel-testing.json
- scripts/testing/* only if the user explicitly asked and it is outside YAML hooks

Do not:
- Rewrite unrelated application code.
- Add broad new judge rubrics.
- Add preconditions, cleanup, or adapter_hooks to YAML unless the user explicitly asked for shell setup there.

Deliverables:
1. Per-goal summary: what changed and why.
2. List of goals where judge_rubric was removed or narrowed.
3. Any remaining judge_rubric entries with one-line justification each.
4. Suggested: testing validate && testing run --suite <suite-id>
```

## Expected output from the coding agent

- **Surgical** edits to `success_criteria` (and occasionally `timeouts`/`retries`).
- A **changelog-style** summary per goal.
- **Fewer** unjustified **judge_rubric** uses; **clearer** deterministic fields.

## Guardrails

| Allowed | Not allowed |
|--------|-------------|
| Edit criteria, disciplined timeout/retry tweaks | New journeys or suite scope creep |
| Small script fixes for hook alignment | App feature work |

## What good results look like

- Failures point to a **specific** failed criterion.
- **Judges** only where semantics truly require them.

## Common failure modes

- Swapping one vague string for another.
- **Removing** judge_rubric without **adding** a deterministic replacement, leaving the goal untestable.
- **Raising retries** instead of fixing unstable criteria.
