# AGENTS.md — restormel-keys

Coding agents and humans: this is the **Restormel Keys** monorepo (headless `@restormel/keys`, dashboard app, integrations packages, docs).

## Security and secrets

- Follow [.cursor/rules/02-security-baseline.mdc](.cursor/rules/02-security-baseline.mdc) and [docs/security-baseline.md](docs/security-baseline.md). Never commit credentials or realistic secret placeholders.

## Design tokens

- **`@restormel/keys-tokens`** source: [platform/packages/tokens](platform/packages/tokens) (suite **platform** subtree). Canonical design docs: [docs/design-system-index.md](docs/design-system-index.md).
- When `platform/` is split to **restormel-platform**, consume tokens from npm at a pinned semver; see [docs/platform-modularization.md](docs/platform-modularization.md).

## CI / CD

- Main workflow: [.github/workflows/ci.yml](.github/workflows/ci.yml) (path filters, dashboard build, migrations job with `DASHBOARD_DATABASE_URL_PROD` when enabled).
- **Composites:** [.github/actions/pnpm-workspace-install](.github/actions/pnpm-workspace-install), [.github/actions/js-security-scan](.github/actions/js-security-scan) — kept in sync with [platform/.github/actions/](platform/.github/actions/) for extraction.
- Library publish: tag **`keys-v*`** → [.github/workflows/publish.yml](.github/workflows/publish.yml).
- Token-only publish (after platform repo exists): tag **`tokens-v*`** in the platform repo → `platform/.github/workflows/publish-tokens.yml`.

## Cursor skills and rules

- Skills: `.cursor/skills/` with symlinks under `.agents/skills/` per [.cursor/rules/08-project-skills.mdc](.cursor/rules/08-project-skills.mdc).
- New Restormel **product** repos: start from [platform/cursor-template/](platform/cursor-template/) and [platform/docs/cursor-init.md](platform/docs/cursor-init.md).

## Inventory

- Frozen reference facts: [docs/platform-inventory.md](docs/platform-inventory.md).

## New Restormel modules

- **Default stack** (database, hosting, Actions, frameworks, variants): [docs/restormel-module-default-stack.md](docs/restormel-module-default-stack.md) — includes GitHub template checklist and copy-paste **initiation prompt**.
- **Scaffold:** `pnpm run init-module -- --out <dir> --slug <kebab> --title "<name>" [--keys-repo <path>]` — see [docs/template-restormel-module-repo.md](docs/template-restormel-module-repo.md). Template sources: [platform/template-restormel-module/](platform/template-restormel-module/).
