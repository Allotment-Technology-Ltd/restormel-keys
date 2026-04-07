# Restormel platform

Suite-wide **design tokens** (`@restormel/keys-tokens`), **reusable GitHub Actions** (composite actions), and a **Cursor / agent template** for new Restormel product repos.

## Layout in the Keys monorepo

This tree is vendored at **`platform/`** inside [restormel-keys](https://github.com/Allotment-Technology-Ltd/restormel-keys) so pnpm can resolve `@restormel/keys-tokens` via workspace. To split:

1. Create a new GitHub repo (e.g. `restormel-platform`).
2. Copy **only** the contents of `platform/` to the new repo root (or `git subtree split`).
3. Tag releases for tokens: `tokens-v0.1.0` (see `.github/workflows/publish-tokens.yml`).
4. In **restormel-keys**, remove `platform/packages/*` from [pnpm-workspace.yaml](../pnpm-workspace.yaml) and add a **semver** dependency on `@restormel/keys-tokens` in consuming packages.
5. Point CI composites at `uses: Allotment-Technology-Ltd/restormel-platform/.github/actions/...@vX` (pin tags or SHAs).

## Tokens package

- **Path:** `packages/tokens`
- **Name:** `@restormel/keys-tokens`
- **Publish:** Push tag `tokens-v*` with `NPM_TOKEN` configured in repo secrets.

## Cursor / agents

See [docs/cursor-init.md](./docs/cursor-init.md) and [cursor-template/](./cursor-template/).

## New Restormel modules

Canonical **default stack** (SvelteKit, pnpm, Vercel, Neon, GitHub Actions, token package, Next/Python variants): [docs/restormel-module-default-stack.md](../docs/restormel-module-default-stack.md) in the Keys repo (or copy into platform when split).

**GitHub Template source:** [template-restormel-module/](template-restormel-module/) — copy to a new GitHub repo and enable *Template repository* (see [docs/template-restormel-module-repo.md](../docs/template-restormel-module-repo.md)). **Init script** (from Keys root): `pnpm run init-module -- …`.

## Secrets (CI)

- **npm publish:** `NPM_TOKEN` with publish permission for `@restormel/*`.

No live credentials belong in this repo; see [docs/security-baseline.md](../docs/security-baseline.md) in the Keys repo.
