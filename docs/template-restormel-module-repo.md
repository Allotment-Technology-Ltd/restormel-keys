# Restormel SvelteKit module — GitHub template and init script

**Status:** Reference. Companion to [restormel-module-default-stack.md](./restormel-module-default-stack.md).

## Source tree

Canonical template files live under **[platform/template-restormel-module/](../platform/template-restormel-module/)** in the Keys monorepo (SvelteKit app in `apps/web`, pnpm workspace, Vercel config, vendored GitHub composite actions, `.cursor` rules).

## Option A — Init script (recommended)

From a clone of **restormel-keys**:

```bash
node scripts/init-restormel-module.mjs \
  --out ../restormel-your-module \
  --slug your-module \
  --title "Restormel Your Module" \
  --path your-module
```

- **`--path`** — URL segment on `restormel.dev` (defaults to `--slug`).
- **`--keys-repo <path>`** — restormel-keys repo root; sets `@restormel/keys-tokens` to a **`file:`** dependency relative to `apps/web` (no npm publish needed). Example: `--keys-repo ..` when `--out` is a sibling folder.

Then:

```bash
cd ../restormel-your-module
pnpm install
pnpm run check
pnpm run build
```

Root [package.json](../package.json) exposes: `"init-module": "node scripts/init-restormel-module.mjs"`.

## Option B — GitHub “Template repository”

1. Create a **new empty** GitHub repository (e.g. `restormel-module-template`).
2. Copy **only** the contents of `platform/template-restormel-module/` to that repo’s root (not the whole Keys monorepo).
3. Replace every placeholder string in all files:

| Placeholder | Example |
|-------------|---------|
| `__MODULE_SLUG__` | `testing` |
| `__MODULE_TITLE__` | `Restormel Testing` |
| `__MODULE_PATH__` | `testing` (URL segment) |
| `__ROOT_PKG_NAME__` | `restormel-testing` (root `package.json` `name`) |
| `__APP_PKG_NAME__` | `testing-web` (`apps/web` `name`; must match `pnpm --filter` in `vercel.json` and root scripts) |

4. Rename `env.example` → `.env.example` if you use that convention.
5. Commit and push.
6. On GitHub: **Settings → General → Template repository** → enable **Template repository**.

New modules use **Use this template**, then `pnpm install` and connect Vercel.

## Updating the template

When composite actions change, copy from [platform/.github/actions/](../platform/.github/actions/) into `platform/template-restormel-module/.github/actions/` (or re-run a small sync script later).
