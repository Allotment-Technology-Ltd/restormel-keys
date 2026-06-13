# Composite Action — semver Git tags

The Restormel Testing **composite** action lives at **`packages/testing-github-action/`** in this repository (directory containing `action.yml`).

## Pinning releases

After maintainers create a release tag, consumers pin **`uses`** to that ref:

```yaml
- uses: Allotment-Technology-Ltd/restormel-keys/packages/testing-github-action@testing-action-v1.0.0
  with:
    suite: web-critical
    # ...
```

Replace `Allotment-Technology-Ltd/restormel-keys` with your fork if you vendor the action.

**Tag format:** `testing-action-v` + **semver** (e.g. `testing-action-v1.0.0`). These tags are **only** for the composite action; they are independent of npm tags **`testing-v*`** (packages) and **`keys-v*`** (Keys library).

## Creating a release tag

Maintainers: run workflow **[Tag Testing composite action (semver)](../../.github/workflows/release-testing-action-version.yml)** (workflow dispatch) with input **`semver`** = `MAJOR.MINOR.PATCH` (no `v` prefix). It creates an **annotated** tag `testing-action-v{semver}` on the current `GITHUB_REF` commit.

**Pre-release:** Build `packages/testing-github-action/dist/` on that commit (`pnpm run build:testing-packages` or the action’s prepack) so the tag points at shippable `dist/`.

## Floating pins

Using `@main` or a branch name is convenient but **not** reproducible. Prefer immutable **`testing-action-v*.*.*`** tags for supply-chain hygiene; use Dependabot or a scheduled bump to move pins.

## See also

- Action I/O and fork policy: [github-action-io-spec.md](github-action-io-spec.md)
- [schema-stability-policy.md](schema-stability-policy.md) — config contract vs runner/Action versions
