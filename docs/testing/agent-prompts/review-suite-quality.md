# Prompt: Review Restormel / Testing suite quality

## Purpose

Have a coding agent **audit** an existing suite for **ambiguity**, **overreach**, **flake risk**, **environment assumptions**, **excessive model grading**, and **implementation coupling**—then produce **actionable** fixes (optional small patches).

## When to use it

- Before **enforcing** the suite in CI.
- After **many edits** made the config hard to reason about.
- When you want a **second pass** before dogfooding on a real app.

## What the coding agent should inspect first

- **`restormel-testing.yaml`** / **`.json`** (full file).
- Any **`adapter_hooks`**, **`preconditions`**, or **`cleanup`** (must be empty/absent for MVP validate).
- **CI** references to `testing` / `restormel-testing`.
- Relevant **app routes** or README only as needed to validate whether goals match real product language.
- [`docs/writing-good-goals.md`](../writing-good-goals.md).

## Paste into Cursor

```text
You are reviewing the quality of the Restormel / Testing configuration in this repository.

Before editing:
1. Read restormel-testing.yaml or restormel-testing.json completely.
2. Flag non-empty adapter_hooks, preconditions, or cleanup as validate failures.
3. Skim CI workflow steps that run testing validate or testing run.
4. Optionally spot-check a few routes or UI strings mentioned in goals if the repo is available—do not refactor the app.

Review dimensions (report explicitly on each):
- Over-broad goals (multi-outcome or untestable descriptions)
- Weak or ambiguous success_criteria (vague strings, missing url_matches where a landing page matters)
- Excessive or unjustified judge_rubric usage
- Flake risk (brittle selectors, missing waits implied by criteria, retry/timeouts masking issues)
- Missing environment assumptions (auth, seed data, feature flags, non-local URLs)
- Coupling to internal implementation details instead of user-visible outcomes
- Illegal MVP fields (non-empty hooks / preconditions / cleanup)
- Suite sizing and naming consistency

Task:
- Produce a concise written review: strengths, issues grouped by severity (blocker / should-fix / later).
- For each issue, give a concrete fix suggestion (YAML-level or hook-level).
- Apply small targeted fixes ONLY if they are clearly safe and limited to restormel-testing.yaml/json and scripts/testing/*—otherwise propose diffs in the text for the user to apply.

Allowed to modify (optional, keep minimal):
- restormel-testing.yaml and/or restormel-testing.json
- scripts/testing/*

Do not:
- Refactor application code, dependencies, or unrelated configs.
- Add large numbers of new goals or suites.
- Turn this into a generic “testing strategy” document—stay specific to Restormel / Testing fields.

Deliverables:
1. Quality review with severity labels.
2. Recommended changes (NOW vs LATER).
3. If you edited files: short diff summary and suggested testing validate / testing run commands.
```

## Expected output from the coding agent

- A **structured review** (blocker / should-fix / later).
- **Specific** YAML-level recommendations tied to **goal ids**.
- **Optional** minimal patches—not a repo-wide rewrite.

## Guardrails

| Allowed | Not allowed |
|--------|-------------|
| Config + hook scripts only | App or infra overhauls |
| Narrow edits after explicit issues found | “While we’re here” refactors |

## What good results look like

- Each **blocker** maps to a **concrete** criterion or hook change.
- **Judges** are called out **by goal id** with replace-or-justify guidance.

## Common failure modes

- Generic testing advice **not tied** to `success_criteria` keys.
- Large **reformatting** of YAML that obscures the real review.
- **Adding** scope (new goals) when the user asked for **quality** review.
