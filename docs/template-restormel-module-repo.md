# Restormel SvelteKit module — GitHub template and init script

**Status:** Reference. Companion to [restormel-module-default-stack.md](./restormel-module-default-stack.md).

## Live GitHub repositories

| Repo | Purpose |
|------|---------|
| [Allotment-Technology-Ltd/restormel-platform](https://github.com/Allotment-Technology-Ltd/restormel-platform) | Tokens, composite actions, `publish-tokens.yml`, cursor template, raw `template-restormel-module/` sources. |
| [Allotment-Technology-Ltd/restormel-module-template](https://github.com/Allotment-Technology-Ltd/restormel-module-template) | **Template repository** (`is_template`): runnable **example** module. **Prefer npm** **`@restormel/keys-tokens`** `^0.1.0` (match [platform/template-restormel-module/apps/web/package.json](../platform/template-restormel-module/apps/web/package.json)); **remove** any vendored `packages/tokens` when syncing from this repo. Use **Use this template**. |

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
- **`--platform-repo <path>`** — clone of **restormel-platform**; sets `@restormel/keys-tokens` to **`file:`…/packages/tokens** relative to `apps/web` (local token work without npm). **Default:** omit this flag; the scaffold uses **`^0.1.0`** from npm.
- **`--keys-repo`** — **removed** (restormel-keys no longer contains `platform/packages/tokens`). The script exits with a pointer to **`--platform-repo`** or npm.

Then:

```bash
cd ../restormel-your-module
pnpm install
pnpm run check
pnpm run build
```

Root [package.json](../package.json) exposes: `"init-module": "node scripts/init-restormel-module.mjs"`.

## Option B — GitHub “Template repository”

**Preferred:** open [restormel-module-template](https://github.com/Allotment-Technology-Ltd/restormel-module-template) and click **Use this template**. After syncing from [platform/template-restormel-module/](../platform/template-restormel-module/), the example should use **npm** `@restormel/keys-tokens` and include **`.cursor/rules/09-suite-vs-platform-boundary.mdc`** plus **`.cursor/skills/restormel-suite-vs-platform/`** (and `.agents/skills` symlink). Drop legacy **vendored** `packages/tokens` if still present.

**Manual / placeholder workflow:** copy [platform/template-restormel-module/](../platform/template-restormel-module/) into a new repo and replace placeholders (or run **Option A**), then enable **Template repository** under **Settings → General**.

| Placeholder | Example |
|-------------|---------|
| `__MODULE_SLUG__` | `testing` |
| `__MODULE_TITLE__` | `Restormel Testing` |
| `__MODULE_PATH__` | `testing` (URL segment) |
| `__ROOT_PKG_NAME__` | `restormel-testing` |
| `__APP_PKG_NAME__` | `web` |

## Updating the template

When composite actions change, copy from [platform/.github/actions/](../platform/.github/actions/) into `platform/template-restormel-module/.github/actions/` (or re-run a small sync script later).

**GitHub `restormel-module-template` repo:** Periodically replace its tree from `platform/template-restormel-module/` (or export from **restormel-platform**’s copy) so **init**, **npm tokens**, and **Cursor** rule/skill stay aligned. Commit a fresh `pnpm-lock.yaml` after dependency changes.
