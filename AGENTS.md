# AGENTS.md — restormel-keys

Coding agents and humans: this is the **Restormel Keys** monorepo (headless `@restormel/keys`, dashboard app, integrations packages, docs).

## Security and secrets

- Follow [.cursor/rules/02-security-baseline.mdc](.cursor/rules/02-security-baseline.mdc) and [docs/security-baseline.md](docs/security-baseline.md). Never commit credentials or realistic secret placeholders.

## Design tokens

- **`@restormel/keys-tokens`** — consumed from **npm** (`^0.1.0` on `apps/dashboard`). Source and publish: [restormel-platform](https://github.com/Allotment-Technology-Ltd/restormel-platform). Human-readable mirror: [docs/design-tokens.css](docs/design-tokens.css). Index: [docs/design-system-index.md](docs/design-system-index.md).

## Keys vs restormel-platform (where to implement)

- Cursor rule: [.cursor/rules/09-keys-vs-platform-boundary.mdc](.cursor/rules/09-keys-vs-platform-boundary.mdc) — suite-wide tokens, default composites, and module/cursor **templates** → **restormel-platform**; Keys product and **`keys-v*`** packages → **restormel-keys**. Quick test: *Would another Restormel module reuse it unchanged?*

## CI / CD

- Main workflow: [.github/workflows/ci.yml](.github/workflows/ci.yml) (path filters, dashboard build, migrations job with `DASHBOARD_DATABASE_URL_PROD` when enabled).
- **Composites:** [.github/actions/pnpm-workspace-install](.github/actions/pnpm-workspace-install), [.github/actions/js-security-scan](.github/actions/js-security-scan) — kept in sync with [platform/.github/actions/](platform/.github/actions/) for extraction.
- Library publish: tag **`keys-v*`** → [.github/workflows/publish.yml](.github/workflows/publish.yml).
- Token-only publish: tag **`tokens-v*`** on **[restormel-platform](https://github.com/Allotment-Technology-Ltd/restormel-platform)** (workflow `publish-tokens.yml` in that repo).

## Cursor skills and rules

- Skills: `.cursor/skills/` with symlinks under `.agents/skills/` per [.cursor/rules/08-project-skills.mdc](.cursor/rules/08-project-skills.mdc). **Keys vs platform:** [.cursor/skills/restormel-keys-vs-platform/SKILL.md](.cursor/skills/restormel-keys-vs-platform/SKILL.md).
- New Restormel **product** repos: start from [platform/cursor-template/](platform/cursor-template/) and [platform/docs/cursor-init.md](platform/docs/cursor-init.md).

## Inventory

- Frozen reference facts: [docs/platform-inventory.md](docs/platform-inventory.md).

## New Restormel modules

- **Default stack** (database, hosting, Actions, frameworks, variants): [docs/restormel-module-default-stack.md](docs/restormel-module-default-stack.md) — includes GitHub template checklist and copy-paste **initiation prompt**.
- **Scaffold:** `pnpm run init-module -- --out <dir> --slug <kebab> --title "<name>" [--platform-repo <path-to-restormel-platform>]` — see [docs/template-restormel-module-repo.md](docs/template-restormel-module-repo.md). Template sources: [platform/template-restormel-module/](platform/template-restormel-module/) (includes **09-suite-vs-platform** rule + **restormel-suite-vs-platform** skill for standalone modules).
