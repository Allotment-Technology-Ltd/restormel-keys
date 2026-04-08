# Vercel — Restormel monorepo

## Single project (dashboard)

- **Root** [`vercel.json`](../vercel.json): `pnpm --filter dashboard build` (Build Output API via [`scripts/vercel-copy-build-output.mjs`](../scripts/vercel-copy-build-output.mjs)).
- **Vercel project:** connect the **GitHub repo root** (no subfolder). Custom domain **`restormel.dev`** stays on this project.

### Dashboard checklist (create or verify)

| Setting | Value |
|--------|--------|
| **Root Directory** | *(repo root — leave empty / `.`)* |
| **Framework Preset** | Other (root `vercel.json` sets `framework: null`) |
| **Install Command** | *(default)* `pnpm install` (from [`vercel.json`](../vercel.json)) |
| **Build Command** | `pnpm --filter dashboard build` |

## Skipping needless builds (`ignoreCommand`)

Root [`vercel.json`](../vercel.json) sets **`ignoreCommand`** to [`scripts/vercel-ignore-dashboard.sh`](../scripts/vercel-ignore-dashboard.sh). Vercel runs it before install/build: **exit 0** skips the deployment, **exit 1** proceeds. The script diffs against **`VERCEL_GIT_PREVIOUS_SHA`** when set, else **`HEAD^`**, and only builds when those paths change: `apps/dashboard/`, dashboard **prebuild** deps (`packages/keys-tokens`, `packages/core`, `packages/svelte`), [`scripts/vercel-copy-build-output.mjs`](../scripts/vercel-copy-build-output.mjs), and root **`vercel.json` / `package.json` / `pnpm-lock.yaml` / `pnpm-workspace.yaml`**.

If the dashboard **prebuild** graph changes, update **`PATHS`** in that script (for example if a new workspace package is required at build time).

## Testing marketing and docs on the same deployment

**Restormel Testing** UI lives in the dashboard SvelteKit app under [`apps/dashboard/src/routes/testing/`](../apps/dashboard/src/routes/testing/) (URLs such as **`/testing`** and **`/testing/docs/...`**). There is **no** separate Vercel project or second `adapter-vercel` output for Testing.

Optional public env (see [`apps/dashboard/src/lib/testing/site.ts`](../apps/dashboard/src/lib/testing/site.ts)):

- `PUBLIC_GITHUB_REPO_URL` — repo links in docs
- `PUBLIC_SUITE_TESTING_URL` — canonical Testing suite URL (defaults to `https://restormel.dev/testing`)

## Tokens

`@restormel/keys-tokens` is a **workspace** package (`packages/keys-tokens`). The dashboard uses `workspace:*`; production npm consumers use published versions.

## Related

- **[`docs/testing/vercel-suite-routing.md`](testing/vercel-suite-routing.md)** — same deployment model, kept for legacy links from the archived **restormel-testing** repo (details remain **this** page).
