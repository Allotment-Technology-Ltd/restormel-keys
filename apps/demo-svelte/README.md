# Restormel Keys — SvelteKit demo

SvelteKit 2 + Svelte 5 demo showing full Keys integration: KeyManager, ModelSelector, in-memory key API, and a demo chat route that uses the resolved provider (mock responses only).

## Routes

| Route | Description |
|-------|-------------|
| `/` | Landing with links to Settings and Demo |
| `/settings` | KeyManager + ModelSelector; add/list keys via `/api/keys` |
| `/api/keys` | Keys middleware (GET list, POST add, DELETE by id) — in-memory storage |
| `/demo` | Chat UI using resolved provider; mock responses only (no external API) |

## Style

The app uses **--rm-*** CSS custom properties for the shell (see `src/app.css`). KeyManager and ModelSelector use **--rk-*** from `@restormel/keys-svelte/theme.css`.

## Run

```bash
pnpm install
pnpm --filter @restormel/keys build
pnpm --filter @restormel/keys-svelte build
pnpm dev
```

Open [http://localhost:5173](http://localhost:5173). Go to **Settings** to add and list keys.

## Gate

Settings page shows KeyManager. Keys can be added and listed.
