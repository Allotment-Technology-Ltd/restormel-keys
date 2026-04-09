# @restormel/testing-keys-adapter

## 0.1.8

### Patch Changes

- **0.1.8** publish train: version align with **`@restormel/testing-github-action`** `action.yml` YAML parse fix.

## 0.1.7

### Patch Changes

- **0.1.7** publish train: tarball matches **`main`** after PR **#79** merge (CI: Next `^14.2.25`, basic-web `/about` + `serve -l 4173 .`).


## 0.1.6

### Patch Changes

- **0.1.6** publish train: version align with the rest of the **`@restormel/testing-*`** line.

## 0.1.5

### Patch Changes

- **0.1.5** publish train: published at **0.1.5** with the rest of the line (resolves partial **0.1.4** npm state).

## 0.1.4

### Patch Changes

- **`RESTORMEL_KEYS_BASE`** fills the HTTP resolve base URL when **`RESTORMEL_KEYS_API_BASE_URL`** is unset (API name wins if both are set).
- **Bearer token** for resolve: optional **`RESTORMEL_KEYS_API_TOKEN_ENV`** target, then **`RESTORMEL_KEYS_API_TOKEN`**, then **`RESTORMEL_GATEWAY_KEY`**, then **`RESTORMEL_SERVER_TOKEN`**.
- Export **`keysHttpBearerFromProcessEnv`** for CLI parity.

## 0.1.3

### Patch Changes

- Version align with **0.1.3** testing line.

## 0.1.2

### Patch Changes

- Version align with Testing **0.1.2** publish train (no adapter code changes).

## 0.1.1

### Patch Changes

- Republish aligned with `main` after the 2026-04-08 Keys + Testing and runner work (registry `0.1.0` predated that commit train).

## 0.1.0

### Minor Changes

- Initial npm publish (`0.1.0`) for Restormel Testing — registry consumption and Plotbudget.com dogfooding.

### Patch Changes

- Updated dependencies
  - @restormel/testing-core@0.1.0
