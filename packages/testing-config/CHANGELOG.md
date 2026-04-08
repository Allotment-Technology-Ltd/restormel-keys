# @restormel/testing-config

## 0.1.6

### Patch Changes

- Publish JSON Schema draft **`schema/restormel-testing-config.v1.schema.json`** (editor hints; strict validation remains in TypeScript).
- Validate **`llm_budget`** / **`llmBudget`** on suites and goals; **`max_wall_clock_ms`** is **suite-only** (error on goals). Schema defs **`llmBudget`** and **`llmBudgetGoal`**.
- Validate **`egress_allow_hosts`** / **`egressAllowHosts`** on environments (string array). JSON Schema notes runner **context egress** (not only agent `navigate`).

## 0.1.5

### Patch Changes

- **0.1.5** publish train: full `@restormel/testing-*` line aligned on npm.

## 0.1.4

### Patch Changes

- Validate **`execution_mode: ac_sequence`** (browser only): required suite **`acceptance_criteria`**, **`ac_sequence`** block (`built_in_agent`, optional `criterion_executor`, `criterion_success`, `criterion_rubrics`, `post_checks`). Optional empty top-level **`success_criteria`** for this mode. Default **`acceptance_criterion_ids`** to all suite criterion ids when omitted.

## 0.1.3

### Patch Changes

- Validate **`user_story`**, **`acceptance_criteria`** (`{ id, text }[]`), and per-goal **`acceptance_criterion_ids`** (must reference suite ids).

## 0.1.2

### Patch Changes

- Validate `execution_mode: agent` browser goals (`mission`, `mission_executor`, optional `mission_constraints`, `after_agent`); forbid agent-only fields on observe goals.

## 0.1.1

### Patch Changes

- Republish aligned with `main` after the 2026-04-08 Keys + Testing and runner work (registry `0.1.0` predated that commit train).

## 0.1.0

### Minor Changes

- Initial npm publish (`0.1.0`) for Restormel Testing — registry consumption and Plotbudget.com dogfooding.

### Patch Changes

- Updated dependencies
  - @restormel/testing-core@0.1.0
