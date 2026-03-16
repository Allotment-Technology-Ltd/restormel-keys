# Restormel Keys — Zuplo gateway (config-as-code)

This directory is the **Zuplo API gateway** project for the Keys cloud API. It is intended to be deployed to Zuplo (either by connecting this repo to Zuplo Source Control or via the Zuplo CLI from this folder).

**Runbooks:** [zuplo-setup.md](../docs/runbooks/zuplo-setup.md) (full reference) · [zuplo-launch-cli.md](../docs/runbooks/zuplo-launch-cli.md) (single-path CLI launch)

## Contents

| Path | Purpose |
|------|---------|
| `zuplo.jsonc` | Project config (version, compatibilityDate, projectType). |
| `tsconfig.json` | TypeScript config (required by Zuplo build; see [Zuplo docs](https://zuplo.com/docs/articles/tsconfig)). |
| `config/routes.oas.json` | Routes: path `/(.*)` (url-pattern catch-all), URL Forward to `${env.KEYS_BACKEND_URL}`, policies on all methods. |
| `config/policies.json` | api-key-inbound, rate-limit-inbound, quota-inbound, inject-backend-auth. |

## One-time: Create Zuplo project and link (choose one)

**Option A — Portal**

1. In [Zuplo Portal](https://portal.zuplo.com), create a project named **`restormel-keys-gateway`**.
2. In Settings → Source Control, connect to this GitHub repo and select the repo that contains `zuplo-gateway/`. If the project expects the gateway at repo root, you may need to create a separate repo that contains only the contents of `zuplo-gateway/` and connect that, or use Option B.

**Option B — CLI (deploy from this folder)**

1. Install dependencies (includes Zuplo CLI): from this directory run `pnpm install` (or `npm install`). Node 20+ required.
2. Get an API key: Zuplo Portal → Settings → API Keys. Set `ZUPLO_API_KEY` in your environment (do not commit).
3. Create project (if not already created):  
   `pnpm exec zuplo project create --name restormel-keys-gateway`  
   (If the CLI does not support create, create the project in the portal first.)
4. Deploy from this directory:  
   `ZUPLO_API_KEY=<your-key> pnpm run deploy`  
   or `pnpm exec zuplo deploy` with `ZUPLO_API_KEY` set.  
   The CLI will use the project linked to your account; you may need to select or link the project in the portal so that `zuplo deploy` targets `restormel-keys-gateway`.

## Required environment variables (in Zuplo)

Set these in Zuplo Portal → Settings → Environment Variables (or via CLI/API). **Do not commit values.**

| Name | Description | Secret |
|------|-------------|--------|
| `KEYS_BACKEND_URL` | Dashboard base URL (e.g. `https://restormel.dev/keys/dashboard`). No trailing slash. | No |
| `KEYS_BACKEND_API_KEY` | Backend API key (`sk-rk-...`) sent to the dashboard in `Authorization: Bearer …`. | **Yes** |

## Complete setup from CLI

From this directory you can set Zuplo env vars and deploy in one go. Copy `.env.example` to `.env` and set at least:

- `ZUPLO_API_KEY` — Portal → Settings → API Keys
- `KEYS_BACKEND_URL` — dashboard URL, e.g. `https://restormel.dev/keys/dashboard`
- `KEYS_BACKEND_API_KEY` — backend key (`sk-rk-...`) from the Keys dashboard (create in dashboard → project → API key)

Then run:

```bash
cd zuplo-gateway
pnpm install
# If this folder is not yet linked to your Zuplo project, run: pnpm exec zuplo link
./scripts/setup-from-cli.sh
```

The script creates/updates `KEYS_BACKEND_URL` and `KEYS_BACKEND_API_KEY` in Zuplo for the chosen branch (`ZUPLO_BRANCH`, default `main`), then deploys. For **working-copy**, run again with `ZUPLO_BRANCH=working-copy`. Optional env: `ZUPLO_ACCOUNT_NAME`, `ZUPLO_PROJECT_NAME`. After it finishes, create a consumer (Portal or `./scripts/create-consumer-and-test.sh`), set `ZUPLO_CONSUMER_KEY` in `.env`, then run `./scripts/launch-checklist.sh <GATEWAY_URL>` for the launch validation report.

## Deploy

- **If connected via GitHub:** Push to the branch that Zuplo deploys (e.g. `main`). Zuplo will deploy from the connected repo; ensure the project root in Zuplo is the directory that contains `config/` and `zuplo.jsonc` (you may need to point the project at this repo and set project root to `zuplo-gateway` if supported).
- **If using CLI:** From this directory run `pnpm run deploy` (or `pnpm exec zuplo deploy`) with `ZUPLO_API_KEY` set. In CI/non-interactive mode the CLI requires the key: `ZUPLO_API_KEY=<secret> pnpm run deploy` or `zuplo deploy --api-key <secret>`.

**If the gateway URL shows "You have no routes":** The deployed project has no routes (e.g. repo root was used instead of `zuplo-gateway/`). Deploy this folder’s config via CLI so this project gets the routes: from repo root run `cd zuplo-gateway && ZUPLO_API_KEY=<your-key> pnpm run deploy` (choose the existing `restormel-keys-gateway` project when prompted if applicable).

## After deploy

1. Create at least one **API key consumer** in Zuplo (Services → API Key Service, or [API Key API](https://zuplo.com/docs/articles/api-key-api)) so clients can call the gateway with a `zpka_...` key.
2. Ensure the **dashboard** (Vercel) accepts only the backend key (`sk-rk-...`) and rejects Zuplo consumer keys (`zpka_...`) on direct calls. See runbook §7.
3. Validate using the runbook §7 table (missing auth → 401, valid key → 200, etc.).

## Local secrets (for testing)

Store the **consumer API key** (the `zpka_...` key you use to call the gateway) in **`zuplo-gateway/.env`** so it is never committed:

```bash
# In zuplo-gateway/.env (create from .env.example)
ZUPLO_CONSUMER_KEY=zpka_your_consumer_key_here
```

`.env` is gitignored. Load it when testing, e.g. `source .env` or `set -a && source .env && set +a` before running curl. For production or shared use, use a secrets manager or CI secrets instead of a local file.

## Security

- No secrets in this folder. `KEYS_BACKEND_API_KEY` is referenced as `$env(KEYS_BACKEND_API_KEY)`; set the value only in Zuplo.
- See [docs/security-baseline.md](../docs/security-baseline.md) and runbook for trust boundaries.
