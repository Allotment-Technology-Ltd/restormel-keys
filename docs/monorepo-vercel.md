# Vercel — Restormel monorepo

## Dashboard (Keys)

- **Root** [`vercel.json`](../vercel.json): `pnpm --filter dashboard build` (Build Output API via [`scripts/vercel-copy-build-output.mjs`](../scripts/vercel-copy-build-output.mjs)).
- **Vercel project:** connect the **GitHub repo root** (no subfolder). Custom domain **`restormel.dev`** stays on this project.

## Testing marketing/docs app (second project, same repo)

Use a **separate Vercel project** pointing at **this repository** with a **Root Directory** override so install/build run from the monorepo root.

### Dashboard checklist (create or verify)

| Setting | Value |
|--------|--------|
| **Root Directory** | *(repo root — leave empty / `.`)* |
| **Framework Preset** | Other (root `vercel.json` sets `framework: null`) |
| **Install Command** | *(default)* `pnpm install` (from [`vercel.json`](../vercel.json)) |
| **Build Command** | `pnpm --filter dashboard build` |

### Testing-web checklist (new project)

| Setting | Value |
|--------|--------|
| **Root Directory** | `apps/testing-web` |
| **Framework Preset** | Other |
| **Install Command** | `cd ../.. && pnpm install` |
| **Build Command** | `cd ../.. && pnpm --filter @restormel/keys-tokens run build && pnpm run build:testing-packages && pnpm --filter testing-web run build` |

These match [`apps/testing-web/vercel.json`](../apps/testing-web/vercel.json). After the first deploy, attach a hostname (e.g. preview or `testing.restormel.dev`) or keep the `*.vercel.app` URL for rewrites from the dashboard project.

**CLI (optional):** from `apps/testing-web`, after `npm i -g vercel`, run `vercel link` and ensure the linked project’s root directory in the dashboard is `apps/testing-web`.

## Single-origin `/testing` on `restormel.dev`

Serving **dashboard** and **testing-web** from one hostname without a second deployment requires either merging into **one SvelteKit app** or a **composed Build Output** (non-trivial). Until then, common patterns are:

1. **Two Vercel projects**, same GitHub repo, different root directories (`/` → dashboard, `apps/testing-web` → testing).
2. **Rewrites** on the primary project to proxy `/testing` to the testing deployment URL (see historical [docs/testing/vercel-suite-routing.md](testing/vercel-suite-routing.md) concepts).

## Tokens

`@restormel/keys-tokens` is a **workspace** package (`packages/keys-tokens`). Dashboard and `testing-web` use `workspace:*`; production npm consumers use published versions.
