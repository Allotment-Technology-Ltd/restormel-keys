# Architecture

High-level architecture summary. **Single entry point** for structure; details live in [docs/](docs/) and [docs/decisions/](docs/decisions/).

**Product shape:** Headless core (`@restormel/keys`) = product. UI: Svelte (reference), Elements, React, CLI. Later: dashboard, site, billing, hosted.

**Repo shape:** Monorepo (pnpm). `packages/` (core, svelte, elements, react, cli, doctor, validate, tokens, **aaif**, **mcp**), `apps/` (dashboard — single SvelteKit app for Keys landing, docs/walkthrough with optional agent prompts, **Integrations landing** at `/integrations`, and dashboard; demo-next, demo-svelte; site archived), `docs/`, `scripts/`, `prompts/`, `skills/`, `subagents/`. **npm install scope** (headless vs UI, pnpm workspaces): [docs/reference/npm-packages.md](docs/reference/npm-packages.md).

**Phase 00:** Scaffolding and governance only. No provider, routing, billing, or hosted logic.

**Trust/security:** BYOK-first. [docs/security-baseline.md](docs/security-baseline.md), [docs/threat-model-starter.md](docs/threat-model-starter.md).

**Design system:** All UI (site, dashboard, embeddable components, demos) aligns with [docs/design-system-index.md](docs/design-system-index.md). Tokens and components from DESIGN-TOKENS.md, DESIGN-SPECIFICATION.md, COMPONENT-INVENTORY.md; reference implementation in docs/design-tokens.css. Shared token package: [packages/tokens](packages/tokens) (base + semantic rm/rk); drift check: `pnpm run check-token-drift`.

**Catalog vs library (hybrid):** OpenAI, Anthropic, and Google model IDs in `defaultProviders` are checked against `apps/dashboard/data/model-catalog-seed.json` in CI (`pnpm run check:catalog-drift`). See [docs/reference/catalog-governance.md](docs/reference/catalog-governance.md).

**Reintegration and shell contracts:** Keys is headless-core-first with explicit shell contracts so the wider Restormel suite can share standards without forcing runtime convergence. Contracts are documented and enforced as follows:

- **Tokens:** Base canonical tokens → semantic surface tokens (`--rm-*` brand/app/docs, `--rk-*` embed) → optional component tokens. See [docs/design-system-index.md](docs/design-system-index.md) and [packages/tokens](packages/tokens).
- **Navigation and copy:** Canonical URLs (Dashboard → `/keys/dashboard`, Sign in → `/keys/dashboard/login`) and product nouns/CTA grammar are mandatory across all surfaces. See [docs/ux-contracts.md](docs/ux-contracts.md) and [docs/documentation-strategy.md](docs/documentation-strategy.md).
- **State:** Loading, error, empty, success and recovery actions are required for user-facing flows. See [docs/ux-contracts.md](docs/ux-contracts.md).
- **Documentation:** Single coherent doc journey and same-link rule for site, docs, dashboard, and runbooks. See [docs/documentation-strategy.md](docs/documentation-strategy.md).

Upstream or sibling products that integrate with Keys should use these contracts (same URLs, same terms, token alignment) for a consistent experience. Keys product framing does not change for reintegration.

**Integrations layer:** `@restormel/aaif` (request/response types + runtime helper `executeAAIFRequest` for routing + cost estimation), `@restormel/mcp` (MCP tool schemas + stdio server `restormel-mcp` and `createRestormelMcpServer()`). Marketing at `/integrations` (top-level route, separate from `/keys/`, designed for future extraction). Dashboard "Developer Tools" at `/keys/dashboard/dev-tools`. Existing dashboard provider integrations relabelled to "Provider Access" (URL unchanged). Full spec: [docs/integrations/INTEGRATIONS-FULL-SPEC.md](docs/integrations/INTEGRATIONS-FULL-SPEC.md).

**Extraction seams:** When Integrations moves to its own repo: (1) `src/routes/integrations/` lifts into a new SvelteKit app, (2) `packages/aaif/` and `packages/mcp/` move as-is, (3) dashboard dev-tools section stays in dashboard app (shared auth/shell), (4) shared components (`IntegrationCard`, `StatusBadge`) move with the marketing page or into a shared package.

---

*Record decisions in docs/decisions/. Keep this file as summary only.*
