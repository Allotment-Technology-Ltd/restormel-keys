# @restormel/testing-github-action

## 0.1.7

### Patch Changes

- **0.1.7** publish train: tarball matches **`main`** after PR **#79** merge (CI: Next `^14.2.25`, basic-web `/about` + `serve -l 4173 .`).


## 0.1.6

### Patch Changes

- README: **semver Git tag** consumer pins (`testing-action-v*.*.*`) and link to [docs/testing/github-action-semver.md](../../docs/testing/github-action-semver.md); maintainer workflow [`.github/workflows/release-testing-action-version.yml`](../../.github/workflows/release-testing-action-version.yml).
- Fork PR policy values **`require_label`** and **`sandbox_only`** (with input **`fork_pr_label_present`**). **`sandbox_only`** exits **78** when skipping a fork PR without the maintainer label (optional neutral check). **`fork_pr_required_label`** is documentation-only for workflow authors.

## 0.1.5

### Patch Changes

- **0.1.5** publish train: full `@restormel/testing-*` line aligned on npm.

## 0.1.4

### Patch Changes

- Version align with **0.1.4** testing line.
- README: workflow example uses **`RESTORMEL_KEYS_BASE`** / **`RESTORMEL_GATEWAY_KEY`** (with compatibility note for `RESTORMEL_KEYS_API_*`).

## 0.1.3

### Patch Changes

- Version align with **0.1.3** testing line.

## 0.1.2

### Patch Changes

- Version align with `@restormel/testing-runner` **0.1.2**.

## 0.1.1

### Patch Changes

- Republish aligned with `main` after the 2026-04-08 Keys + Testing and runner work (registry `0.1.0` predated that commit train).

## 0.1.0

### Minor Changes

- Initial npm publish (`0.1.0`) for Restormel Testing — registry consumption and Plotbudget.com dogfooding.

### Patch Changes

- Updated dependencies
  - @restormel/testing-keys-adapter@0.1.0
  - @restormel/testing-runner@0.1.0
  - @restormel/testing-report@0.1.0
