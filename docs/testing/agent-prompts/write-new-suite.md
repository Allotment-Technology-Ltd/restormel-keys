# Prompt: Write a new Restormel / Testing suite

## Purpose

Bootstrap a **small first suite** (e.g. `web-critical`) in the user’s repo: critical journeys, minimal goals, valid `restormel-testing.yaml` (no YAML hooks in MVP).

## When to use it

- The repo has no Restormel / Testing config or only a placeholder.
- You want **outcome-based** goals aligned to the MVP schema (suites, goals, `success_criteria`, environments).

## What the coding agent should inspect first

- Repo layout (app entry, `package.json`, framework).
- **Routes / pages / flows** that represent real user value (auth, onboarding, core task).
- Existing **E2E** folders (`e2e/`, `tests/`, `playwright.config.*`, Cypress).
- **CI** under `.github/workflows/` (or equivalent).
- Whether **`restormel-testing.yaml`** or **`restormel-testing.json`** already exists.
- Project **README** or product docs describing critical journeys.
- In this scaffold repo: [`examples/testing-basic-web/restormel-testing.yaml`](../../examples/testing-basic-web/restormel-testing.yaml) and [`examples/testing-github-actions/`](../../examples/testing-github-actions/).

## Paste into Cursor

```text
You are adding the first Restormel / Testing suite to this repository.

Read first (if present in this repo):
- docs/writing-good-goals.md or the Restormel Testing docs the user points you to
- restormel-testing.yaml or restormel-testing.json (if either exists)

Before editing:
1. Map the repo structure (app root, framework, how the app is run locally).
2. List existing routes/pages or navigation paths for critical user journeys.
3. Skim existing Playwright/Cypress/E2E tests and CI workflows for hints only—do not rewrite them.
4. If no config exists, plan a minimal file at the repo root named restormel-testing.yaml (preferred) matching the MVP model: schema_version, keys (logical refs only), environments, suites, goals with success_criteria. Omit adapter_hooks or use `{}` only — non-empty adapter_hooks, preconditions, and cleanup fail validate in the current MVP runner.

Task:
- Propose 2–5 critical user journeys (one outcome per goal).
- Create or replace only the Restormel Testing config file(s) needed: restormel-testing.yaml (or .json if the project already uses JSON).
- Add one initial suite (suggest id: web-critical) with environment id local (base_url must be http/https only).
- Prefer deterministic success criteria: url_matches, text_present/text_absent, dom_signals. Use judge_rubric only where the outcome is genuinely semantic and cannot be asserted deterministically.
- Do not add adapter_hooks, preconditions, or cleanup entries (they are rejected by validate). Use external setup docs or CI steps instead.

Allowed to modify:
- restormel-testing.yaml and/or restormel-testing.json (repo root unless user specifies another path)
- scripts/testing/* only if the user explicitly asked for non-YAML helpers (do not wire them via adapter_hooks)
- .github/workflows/* ONLY if the user asked to wire CI or an existing workflow clearly needs a single new job/step for `testing validate` / `testing run`

Do not:
- Refactor or “improve” unrelated application code, styles, or dependencies.
- Delete or rewrite existing Playwright/unit tests.
- Add raw API keys or secrets; use placeholder ref:restormel-keys:… slots only if judges are needed.
- Invent features not expressible in the current Restormel Testing YAML schema (stick to suites, goals, success_criteria, environments, timeouts, retries — no preconditions, cleanup, or non-empty adapter_hooks).

Deliverables:
1. Short list of chosen journeys and why they are critical.
2. The full config content (or clear diff).
3. Any new script paths and what they do.
4. How to run locally: `testing validate` and `testing run --suite <suite-id>` (adjust if the project uses pnpm exec).
5. Assumptions and follow-ups (e.g. staging URL, auth seed data).
```

## Expected output from the coding agent

- A **valid** minimal config with **2–5 goals**, consistent `id`s, and **explicit** `success_criteria`.
- **`base_url`** entries that are plain `http`/`https` URLs.
- Optional **small** hook scripts with clear names.
- A short **rationale** and **run** instructions.

## Guardrails (scope of edits)

| Allowed | Not allowed |
|--------|-------------|
| `restormel-testing.yaml` / `.json` | Large app refactors |
| `scripts/testing/*` when hooks need them | Deleting existing tests |
| CI file **only** if user requested or a single obvious Testing step | New product features, new CLIs |

## What good results look like

- Goals read like **user outcomes**, not step lists.
- Most criteria are **deterministic**; use **judge_rubric** on a goal only where semantics demand it (MVP schema: one optional judge_rubric per goal).
- Suite stays **small** and **one-environment** for the first cut.

## Common failure modes

- Goals that are **too broad** (“entire onboarding”) instead of one outcome each.
- **`judge_rubric`** used where **`url_matches`** or **`text_present`** would work.
- **`base_url`** with auth embedded or non-http schemes.
- Too many goals or **mixing unrelated journeys** in one suite.
