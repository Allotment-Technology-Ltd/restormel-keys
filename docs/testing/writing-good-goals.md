# Writing good Restormel / Testing goals

**Audience:** Humans and coding agents authoring `restormel-testing.yaml` in a product repo.  
**Canonical config:** `restormel-testing.yaml` (YAML; JSON also supported by the loader).

## What a goal is

A **goal** is one **user-visible outcome** you care about in a **single environment** (e.g. local, preview). It is **not** a script that clicks through the app for its own sake.

- **Good:** “Signed-in user reaches the dashboard shell with the main nav visible.”
- **Bad:** “Clicks login, waits 2s, clicks #submit, asserts 47 selectors.”

Goals use **success criteria** (URL, DOM signals, text, light structured checks, optional judge rubric)—not a pile of imperative steps.

## Goals vs brittle Playwright scripts

| Playwright-style | Goal-based |
|------------------|------------|
| Many steps and waits tied to markup | Few criteria tied to **outcomes** |
| Breaks when CSS changes | Prefers stable signals (roles, copy, URL) |
| “Did we run the script?” | “Did the user get the outcome?” |

You can keep Playwright for low-level regression; Restormel / Testing goals should express **what must be true when the journey succeeds**.

## Deterministic criteria first

Prefer, in order:

1. **`url_matches`** — user landed where you expect.
2. **`text_present` / `text_absent`** — copy users actually see (stable product language).
3. **`dom_signals`** — selectors for landmarks you control (prefer stable `data-testid` or semantic hooks over random classes).
4. **`structured_checks`** — each entry has a runner-defined **`path`** (opaque string) and optional **`expect`**; use for small structured extractions when the runner documents the path language.

Add **`judge_rubric`** (at most one per goal in the MVP schema) only when the outcome is **genuinely semantic** or **multi-valid** and deterministic checks cannot reasonably decide pass/fail. Prefer **`context_selector`** (CSS) so the judge sees a **small** text region instead of the whole page — avoid shipping PII to the model.

## When model / rubric grading is justified

Use **`judge_rubric`** when:

- Quality of an AI-generated answer must be judged against a rubric.
- Several UIs are valid but you need a narrow semantic check.

Do **not** use a judge when:

- A URL, visible string, or DOM landmark is enough.
- You are papering over a vague goal (“make sure the AI was helpful”).

**`judge_rubric`** may use **`model_ref`** with **Keys-backed** logical refs (opaque `ref:restormel-keys:…`); never put API keys in YAML.

## Keep goals small and named clearly

- **`id`:** stable, kebab-case, describes the journey (`auth-login-session`, not `test1`).
- **`description`:** one sentence a triage engineer can read without opening the app.
- **One outcome per goal**—if you need two outcomes, use two goals.

## Suites stay small

- One suite = one **environment** + a **short list** of critical journeys (MVP: roughly 5–8 goals for a “web-critical” style suite).
- Do not mix unrelated products or unrelated environments in the same suite.

## Environments, fixtures, cleanup

- **`environments.*.base_url`** must be a safe `http`/`https` URL (no credentials in the URL).
- **MVP runner:** do not use **`preconditions`**, **`cleanup`**, or non-empty **`adapter_hooks`** in YAML — validation rejects them. Document setup in README or CI instead.
- Document assumptions (“needs seeded user X”, “preview deploy URL set in CI”) in README or comments near the suite, not only in chat.

## Vague goal smell test

If you cannot answer quickly:

1. What **user outcome** is under test?  
2. What **evidence** proves success?  
3. Which **environment** and **URL** does this assume?

…the goal is too vague.

## Further reading

- [Agent prompt pack](agent-prompts/README.md) — copy-paste prompts for coding agents.  
- [MVP spec — test definition model](restormel-testing-mvp-spec.md#7-test-definition-model).  
- Example config: [`examples/testing-basic-web/restormel-testing.yaml`](../examples/testing-basic-web/restormel-testing.yaml).
