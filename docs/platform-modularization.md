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

## Splitting `platform/` to GitHub

1. Create `restormel-platform` (or your chosen name) on GitHub.
2. Push the contents of **`platform/`** as the new repo root (`git subtree split` or copy).
3. Run `pnpm install` at the new repo root and commit **`pnpm-lock.yaml`**.
4. Configure **`NPM_TOKEN`** and tag **`tokens-v0.1.x`** to publish `@restormel/keys-tokens`.
5. In **restormel-keys**, remove `platform/packages/*` from the workspace, add `"@restormel/keys-tokens": "^x.y.z"` where needed, and optionally switch CI to `uses: <org>/restormel-platform/.github/actions/...@vX`.
