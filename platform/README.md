# Restormel platform

Suite-wide **design tokens** (`@restormel/keys-tokens` on npm), **reusable GitHub Actions** (composite actions), and a **Cursor / agent template** for new Restormel product repos.

## Layout in the Keys monorepo

This tree is vendored at **`platform/`** inside [restormel-keys](https://github.com/Allotment-Technology-Ltd/restormel-keys) for **actions, cursor template, and module template sources**. **Token source and publish** live in [restormel-platform](https://github.com/Allotment-Technology-Ltd/restormel-platform); **restormel-keys** consumes **`@restormel/keys-tokens` from npm** (see `apps/dashboard/package.json`).

## Tokens package

- **npm:** [`@restormel/keys-tokens`](https://www.npmjs.com/package/@restormel/keys-tokens)
- **Source repo:** [restormel-platform](https://github.com/Allotment-Technology-Ltd/restormel-platform) (`packages/tokens`)
- **Publish:** Push tag `tokens-v*` with `NPM_TOKEN` on that repo.

## Cursor / agents

See [docs/cursor-init.md](./docs/cursor-init.md) and [cursor-template/](./cursor-template/).

## New Restormel modules

Canonical **default stack:** [docs/restormel-module-default-stack.md](../docs/restormel-module-default-stack.md).

**GitHub:** [restormel-platform](https://github.com/Allotment-Technology-Ltd/restormel-platform). **Module template:** [restormel-module-template](https://github.com/Allotment-Technology-Ltd/restormel-module-template).

**Source in Keys:** [template-restormel-module/](template-restormel-module/) — [docs/template-restormel-module-repo.md](../docs/template-restormel-module-repo.md). **Init:** `pnpm run init-module -- …` from Keys root (npm tokens by default; optional **`--platform-repo`** for `file:` to **restormel-platform** `packages/tokens`). Template ships **09-suite-vs-platform-boundary** + **restormel-suite-vs-platform** skill for Cursor.

## Secrets (CI)

npm publish uses **`NPM_TOKEN`** on **restormel-platform** only (not in this folder’s workflows for tokens).

No live credentials in repo; see [docs/security-baseline.md](../docs/security-baseline.md).
