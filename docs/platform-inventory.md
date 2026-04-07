# Restormel Keys — platform inventory (frozen reference)

**Status:** Reference. Operational truth for CI and hosting remains in repo config files; this page snapshots facts for modularisation and cross-repo planning.

## Repository

- **Root package:** `restormel-keys` ([package.json](../package.json)); **pnpm** `9.0.0`; Node `>=18` (dashboard engines: Node 20).
- **Workspaces:** [pnpm-workspace.yaml](../pnpm-workspace.yaml) — `packages/*`, `apps/*`, `examples/*`, `infra`. **`@restormel/keys-tokens`** is a **registry** dependency on `apps/dashboard` (not a workspace path).

## npm publish (Keys libraries)

- **Workflow:** [.github/workflows/publish.yml](../.github/workflows/publish.yml).
- **Trigger:** Git tag `keys-v*` (e.g. `keys-v0.2.0`).
- **Order:** `@restormel/keys` ([packages/core](../packages/core)) → `keys-svelte` → `keys-elements` → `keys-react` → `@restormel/aaif` → `@restormel/mcp` → doctor → validate → CLI.
- **Design tokens:** `@restormel/keys-tokens` is published from **[restormel-platform](https://github.com/Allotment-Technology-Ltd/restormel-platform)** on tag `tokens-v*`. **restormel-keys** consumes it from **npm** on the dashboard app.

## Primary app (dashboard)

- **Path:** [apps/dashboard](../apps/dashboard) — SvelteKit, `@sveltejs/adapter-vercel`.
- **Public URLs (documented in app):** Dashboard served at **`/keys/dashboard`** on `restormel.dev`; OIDC issuer **`https://restormel.dev/keys/auth`** ([openid-configuration route](../apps/dashboard/src/routes/keys/auth/.well-known/openid-configuration/+server.ts)).
- **Routes:** `keys/*` (marketing, docs, dashboard), **`integrations/*`** (top-level; extraction seam in [ARCHITECTURE.md](../ARCHITECTURE.md)).

## Hosting

- **Vercel (root):** [vercel.json](../vercel.json) — `pnpm install`, `pnpm --filter dashboard build`.
- **Docker (alternate):** [Dockerfile.dashboard](../Dockerfile.dashboard); CI path filter still references Dockerfiles and `infra/**`.

## CI/CD (Keys repo)

- **Main workflow:** [.github/workflows/ci.yml](../.github/workflows/ci.yml) — `dorny/paths-filter` gates jobs; **`platform/**`** included in `code` and `repo` filters.
- **Reusable composites:** [.github/actions/pnpm-workspace-install](../.github/actions/pnpm-workspace-install), [.github/actions/js-security-scan](../.github/actions/js-security-scan) (mirrored under `platform/.github/actions/` for the standalone platform repo).
- **Other workflows:** Neon PR branches, dogfood, per-package publish workflows, registry refresh, model catalog, hygiene, Paddle — remain in this repo.

## Design system

- **Canonical index:** [design-system-index.md](./design-system-index.md).
- **Token package:** `@restormel/keys-tokens` — npm + source in **restormel-platform** `packages/tokens`.

## Integrations extraction (deferred)

- **Seam:** [ARCHITECTURE.md](../ARCHITECTURE.md) (Integrations layer / extraction bullets). Detailed deferral: [platform-modularization.md](./platform-modularization.md).
