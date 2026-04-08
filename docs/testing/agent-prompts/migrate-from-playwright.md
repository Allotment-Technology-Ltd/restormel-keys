# Prompt: Migrate selected Playwright tests into Restormel / Testing goals

## Purpose

Map **user-outcome** Playwright coverage into **goal-based** `restormel-testing.yaml` while **keeping** Playwright where it still fits (deterministic, low-level regression).

## When to use it

- The repo has **Playwright** (or similar) specs and you want **Restormel / Testing** goals for journeys that are about **outcomes**, not every assertion.

## What the coding agent should inspect first

- `playwright.config.*`, `e2e/`, `tests/e2e/`, or equivalent spec paths.
- **Fixtures**, **storageState**, auth helpers, **baseURL**.
- **CI** jobs that invoke Playwright.
- Existing **`restormel-testing.yaml`** / **`.json`**.
- [`docs/writing-good-goals.md`](../writing-good-goals.md).

## Paste into Cursor

```text
You are mapping existing Playwright tests to Restormel / Testing goals in this repository.

Before editing:
1. Read playwright.config.* and the spec files the user cares about.
2. Classify each test: (A) deterministic UI regression suitable to stay in Playwright, (B) user-outcome journey better expressed as a Restormel Testing goal with success_criteria.
3. Read existing restormel-testing.yaml or restormel-testing.json if present.

Task:
- For type (B) only: propose Restormel Testing goals (id, description, type: browser, success_criteria) that capture the user outcome, not every click.
- Preserve valuable deterministic checks inside success_criteria where they belong (url_matches, text_present, dom_signals)—do not replace a clear DOM check with a judge unless the user explicitly wants semantic grading.
- Create or update restormel-testing.yaml (or .json) with the new goals; align environments base_url with Playwright baseURL where appropriate (http/https only, no secrets in URL).
- Document setup in README or CI; do not add adapter_hooks / preconditions / cleanup (MVP validate rejects them).

Allowed to modify:
- restormel-testing.yaml and/or restormel-testing.json
- scripts/testing/* only if the user asked for non-YAML helpers (not referenced from adapter_hooks)

Do not:
- Delete, disable, or gut Playwright tests unless the user explicitly asked to remove them.
- Convert every spec blindly—leave narrow deterministic tests in Playwright when that is clearer.
- Put API keys or tokens in YAML; use ref:restormel-keys:… placeholders only for judge_rubric.model_ref if needed.

Deliverables:
1. Table mapping Playwright test titles/files → stay Playwright vs new Testing goal id.
2. New or updated config sections.
3. Notes on fixture/auth assumptions for Running `testing run --suite …`.
4. Recommended follow-ups (e.g. reduce duplicate coverage intentionally in a later PR).
```

## Expected output from the coding agent

- A clear **mapping table** (Playwright → goal or “keep Playwright”).
- **New goals** with **outcome** descriptions and **concrete** criteria.
- **Playwright specs still present** unless removal was explicitly requested.

## Guardrails

| Allowed | Not allowed |
|--------|-------------|
| Add/update Testing config + hook scripts | Removing Playwright by default |
| Comment in PR description suggesting deprecations | Large app refactors “to help testing” |

## What good results look like

- **Outcome** goals that don’t mirror every `page.click` from the old test.
- **Deterministic** criteria carried over where they encode real user-visible truth.

## Common failure modes

- **One giant goal** that encodes an entire old spec.
- **Judge rubric** added because translating selectors felt hard.
- **Conflicting base URLs** between Playwright and `environments.local.base_url`.
