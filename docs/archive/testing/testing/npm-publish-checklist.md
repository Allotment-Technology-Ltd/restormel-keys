# npm publish checklist — `@restormel/testing-*`

Use this when moving from **git / workspace consumption** to **published packages** on the npm registry under the `@restormel` scope.

**This repo (maintainer snapshot):** packages are at **`0.1.5`** (full line on npm after **`testing-v0.1.5`**), **`private` removed**, **`publishConfig.access: public`**, **`repository` / `license` / `bugs` / `homepage`** set, **`NPM_TOKEN`** wired in Actions. After merge, run [**Publish Testing packages**](../.github/workflows/publish-testing.yml) (`workflow_dispatch`) or push a tag **`testing-v*`** (e.g. **`testing-v0.1.5`**) to upload tarballs.

## 1. Registry and access

- Confirm the **`@restormel` org** exists on npm and your publish identity has **write** access.
- For **public** open-source packages, set `"access": "public"` in `.changeset/config.json` (and each package’s `publishConfig`).
- **GitHub Actions:** store a granular npm token as repository secret **`NPM_TOKEN`** (done for this repo). Do not commit tokens.

## 2. Package readiness

For each package under `packages/*` you intend to publish:

- Remove **`"private": true`** from `package.json` (or omit `private`).
- Set a real **`version`** (Changesets will bump this after the first release flow).
- Ensure **`files`** (or `package.json` `files` / `.npmignore`) includes only what consumers need (e.g. `dist/`, `action.yml` for the GitHub Action).
- **`repository`**, **`license`**, and **`bugs`** / **`homepage`** fields help consumers and npm metadata; align with this repo’s canonical URLs.

**Typical publish set:**

| Package | Role |
|---------|------|
| `@restormel/testing-core` | Shared types and guards |
| `@restormel/testing-config` | Config load + validate |
| `@restormel/testing-keys-adapter` | Keys HTTP + env fallback |
| `@restormel/testing-browser-playwright` | Playwright session |
| `@restormel/testing-runner` | Suite execution |
| `@restormel/testing-report` | Artefacts and reports |
| `@restormel/testing-cli` | `testing` / `restormel-testing` binaries |
| `@restormel/testing-github-action` | Composite action (`action.yml` + `dist/`) |

Replace **`workspace:*`** dependencies in published manifests with **semver ranges** that match the released versions (Changesets + `pnpm publish` from a version bump commit usually handles this).

## 3. Build before publish

- Run `pnpm run build:testing-packages` (and the GitHub Action package build if publishing the action).
- Run `pnpm run check` (or at least `typecheck` + `test`).
- Ensure **Playwright** is *not* bundled as a mistaken duplicate of consumer installs — document **peer** or **optional** install of browsers for end users (`playwright install chromium`).

## 4. Versioning with Changesets

1. `pnpm exec changeset` — describe changes; mark **patch/minor/major** as appropriate.
2. Merge the “Version Packages” PR Changesets opens (or run `pnpm exec changeset version` locally and commit).
3. Tag / release: either **manual** `pnpm publish -r --filter '@restormel/testing-*' --access public` from a clean tree, or add a **`release.yml`** workflow that runs on tag push and publishes with `NPM_TOKEN`.

**Linked packages:** `.changeset/config.json` links all `@restormel/testing-*` packages so one changeset can bump them together (adjust if you need independent versioning for the Action).

## 5. GitHub Action distribution

Publishing `@restormel/testing-github-action` is **not** the same as “Action marketplace” listing:

- Consumers can use `uses: ./path` to a **tagged checkout**, or `uses: owner/repo/path@vX.Y.Z` if the repo exposes the action path.
- Document the **exact path** (`packages/testing-github-action` or published tarball layout) and required **pre-steps** (Node, pnpm, `build:testing-packages`, Playwright browsers).

## 6. Post-publish

- **Current line:** `0.1.5` — install snippet `pnpm add -D @restormel/testing-cli@^0.1.5` or `@restormel/testing-bundle@^0.1.5` (documented in **oss-consumption.md**).
- Smoke-test from a **blank repo**: install CLI, `init`, `validate`, `doctor`, run against `examples/testing-basic-web` or equivalent.
- **Plotbudget.com:** add the CLI devDependency, wire CI with the composite action or `testing run`, and keep suite config in the Plot repo.

## 7. CI workflow (in repo)

[`.github/workflows/publish-testing.yml`](../.github/workflows/publish-testing.yml) publishes when:

- A git tag matching **`testing-v*`** is pushed, or
- **`workflow_dispatch`** runs manually (optional **dry run** checkbox).

**Secret:** set **`NPM_TOKEN`** under *Settings → Secrets and variables → Actions* (granular automation/publish token). The job fails fast if the secret is missing.

**Auth:** `pnpm publish` needs a registry token in **`.npmrc`** (or `setup-node` with `registry-url` plus `NODE_AUTH_TOKEN`). The workflow writes `//registry.npmjs.org/:_authToken=…` to a job-local `.npmrc` before publish.

Steps: `pnpm install` (frozen lockfile), `pnpm run build:testing-packages`, Playwright Chromium install (for Vitest), `pnpm run test`, `actions/setup-node` (registry URL), job-local `.npmrc` token, then `pnpm publish -r --access public --filter '@restormel/*' --no-git-checks`. Add **`--provenance`** only if you use npm trusted publishing / OIDC (classic tokens often need it omitted). Packages with `"private": true` are skipped until you clear that for release.

Until versions are bumped and `"private": true` is cleared on the packages you ship, a workflow run completes with *no packages uploaded* (pnpm reports nothing to publish).
