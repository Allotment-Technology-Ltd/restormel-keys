# Restormel SvelteKit module — GitHub template and init script

**Status:** Reference. Companion to [restormel-module-default-stack.md](./restormel-module-default-stack.md).

## Live GitHub repositories

| Repo | Purpose |
|------|---------|
| [Allotment-Technology-Ltd/restormel-platform](https://github.com/Allotment-Technology-Ltd/restormel-platform) | Tokens, composite actions, `publish-tokens.yml`, cursor template, raw `template-restormel-module/` sources. |
| [Allotment-Technology-Ltd/restormel-module-template](https://github.com/Allotment-Technology-Ltd/restormel-module-template) | **Template repository** (`is_template`): runnable **example** module. May still **vendor** `packages/tokens` or switch to **`@restormel/keys-tokens`** from npm (`^0.1.0`) like **restormel-keys** `apps/dashboard`. Use **Use this template**. |

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

**Preferred:** open [restormel-module-template](https://github.com/Allotment-Technology-Ltd/restormel-module-template) and click **Use this template**. The repo is already flagged as a template and includes a working **example** rename set plus vendored tokens.

**Manual / placeholder workflow:** copy [platform/template-restormel-module/](../platform/template-restormel-module/) into a new repo and replace placeholders (or run **Option A**), then enable **Template repository** under **Settings → General**.

| Placeholder | Example |
|-------------|---------|
| `__MODULE_SLUG__` | `testing` |
| `__MODULE_TITLE__` | `Restormel Testing` |
| `__MODULE_PATH__` | `testing` (URL segment) |
| `__ROOT_PKG_NAME__` | `restormel-testing` |
| `__APP_PKG_NAME__` | `testing-web` |

## Updating the template

When composite actions change, copy from [platform/.github/actions/](../platform/.github/actions/) into `platform/template-restormel-module/.github/actions/` (or re-run a small sync script later).
