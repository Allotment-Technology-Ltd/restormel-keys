# @restormel/testing-core

## 0.1.5

### Patch Changes

- **0.1.5** publish train: full `@restormel/testing-*` line aligned on npm.

## 0.1.4

### Patch Changes

- `execution_mode: ac_sequence`; `TestGoal.acSequence` and `GoalRunRecord.acSequenceSteps`. **`aggregateAcceptanceCriterionResults`** prefers per-step outcomes when `acSequenceSteps` is present.

## 0.1.3

### Patch Changes

- Suite **`userStory`** + **`acceptanceCriteria`**; goal **`acceptanceCriterionIds`**; **`aggregateAcceptanceCriterionResults`**; **`RunRecord.acceptanceResults`** and **`GoalRunRecord.acceptanceCriterionIds`** for BA-style reporting.

## 0.1.2

### Patch Changes

- `TestGoal`: `execution_mode` (`observe` | `agent`), `mission`, `mission_executor`, `mission_constraints`, `after_agent` for delegate-style agent missions (runner executes shell, then post-mission browser checks).

## 0.1.1

### Patch Changes

- Republish aligned with `main` after the 2026-04-08 Keys + Testing and runner work (registry `0.1.0` predated that commit train).

## 0.1.0

### Minor Changes

- Initial npm publish (`0.1.0`) for Restormel Testing — registry consumption and Plotbudget.com dogfooding.
