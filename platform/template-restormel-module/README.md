# __MODULE_TITLE__

SvelteKit app for **`/__MODULE_PATH__`** on the Restormel suite (`restormel.dev`).

## Local dev

```bash
pnpm install
pnpm dev
```

Open the URL printed by Vite (default `http://localhost:5173`).

## Commands

| Command | Description |
|--------|-------------|
| `pnpm dev` | Dev server (`apps/web`) |
| `pnpm run check` | `svelte-check` + sync |
| `pnpm run build` | Production build |

## Deploy (Vercel)

Root `vercel.json` runs `pnpm install` and `pnpm --filter __APP_PKG_NAME__ build`. Point the Vercel project at this repository root.

## Env

Copy `env.example` to `.env` for local-only variables. **Never commit** `.env` or real credentials.

## Design tokens

This app depends on **`@restormel/keys-tokens`** (`--rm-*` / semantic CSS). Import in `src/app.css`.

## Template placeholders

If this repo was created from the **Keys** template folder, replace `__MODULE_*__`, `__ROOT_PKG_NAME__`, and `__APP_PKG_NAME__` in all files, **or** run the init script from a **restormel-keys** clone (see [docs/template-restormel-module-repo.md](https://github.com/Allotment-Technology-Ltd/restormel-keys/blob/main/docs/template-restormel-module-repo.md)).
