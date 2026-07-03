# Restormel Keys — Next.js App Router demo

Demo app proving **Restormel Keys** works with Next.js 15 App Router: server-side key storage and resolution, client-side settings UI, and dynamic import of the key manager.

## Quick start

```bash
pnpm install
pnpm --filter @restormel/keys build
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). Use **Settings** to manage provider credentials (in-memory for this demo).

## Client boundary expectations

- **Server components** must not use `KeysProvider`, `KeyManager`, or `useKeysContext()` — those depend on client state and browser APIs.
- **Client boundary:** Put `KeysProvider` and key-management UI in a client component (e.g. `app/settings/SettingsClient.tsx`) and mark it with `"use client"`.
- The **settings page** is a server component that renders the client component; the client component fetches keys from `/api/keys` and passes them into `createKeys` via `KeysProvider` config. No repo-specific hacks are required.

## Dynamic import usage

- **`LazyKeyManager`** (`app/components/LazyKeyManager.tsx`) uses `next/dynamic` with `ssr: false` to load the key manager only on the client, avoiding hydration mismatches and shrinking the initial JS bundle.
- Use this pattern when the key manager is below the fold or in a modal/tab so the main route stays fast.

## Server-side key resolution pattern

- **Storage:** This demo uses in-memory storage per request (see `app/lib/keys-server.ts`). Production would use a persistent store (e.g. database) keyed by user.
- **Middleware:** `/api/keys` uses `createMiddleware` from `@restormel/keys/server` for GET (list) and POST (add). `/api/resolve` uses `createResolveMiddleware` to resolve a provider/model to a key server-side.
- **Auth:** The demo uses a single `x-user-id` header for identity. Replace with your auth (e.g. session or JWT) and pass the user id into the keys layer.

## Tests

```bash
pnpm run test:e2e
```

Playwright tests cover: home and settings route, API (GET/POST /api/keys, GET /api/resolve), and that the settings page loads. In CI, tests that require the dynamically loaded client content (KeyManager UI) are skipped; run `pnpm run test:e2e` locally without `CI=true` to run the full suite including client content and add-key flow.

## CI

This app is **not** built or E2E-tested in the main repo **CI/CD** workflow (that keeps pushes fast). To verify after changing Keys packages or this demo:

```bash
# from repo root
pnpm install
pnpm --filter @restormel/keys run build
pnpm --filter @restormel/keys-svelte run build
pnpm --filter @restormel/keys-elements run build
pnpm --filter @restormel/keys-react run build
pnpm --filter demo-next run build
cd apps/demo-next && pnpm exec playwright install chromium && pnpm run test:e2e
```

Get the source by cloning [restormel-keys](https://github.com/Allotment-Technology-Ltd/restormel-keys) and opening `apps/demo-next`.
