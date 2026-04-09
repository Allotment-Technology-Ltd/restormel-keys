# @restormel/testing-cli

## 0.1.6

### Patch Changes

- **0.1.6** publish train: version align with **`@restormel/testing-runner`** **0.1.6** and the rest of the line.

## 0.1.5

### Patch Changes

- **0.1.5** publish train: published at **0.1.5** with the rest of the line (resolves partial **0.1.4** npm state).

## 0.1.4

### Patch Changes

- **`testing doctor`**: recognises **`RESTORMEL_KEYS_BASE`**; resolve probe uses the same bearer precedence as **`@restormel/testing-keys-adapter`** (Gateway key without requiring **`RESTORMEL_KEYS_API_TOKEN`**).
- Help text lists canonical **`RESTORMEL_KEYS_BASE`** / **`RESTORMEL_GATEWAY_KEY`**.

## 0.1.3

### Patch Changes

- **`run --ac <ids>`** to filter goals by **`acceptance_criterion_ids`**.

## 0.1.2

### Patch Changes

- `testing doctor`: Keys resolve probe uses bootstrap ref `ref:restormel-keys:llm/primary`; clearer hints for HTTP 404 vs 401/403.

## 0.1.1

### Patch Changes

- Republish aligned with `main` after the 2026-04-08 Keys + Testing and runner work (registry `0.1.0` predated that commit train).

## 0.1.0

### Minor Changes

- Initial npm publish (`0.1.0`) for Restormel Testing — registry consumption and Plotbudget.com dogfooding.

### Patch Changes

- Updated dependencies
  - @restormel/testing-config@0.1.0
  - @restormel/testing-keys-adapter@0.1.0
  - @restormel/testing-runner@0.1.0
  - @restormel/testing-report@0.1.0
