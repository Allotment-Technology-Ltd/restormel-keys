# Prompt: Extend an existing Restormel / Testing suite

## Purpose

Add a **small number** of new goals to an existing config **without** breaking naming, structure, or current suites.

## When to use it

- `restormel-testing.yaml` (or `.json`) already exists and runs.
- You need **one or a few** more critical journeys in an existing suite (or a **new suite id** only if the user asked).

## What the coding agent should inspect first

- **`restormel-testing.yaml`** / **`restormel-testing.json`** end-to-end.
- Existing **`suites[].id`**, **`goals[].id`**, **`environments`**, **`timeouts`**, **`retries`** (ignore non-empty **`adapter_hooks`** / **preconditions** / **cleanup** — they fail validate in MVP).
- Related **routes/tests/docs** for the new journey only.
- [`docs/writing-good-goals.md`](../writing-good-goals.md) for criteria style.

## Paste into Cursor

```text
You are extending an existing Restormel / Testing configuration in this repository.

Before editing:
1. Open and read the entire restormel-testing.yaml or restormel-testing.json (whichever is the source of truth).
2. Note existing suite ids, goal ids, environment ids, naming patterns, tags, timeouts, and retries—preserve them unless the user explicitly asked for a rename.
3. Read docs/writing-good-goals.md in this repo if available.

Task:
- Add only the new goals (or one new suite) the user described—default to adding goals inside the existing suite they name (e.g. web-critical).
- Reuse the same environment conventions and success_criteria patterns already present in the file.
- Prefer deterministic success criteria consistent with existing goals.
- Do not add preconditions, cleanup, or non-empty adapter_hooks (MVP validate rejects them).

Allowed to modify:
- restormel-testing.yaml and/or restormel-testing.json
- scripts/testing/* only for unrelated user-requested helpers — do not declare new adapter_hooks in YAML

Do not:
- Redesign the top-level schema, rename existing suite/goal ids, or reformat unrelated sections “for cleanliness” without cause.
- Add more than a handful of goals in one pass unless the user explicitly asked.
- Change application source outside Testing config/scripts.
- Remove or weaken existing goals.
- Introduce secrets into YAML.
- Add preconditions, cleanup, or executable adapter_hooks entries.

Deliverables:
1. List of new goal ids and one-line outcome descriptions.
2. YAML/JSON diff or full updated sections.
3. Any hook or script additions.
4. Suggested command: testing validate && testing run --suite <suite-id>
```

## Expected output from the coding agent

- **Incremental** diff: new `goals[]` entries (and optional hook entries) only.
- **Matching style** to existing `success_criteria` (same key shapes and conventions).
- Brief note of **assumptions** (e.g. new copy on a page).

## Guardrails

| Allowed | Not allowed |
|--------|-------------|
| Append goals only | Mass renames or schema churn |
| Touch only Testing config | Unrelated app or dependency changes |

## What good results look like

- New **`id`s** follow existing kebab-case patterns.
- No duplicate goal ids; suite remains **focused**.

## Common failure modes

- **Copy-paste** goals that duplicate an existing journey.
- **Different criterion types** than the rest of the file without reason (harder to maintain).
- Silent **environment** or **base_url** changes.
