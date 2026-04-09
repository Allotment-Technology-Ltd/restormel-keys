# @restormel/testing-runner

## 0.1.6

### Patch Changes

- **LLM budgets:** `SuiteLlmBudgetTracker` enforces suite/goal **`max_rounds`**, **`max_completions`**, **`max_wall_clock_ms`**; aggregates OpenAI-style **`usage`** into **`RunRecord.costEstimate`** when providers return it.
- **Default-deny browser egress:** Playwright **`context.route`** blocks page requests (navigations, scripts, `fetch`, XHR, **`WebSocket`**, etc.) to hosts outside **`base_url`** origin and **`egress_allow_hosts`**; **`data:`** / **`blob:`** / **`about:`** still allowed. Applied for all **`browser`** goals before first navigation.
- Built-in **`ac_sequence`** agent loop: JSON actions **`scroll_into_view`** and **`snapshot_a11y`** (Playwright accessibility snapshot).
- Shared **`postChatCompletions`** with optional **`response_format: json_object`** for judges; **`egress_allow_hosts`** on environments for agent **`navigate`** and context egress.

## 0.1.5

### Patch Changes

- **0.1.5** publish train: full `@restormel/testing-*` line aligned on npm.

## 0.1.4

### Patch Changes

- **`execution_mode: ac_sequence`**: built-in multi-turn LLM browser agent walks suite acceptance criteria in order; optional per-AC **`criterion_success`**, **`criterion_rubrics`** (AC-shaped judge JSON with `ac_id`), and **`post_checks`** (HTTP, DOM role+name, `db_shell`). Wired from **`runSuiteFromConfig`** with `--ac` / goal id filtering of criteria. Env per step: **`RESTORMEL_TESTING_AC_ID`**, **`RESTORMEL_TESTING_AC_TEXT`**, **`RESTORMEL_TESTING_AC_INDEX`**, plus existing run/base/goal vars.

## 0.1.3

### Patch Changes

- Roll up acceptance criteria into **`RunRecord.acceptanceResults`**; **`acceptanceCriterionIds`** run option and mission env **`RESTORMEL_TESTING_ACCEPTANCE_CRITERIA_JSON`** / **`RESTORMEL_TESTING_USER_STORY`**.

## 0.1.2

### Patch Changes

- Run `mission_executor` with documented env for `execution_mode: agent`, then evaluate post-mission criteria in the browser (`after_agent.start_path` overrides navigation when set). `RESTORMEL_TESTING_SKIP_MISSION_EXECUTOR=1` skips the executor only.

## 0.1.1

### Patch Changes

- Republish aligned with `main` after the 2026-04-08 Keys + Testing and runner work (registry `0.1.0` predated that commit train).

## 0.1.0

### Minor Changes

- Initial npm publish (`0.1.0`) for Restormel Testing — registry consumption and Plotbudget.com dogfooding.

### Patch Changes

- Updated dependencies
  - @restormel/testing-core@0.1.0
  - @restormel/testing-config@0.1.0
  - @restormel/testing-keys-adapter@0.1.0
  - @restormel/testing-browser-playwright@0.1.0
