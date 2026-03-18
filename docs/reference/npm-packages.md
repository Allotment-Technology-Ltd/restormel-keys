# npm packages — scope and install path

Canonical reference for **which packages exist**, **what to install when**, and **how to verify** they resolve from npm.

## Verify before you install

Registry state changes with releases. From your project:

```bash
npm view @restormel/keys version
npm view @restormel/doctor version
npm view @restormel/keys-cli version 2>/dev/null || echo "not published or name differs"
npm view @restormel/keys-svelte version 2>/dev/null || echo "not published or name differs"
```

## Minimum path (Phases 1–4, any framework)

Headless resolution and doctor checks need only:

| Package        | Purpose                                      |
|----------------|----------------------------------------------|
| `@restormel/keys` | Core: resolve, providers, config consumption |
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

If a package returns **404** from npm, use the **manual config** path and `@restormel/doctor` until that package is published (see repo [README](../../README.md#publish-phase-2) and release workflow).

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
