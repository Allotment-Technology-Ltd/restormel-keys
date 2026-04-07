# Platform modularisation (Restormel suite)

**Status:** Canonical for suite structure. **Phase 3** structural splits are **deferred** until product need outweighs solo maintenance cost.

**New modules:** Default tech stack (pnpm, SvelteKit, Vercel, Neon, Actions, variants for Next/Python) lives in [restormel-module-default-stack.md](./restormel-module-default-stack.md) — use for repo templates and init prompts.

## Done (Phase 1–2 baseline)

- **`platform/`** subtree: `@restormel/keys-tokens`, reusable GitHub composite actions (mirrored under `platform/.github/actions/`), Cursor template under `platform/cursor-template/`, token publish workflow on tag `tokens-v*` when this tree is its own repo.
- **Keys monorepo** includes `platform/packages/*` in [pnpm-workspace.yaml](../pnpm-workspace.yaml) and uses local composites in [.github/workflows/ci.yml](../.github/workflows/ci.yml).
- **Inventory:** [platform-inventory.md](./platform-inventory.md).

## Deferred (Phase 3)

### Integrations app extraction

Follow the seam described in [ARCHITECTURE.md](../ARCHITECTURE.md) (Integrations layer / extraction bullets): new SvelteKit app, `integrations/` routes, `packages/aaif` and `packages/mcp`, shared auth and API base URLs documented against `restormel.dev`.

**Not scheduled** in this change set; track in [ROADMAP.md](../ROADMAP.md) when you pick it up.

### Dashboard-only repository

Splitting **only** `apps/dashboard` into its own repo requires **all** runtime dependencies to be **published semver** packages (no `workspace:*` to unpublished packages) and a clear owner for SQL migrations. Treat as a **late** phase.

## `platform/` on GitHub (done)

**Canonical remote:** [Allotment-Technology-Ltd/restormel-platform](https://github.com/Allotment-Technology-Ltd/restormel-platform) (contents of this monorepo’s **`platform/`** folder).

**Publish `@restormel/keys-tokens` to npm:** add **`NPM_TOKEN`** to that repo’s Actions secrets and push tag **`tokens-v0.1.x`** (workflow `publish-tokens.yml`).

**Consume from Keys without duplicating `platform/` in git:** remove `platform/packages/*` from [pnpm-workspace.yaml](../pnpm-workspace.yaml), add `"@restormel/keys-tokens": "^x.y.z"` where needed, and optionally point CI at `uses: Allotment-Technology-Ltd/restormel-platform/.github/actions/...@vX` (pin ref).
