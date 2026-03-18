# Zuplo Developer Portal go-live — Restormel Keys

This runbook turns the Zuplo Developer Portal into a production-ready API reference with:

- authenticated docs access
- working “Try it”
- a “My Consumer Key” page

## Two API surfaces (do not mix them)

| Surface | Base URL | Auth | Used for |
|---|---|---|---|
| **Dashboard API** | `https://restormel.dev/keys/dashboard/api/...` | Gateway Key (`rk_...`) | Resolve, policies/evaluate, routes/steps (runtime operations) |
| **Zuplo Gateway API** | `https://restormel-keys-gateway-main-bc13eba.zuplo.app/api/...` | Consumer key (`zpka_...`) | Projects + Gateway key CRUD (control-plane) |

The Developer Portal documents the **Zuplo Gateway API** and links out to the Dashboard API docs.

## 1) Gateway OAS (in repo)

The portal API Reference is generated from:

- `zuplo-gateway/config/routes.oas.json`

This file must include:

- real endpoints (`/api/health`, `/api/projects`, `/api/projects/{id}`, `/api/projects/{id}/keys`)
- shared schemas (`Project`, `Environment`, `KeyInfo`, `Error`)
- `consumerKey` security scheme (bearer `zpka_...`)

## 2) Portal navigation and pages

Portal config is:

- `zuplo-gateway/docs/zudoku.config.ts`

Pages live under:

- `zuplo-gateway/docs/pages/`

Key pages:

- `introduction.md` (two-surface explanation)
- `dashboard-api/*` (runtime endpoints, **not** served by Zuplo)
- `my-keys.mdx` (shows `zpka_...` to signed-in users)

## 3) Auth (OIDC bridge)

Zudoku needs an OpenID Connect issuer. Restormel Keys provides a minimal OIDC bridge at:

- `https://restormel.dev/keys/auth/.well-known/openid-configuration`

### GitHub OAuth App (manual prerequisite)

Create a GitHub OAuth App for the Developer Portal:

- **Homepage URL**: `https://restormel-keys-gateway-main-bc13eba.zuplo.site`
- **Authorization callback URL**: `https://restormel.dev/keys/auth/callback`

> Note: Zudoku’s `/oauth/callback` is the app callback; Restormel acts as the OIDC issuer and completes the GitHub OAuth exchange server-side.

## 4) Consumer key provisioning

The portal uses the Restormel backend as a broker:

- The backend creates/retrieves a Zuplo consumer (`ws_<workspaceId>`) via the Zuplo Developer API.
- The portal fetches the `zpka_...` key from `https://restormel.dev/keys/dashboard/api/consumer-key` using the OIDC access token.

This enables:

- **My Consumer Key** page
- **Try it** (Zudoku API Identity plugin injects `Authorization: Bearer zpka_...`)

## 5) Environment variables & secrets

### In Zuplo (Developer Portal)

Set these in the Zuplo project environment variables/secrets (not in git):

- `RESTORMEL_OIDC_CLIENT_ID`
  - the client id Zudoku uses for the OIDC provider (can be any stable string; must match the audience used by the issuer)

### In Restormel dashboard app (server env)

Set these in the dashboard deployment environment (secrets manager / Vercel env):

#### GitHub OAuth (Developer Portal app)

- `PORTAL_GITHUB_CLIENT_ID`
- `PORTAL_GITHUB_CLIENT_SECRET` (secret)

#### OIDC signing keys (RS256)

- `OIDC_PRIVATE_KEY` (secret PEM)
- `OIDC_PUBLIC_KEY` (public PEM)

#### Zuplo Developer API (for consumer provisioning)

- `ZUPLO_ACCOUNT_NAME`
- `ZUPLO_BUCKET_NAME`
- `ZUPLO_API_KEY` (secret)

## 6) Validation checklist

1. Portal loads and shows **Gateway API Reference** at `/api`
2. Unauthenticated users cannot run “Try it” on `/api/*` (prompts login)
3. Login works via GitHub → returns to portal signed in
4. `/my-keys` shows a `zpka_...` key
5. “Try it” on `GET /api/projects` returns 200 when signed in

