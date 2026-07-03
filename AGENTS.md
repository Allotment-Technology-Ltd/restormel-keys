# AGENTS.md — restormel-keys

Coding agents and humans: this is the **Restormel** monorepo — **Keys** (BYOK, dashboard), **Testing** (`@restormel/testing-*`, marketing/docs under `apps/dashboard/src/routes/testing/`), **Graph** (`@restormel/graph-core`, `@restormel/ui-graph-svelte`, marketing/docs under `apps/dashboard/src/routes/graph/`, canonical integrator guide `/graph/docs/integration/sveltekit`), **platform Phase 1** (`@restormel/contracts`, `@restormel/observability`, `@restormel/graph-reasoning-extensions`, `@restormel/context-packs`, `@restormel/state` — publish tag **`platform-v*`**), **design tokens** (`packages/keys-tokens`), integrations, and docs.

**ChatGPT Projects / external assistants:** single re-sync file — [docs/product/restormel-suite-chatgpt-project-brief.md](docs/product/restormel-suite-chatgpt-project-brief.md).

## Security and secrets

- Follow [.cursor/rules/02-security-baseline.mdc](.cursor/rules/02-security-baseline.mdc) and [docs/governance/security-baseline.md](docs/governance/security-baseline.md). Never commit credentials or realistic secret placeholders.

## Design tokens

- **`@restormel/keys-tokens`** — source in **[`packages/keys-tokens`](packages/keys-tokens)** (`workspace:*` in `apps/dashboard`). Publish with tag **`tokens-v*`** → [.github/workflows/publish-keys-tokens.yml](.github/workflows/publish-keys-tokens.yml). Human-readable mirror: [docs/design/design-tokens.css](docs/design/design-tokens.css). Index: [docs/design/design-system-index.md](docs/design/design-system-index.md).

## Where to implement (single product repo)

- Cursor rule: [.cursor/rules/09-keys-vs-platform-boundary.mdc](.cursor/rules/09-keys-vs-platform-boundary.mdc) — suite-wide **templates** and vendored composites under [platform/](platform/); product code and all publishable packages live **in this repo**.
- Package map: [docs/architecture/restormel-monorepo-packages.md](docs/architecture/restormel-monorepo-packages.md).

## CI / CD

- Main workflow: [.github/workflows/ci.yml](.github/workflows/ci.yml) (path filters, dashboard build, **Testing** build/test/integration). **Production Postgres migrations** on **push to `main`** when `apps/dashboard/migrations/**` or catalog-seed paths change (secret **`DASHBOARD_DATABASE_URL_PROD`**) — [docs/runbooks/dashboard-postgres-migrations.md](docs/runbooks/dashboard-postgres-migrations.md). PR preview DBs: [.github/workflows/neon_workflow.yml](.github/workflows/neon_workflow.yml).
- **Composites:** [.github/actions/pnpm-workspace-install](.github/actions/pnpm-workspace-install), [.github/actions/js-security-scan](.github/actions/js-security-scan) — mirrored under [platform/.github/actions/](platform/.github/actions/) for template extraction.
- Keys library publish: tag **`keys-v*`** → [.github/workflows/publish.yml](.github/workflows/publish.yml).
- Tokens publish: tag **`tokens-v*`** → [.github/workflows/publish-keys-tokens.yml](.github/workflows/publish-keys-tokens.yml).
- Testing packages publish: tag **`testing-v*`** or workflow dispatch → [.github/workflows/publish-testing.yml](.github/workflows/publish-testing.yml).
- Graph packages publish: tag **`graph-v*`** → [.github/workflows/publish-graph.yml](.github/workflows/publish-graph.yml).
- Platform packages publish: tag **`platform-v*`** → [.github/workflows/publish-restormel-platform.yml](.github/workflows/publish-restormel-platform.yml) (includes **`@restormel/context-packs`** — Phase 2 context packing: [docs/archive/suite-migration-status/PHASE2-EXTRACTION-STATUS.md](docs/archive/suite-migration-status/PHASE2-EXTRACTION-STATUS.md); **`@restormel/state`** — Restormel State: [docs/architecture/RESTORMEL-STATE.md](docs/architecture/RESTORMEL-STATE.md)).
- Restormel Support publish: tag **`support-v*`** → [.github/workflows/publish-support.yml](.github/workflows/publish-support.yml) (`@restormel/support`). Owner doc: [docs/architecture/RESTORMEL-SUPPORT.md](docs/architecture/RESTORMEL-SUPPORT.md). **Horizon programme** (capability themes A–J, Theme L IA, Theme M, MCP inventory): [docs/architecture/HORIZON-PLATFORM-PROGRAMME.md](docs/architecture/HORIZON-PLATFORM-PROGRAMME.md).

## Cursor skills and rules

- Skills: `.cursor/skills/` with symlinks under `.agents/skills/` per [.cursor/rules/08-project-skills.mdc](.cursor/rules/08-project-skills.mdc). **Keys vs platform:** [.cursor/skills/restormel-keys-vs-platform/SKILL.md](.cursor/skills/restormel-keys-vs-platform/SKILL.md). **SOPHIA-class routing (resolve, MCP, AAIF):** [.cursor/skills/restormel-keys-routing/SKILL.md](.cursor/skills/restormel-keys-routing/SKILL.md) and canonical [docs/architecture/keys-routing-contract.md](docs/architecture/keys-routing-contract.md).
- **Suite integrations & ecosystem marketing:** [.cursor/skills/restormel-suite-integrations-marketing/SKILL.md](.cursor/skills/restormel-suite-integrations-marketing/SKILL.md). **Third-party logos / trademarks:** [.cursor/skills/restormel-third-party-brand-marks/SKILL.md](.cursor/skills/restormel-third-party-brand-marks/SKILL.md). **Integration docs hub + catalog + AAIF stack field docs:** [.cursor/skills/restormel-integration-docs-hub/SKILL.md](.cursor/skills/restormel-integration-docs-hub/SKILL.md). **Product-proof / use cases:** [.cursor/skills/restormel-use-cases-page/SKILL.md](.cursor/skills/restormel-use-cases-page/SKILL.md). **Inline flow diagrams (`--rm-*`):** [.cursor/skills/restormel-product-flow-diagrams/SKILL.md](.cursor/skills/restormel-product-flow-diagrams/SKILL.md). **Marketing/OG imagery + Midjourney MCP:** [.cursor/skills/restormel-design-imagery/SKILL.md](.cursor/skills/restormel-design-imagery/SKILL.md), [.cursor/skills/restormel-midjourney-mcp/SKILL.md](.cursor/skills/restormel-midjourney-mcp/SKILL.md) — setup: [docs/guides/midjourney-cursor-mcp.md](docs/guides/midjourney-cursor-mcp.md).
- New Restormel **product** repos: start from [platform/cursor-template/](platform/cursor-template/) and [platform/docs/cursor-init.md](platform/docs/cursor-init.md).

## Keys + Restormel Testing

- End-to-end onboarding (Connections, encrypted provider keys, Testing hub, CLI env): [docs/guides/keys-testing-onboarding.md](docs/guides/keys-testing-onboarding.md); in-product [/keys/docs/guides/keys-testing-onboarding](https://restormel.dev/keys/docs/guides/keys-testing-onboarding).
- Self-host **Postgres** (Restormel prod = self-hosted Postgres + Better Auth; Neon is one managed option for *external* self-hosters, not our prod): [docs/guides/database-neon-for-self-hosters.md](docs/guides/database-neon-for-self-hosters.md); in-product [/keys/docs/guides/database-neon-for-self-hosters](https://restormel.dev/keys/docs/guides/database-neon-for-self-hosters).
- GA OSS quickstart, config schema policy, composite Action semver tags: [docs/archive/testing/testing/quickstart-ga.md](docs/archive/testing/testing/quickstart-ga.md), [docs/archive/testing/testing/schema-stability-policy.md](docs/archive/testing/testing/schema-stability-policy.md), [docs/archive/testing/testing/github-action-semver.md](docs/archive/testing/testing/github-action-semver.md).

## Inventory

- Frozen reference facts: [docs/architecture/platform-inventory.md](docs/architecture/platform-inventory.md).

## New Restormel modules

- **Default stack** (database, hosting, Actions, frameworks, variants): [docs/architecture/restormel-module-default-stack.md](docs/architecture/restormel-module-default-stack.md) — includes GitHub template checklist and copy-paste **initiation prompt**.
- **Scaffold:** `pnpm run init-module -- --out <dir> --slug <kebab> --title "<name>" [--platform-repo <path-to-restormel-platform>]` — see [docs/architecture/template-restormel-module-repo.md](docs/architecture/template-restormel-module-repo.md). Template sources: [platform/template-restormel-module/](platform/template-restormel-module/) (includes **09-suite-vs-platform** rule + **restormel-suite-vs-platform** skill for standalone modules).

