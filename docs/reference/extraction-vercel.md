# Extraction checklist: Dashboard to Vercel (or other hosts)

The dashboard is a **Node/SvelteKit app** that only needs **runtime env** for database and auth. It has **no dependency on GCP** for auth or data. You can run it on **Vercel**, another Node host, or keep it on Cloud Run. In this repo, **local dev** uses the Neon `vercel-dev` branch via `apps/dashboard/.env`, and **production** (Vercel) uses the Neon `production` branch via Vercel environment variables.

**Automation:** There is **no Vercel MCP** for deployments or env (Vercel’s MCP docs are for hosting MCP servers on Vercel, not controlling the platform). Use the **Vercel CLI** and/or Dashboard. A script-assisted flow is in **`scripts/migrate-dashboard-to-vercel.sh`** (run from repo root); it walks through linking, env, deploy, and pointing the Worker at the Vercel URL.

## What the dashboard needs

1. **DATABASE_URL** — Neon (or any Postgres) connection string.
2. **Neon Auth** — `NEON_AUTH_BASE_URL` (your Neon Auth URL from Neon Console: Project → Branch → Auth → Configuration, e.g. `https://ep-xxx.neonauth.region.aws.neon.tech/neondb/auth`). GitHub OAuth is configured in **Neon Console** (Auth → OAuth providers), not in app env; the **GitHub OAuth App** callback URL must be your **dashboard** auth callback so the flow goes through the app proxy, e.g. `https://your-vercel-domain.vercel.app/keys/dashboard/api/auth/callback/github`.
3. **Paddle** (if billing is used) — `PADDLE_SECRET`, `PADDLE_API_KEY` (or whatever the app expects).

No Cloud Run, Artifact Registry, Firebase, or GCP Secret Manager is required for the app to run.

## Moving to Vercel

1. **Adapter** — The dashboard uses `@sveltejs/adapter-vercel`. The repo uses **pnpm only**; do not commit `package-lock.json` in `apps/dashboard` (it is gitignored) or Vercel will run npm and conflict with pnpm.
2. **Build (recommended)** — In Vercel, set **Root Directory** to **`.`** (repo root). The root **`vercel.json`** then applies: `installCommand`: `pnpm install`, `buildCommand`: `pnpm --filter dashboard build`, `outputDirectory`: `apps/dashboard/.vercel/output`. This avoids mixed npm/pnpm and cache issues.
3. **Build (alternative)** — If you keep Root Directory as **`apps/dashboard`**, the `apps/dashboard/vercel.json` runs `cd .. && pnpm install` and `pnpm run build`. Ensure no `package-lock.json` exists there.
4. **Env** — In Vercel → Project → Settings → Environment Variables, add:
   - `DATABASE_URL` — Neon connection string for the **production** branch.
   - `NEON_AUTH_BASE_URL` — Auth base URL from Neon Console for the **production** branch (Project → Branch → Auth → Configuration).
   - Any Paddle vars if needed.
5. **Neon Auth + GitHub** — In **Neon Console** (Project → Branch → Auth), enable Auth and add GitHub as an OAuth provider. In your **GitHub OAuth App**, set **Authorization callback URL** to your dashboard’s auth callback (so the flow is proxied through the app), e.g. `https://your-vercel-domain.vercel.app/keys/dashboard/api/auth/callback/github` (or `https://restormel.dev/keys/dashboard/api/auth/callback/github` if users reach the dashboard via your custom domain).
6. **Proxy / DNS** — If the site is currently on Cloudflare and proxies `/keys/dashboard` to Cloud Run, point the same route to the **Vercel URL** instead (e.g. set `KEYS_DASHBOARD_URL` or the Worker’s upstream to the Vercel deployment URL). No code change required; only deployment and env.

## Current setup (1): Site on Cloudflare, dashboard on Vercel

Recommended post-migration setup:

| Surface | Host | URL |
|--------|------|-----|
| **Site** (landing, /keys, /keys/docs, /keys/pricing) | Cloudflare (Pages/Worker) | e.g. restormel.dev |
| **Dashboard** (Overview, Projects, Billing, login) | Vercel | e.g. restormel-keys.vercel.app/keys/dashboard |

**Wire the Worker to Vercel:**

1. **Cloudflare** — Workers & Pages → restormel-site → Settings → Variables and Secrets. Set **KEYS_DASHBOARD_URL** = `https://restormel-keys.vercel.app` (or your Vercel project URL; no trailing slash, no `/keys/dashboard`). Apply to Production (and Preview if needed). Redeploy the Worker after changing.
2. **GitHub Actions** (if CI deploys the Worker) — In repo Settings → Secrets and variables → Actions, set **KEYS_DASHBOARD_URL** to the same Vercel URL. The deploy-site-worker job injects it and deploys; /keys/dashboard will then proxy to Vercel.
3. **NEON_AUTH_BASE_URL** in Vercel is your Neon Auth URL from Neon Console. The GitHub OAuth App callback URL must be your **dashboard** URL (so sign-in goes through the app proxy), e.g. `https://restormel.dev/keys/dashboard/api/auth/callback/github`.

After this, **restormel.dev/keys/dashboard** serves the Vercel-deployed dashboard via the Worker proxy.

## After extraction

- **Pulumi / GCP (decommissioning path)** — The dashboard now runs on Vercel. Plan for a burn-in window where Cloud Run remains as a manual rollback target, then:
  - Run `cd infra && pnpm run build && pulumi destroy` on the production stack to remove the `keys-dashboard` Cloud Run service, Artifact Registry repo, and the dedicated dashboard service account, once you are confident Vercel is stable.
  - After destroy, remove any Cloud Run–specific CI steps and treat `infra/` as archived or repurpose it for non-dashboard GCP resources only.
- **CI** — Remove or adjust the “Deploy dashboard to Cloud Run” job in `.github/workflows/ci.yml` if the dashboard is now deployed by Vercel (or another pipeline).

All config is **env-driven**; there is no hardcoded Cloud Run or GCP dependency in the app code.
