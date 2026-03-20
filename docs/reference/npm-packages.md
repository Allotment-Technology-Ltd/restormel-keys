# npm packages — scope and install path

Canonical reference for **which packages exist**, **what to install when**, and **how to verify** they resolve from npm.

## Verify before you install

Registry state changes with releases. From your project:

```bash
npm view @restormel/keys version
npm view @restormel/aaif version 2>/dev/null || echo "not published or name differs"
npm view @restormel/mcp version 2>/dev/null || echo "not published or name differs"
npm view @restormel/doctor version
npm view @restormel/keys-cli version 2>/dev/null || echo "not published or name differs"
npm view @restormel/keys-svelte version 2>/dev/null || echo "not published or name differs"
```

## Minimum path (Phases 1–4, any framework)

Headless resolution and doctor checks need only:

| Package        | Purpose                                      |
|----------------|----------------------------------------------|
| `@restormel/keys` | Core: resolve, providers, config consumption |
| `@restormel/aaif` | AAIF contract + runtime helper (routing + cost estimation) for app/service hosts (requires host to supply output) |
| `@restormel/mcp` | MCP tools + stdio server for agents/IDEs (requires `@restormel/keys` at runtime) |
| `npx @restormel/doctor` | Local setup check (no UI packages required) |

Create `restormel.config.json` with [`keys init`](../../packages/cli/README.md) **or** manually (see [Phase 1 walkthrough](../walkthrough/03-phase-1-install.md#step-13--manual-restormelconfigjson-no-cli)).

**Restormel Doctor** requires `@restormel/keys` and a valid config. **It does not fail** if optional UI packages (`@restormel/keys-svelte`, `@restormel/keys-react`, `@restormel/keys-elements`) are missing — those are for [Phase 5 UI](../walkthrough/07-phase-5-ui.md).

## UI and wrapper CLI (Phase 5 and onboarding)

| Package                 | When needed                                      |
|-------------------------|--------------------------------------------------|
| `@restormel/keys-svelte`| SvelteKit embeddable components                  |
| `@restormel/keys-react` | React / Next.js embeddable components            |
| `@restormel/keys-elements` | Web components / Astro                        |
| `@restormel/keys-cli`   | `keys init`, `keys add`, wrappers for doctor/validate |

**Avoid `@restormel/keys-cli@0.1.0`** and **`@restormel/validate@0.1.3`** — broken `workspace:*` on `@restormel/keys`. Use **keys-cli ≥0.1.1**, **validate ≥0.1.4**, or manual config / doctor-only checks.

If a package returns **404** from npm, use the **manual config** path and `@restormel/doctor` until that package is published (see repo [README](../../README.md#publish-phase-2) and release workflow).

## Publishing (maintainers)

- **Full release train:** push git tag `keys-v*` → workflow **Publish** (`.github/workflows/publish.yml`).
- **Single package (recovery):** GitHub Actions → run **Publish keys-svelte** or **Publish aaif** (uses `NPM_TOKEN`). Use when you need npm install without bumping `@restormel/keys` again.

## pnpm monorepos

Install into the **app package** that contains your app code (where `svelte.config.js` / `next.config.*` lives), not only the workspace root:

```bash
cd apps/my-app
pnpm add @restormel/keys
```

If you must install from the **workspace root**, scope the dependency to the right package:

```bash
pnpm add @restormel/keys --filter my-app
# or, for a root that is also the app:
pnpm add -w @restormel/keys
```

See also: on **restormel.dev**, **Docs → Framework compatibility** (`/keys/docs/compatibility`).
