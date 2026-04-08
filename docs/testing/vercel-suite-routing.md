# Vercel: `restormel.dev` + separate Testing project

**Canonical** operational steps for serving **Restormel Testing** at `https://restormel.dev/testing` while **Restormel Keys** keeps the apex domain on its own Vercel project.

## Constraints

- One **hostname** (e.g. `restormel.dev`) attaches to **one** Vercel project.
- Path-based URLs (`/testing`, `/keys`) are **routing**, not separate domain records.

## Model

| Piece | Vercel project | Custom domain | Role |
|--------|----------------|---------------|------|
| Keys | `restormel-keys` | `restormel.dev` (and `www` if used) | Public origin; serves Keys routes; **rewrites** `/testing` to Testing |
| Testing | `restormel-testing` | **None** on apex (optional: assign only `*.vercel.app` / preview aliases) | Standalone deploy; reached in production via Keys rewrites |

## 1. Restormel Keys repository — `vercel.json` rewrites

In **[restormel-keys](https://github.com/Allotment-Technology-Ltd/restormel-keys)** (or whichever repo backs the Keys Vercel project), merge **`rewrites`** into the existing `vercel.json` so traffic under `/testing` is proxied to this app’s **production deployment URL**.

1. In the **restormel-testing** Vercel project, open **Deployments → Production** and copy the deployment URL (form `https://<project-name>.vercel.app` or your team’s default).
2. Use that origin **only** (scheme + host, no path), e.g. `https://restormel-testing.vercel.app`, in both destinations:

```json
{
  "rewrites": [
    {
      "source": "/testing",
      "destination": "https://restormel-testing.vercel.app/testing"
    },
    {
      "source": "/testing/:path*",
      "destination": "https://restormel-testing.vercel.app/testing/:path*"
    }
  ]
}
```

Replace `https://restormel-testing.vercel.app` with your **actual** Testing production deployment origin from the Vercel dashboard.

Merge with existing `rewrites` / `headers` / `build` keys; do not remove Keys’ own routes.

**After deploy:** Browsers only see `restormel.dev`; the Testing project still builds and deploys independently.

## 2. Restormel Testing repository — app base path

This repo’s SvelteKit app sets **`kit.paths.base`** to **`/testing`** so asset and navigation URLs match the public path. See [`apps/web/svelte.config.js`](../apps/web/svelte.config.js).

**Direct visits** to the Testing project URL must include the base path, e.g. `https://<testing-project>.vercel.app/testing`.

Optional: set **`PUBLIC_SUITE_TESTING_URL`** at build time (see [`.env.example`](../.env.example)) if the canonical URL is not `https://restormel.dev/testing` (e.g. fork or subdomain experiments).

## 3. Operational checklist

- [ ] Keys production deploy includes the rewrites and succeeds.
- [ ] Testing production URL is stable; if the Vercel project name or team URL changes, update Keys’ `vercel.json` destinations.
- [ ] Smoke-test: `https://restormel.dev/testing`, docs under `/testing/docs`, and static assets load (no 404 on `/_app` or module paths under `/testing`).

## Alternative (no rewrites)

Assign **`testing.restormel.dev`** (or similar) **only** to the Testing Vercel project. Then you do **not** use `/testing` as the public path; adjust app `base`, DNS, and in-app URLs accordingly.
