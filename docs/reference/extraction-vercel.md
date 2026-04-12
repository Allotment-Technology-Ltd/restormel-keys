# Extraction checklist: Dashboard to Vercel (or other hosts)

The dashboard is a **Node/SvelteKit app** that only needs **runtime env** for database and auth. It has **no dependency on GCP** for auth or data. You can run it on **Vercel**, another Node host, or keep it on Cloud Run. In this repo, **local dev** uses the Neon `vercel-dev` branch via `apps/dashboard/.env`, and **production** (Vercel) uses the Neon `production` branch via Vercel environment variables.

**Automation:** There is **no Vercel MCP** for deployments or env (Vercel’s MCP docs are for hosting MCP servers on Vercel, not controlling the platform). Use the **Vercel CLI** and/or Dashboard. A script-assisted flow is in **`scripts/migrate-dashboard-to-vercel.sh`** (run from repo root); it walks through linking, env, deploy, and pointing the Worker at the Vercel URL.

## What the dashboard needs

1. **DATABASE_URL** — **Neon is the recommended default** for self-hosters ([public guide](https://restormel.dev/keys/docs/guides/database-neon-for-self-hosters)). Use a Neon (or other Postgres-compatible) connection string if you accept migration and ops responsibility yourself.
2. **Neon Auth** — `NEON_AUTH_BASE_URL` (your Neon Auth URL from Neon Console: Project → Branch → Auth → Configuration, e.g. `https://ep-xxx.neonauth.region.aws.neon.tech/neondb/auth`). GitHub OAuth is configured in **Neon Console** (Auth → OAuth providers), not in app env; the **GitHub OAuth App** callback URL must be your **dashboard** auth callback so the flow goes through the app proxy, e.g. `https://your-vercel-domain.vercel.app/keys/dashboard/api/auth/callback/github`.
3. **Paddle** (if billing is used) — `PADDLE_SECRET`, `PADDLE_API_KEY` (or whatever the app expects).

No Cloud Run, Artifact Registry, Firebase, or GCP Secret Manager is required for the app to run.

## Moving to Vercel

1. **Adapter** — The dashboard uses `@sveltejs/adapter-vercel`. The repo uses **pnpm only**; do not commit `package-lock.json` in `apps/dashboard` (it is gitignored) or Vercel will run npm and conflict with pnpm.
2. **Build (recommended)** — In Vercel, set **Root Directory** to **`.`** (repo root). The root **`vercel.json`** sets `installCommand`: `pnpm install`, `buildCommand`: `pnpm --filter dashboard build`. The dashboard build copies `apps/dashboard/.vercel/output` to repo root `.vercel/output` so Vercel finds it. **You must set Build Command override** in Project Settings to **`pnpm --filter dashboard build`** if the log shows "Running \"vercel build\"" (see 404 section).
3. **Build (alternative)** — If you keep Root Directory as **`apps/dashboard`**, the `apps/dashboard/vercel.json` runs `cd .. && pnpm install` and `pnpm run build`. Ensure no `package-lock.json` exists there.
4. **Env** — In Vercel → Project → Settings → Environment Variables, add:
   - `DATABASE_URL` — Neon connection string for the **production** branch.
   - `NEON_AUTH_BASE_URL` — Auth base URL from Neon Console for the **production** branch (Project → Branch → Auth → Configuration).
   - Any Paddle vars if needed.
5. **Neon Auth + GitHub** — In **Neon Console** (Project → Branch → Auth), enable Auth and add GitHub as an OAuth provider. In your **GitHub OAuth App**, set **Authorization callback URL** to your dashboard’s auth callback, e.g. `https://restormel.dev/keys/dashboard/api/auth/callback/github`.
6. **DNS** — One Vercel project serves site, docs, and dashboard at **restormel.dev** (dashboard at `/keys/dashboard`, docs at `/keys/docs`). Custom domain **restormel.dev**.

## Current setup: Single app on Vercel

| Surface | Vercel project | URL |
|--------|-----------------|-----|
| **Site** (landing, /keys, /keys/pricing), **Docs** (/keys/docs), **Dashboard** (/keys/dashboard) | One project (Root: ., build: `pnpm --filter dashboard build`) | restormel.dev |

**Vercel:** Add custom domain **restormel.dev**. **NEON_AUTH_BASE_URL** = `https://restormel.dev`; GitHub OAuth callback = `https://restormel.dev/keys/dashboard/api/auth/callback/github`.

**Verified working (Mar 2026):** Root Directory = `.`, Build Command override = `pnpm --filter dashboard build`, Output Directory override = **ON** with value **empty** (so Vercel uses Build Output API from `.vercel/output`). Copy script `scripts/vercel-copy-build-output.mjs` runs as part of dashboard build and copies `apps/dashboard/.vercel/output` to repo root.

## 404 on every path (restormel.dev)

If **all** routes (/, /favicon.ico, /keys/dashboard) return 404:

The repo’s root **`vercel.json`** sets **`framework`: null** so Vercel treats the project as “Other” and uses our `buildCommand` instead of the SvelteKit preset. If you still see 404 after a redeploy, use the **Root Directory = apps/dashboard** flow below.

1. **Domain → project** — Vercel → **Domains**: confirm **restormel.dev** is assigned to the **same project** that is connected to this repo and builds the dashboard. If you have multiple projects (e.g. an old “site” project), move the domain to the project that runs `pnpm --filter dashboard build` (or Root Directory `apps/dashboard` with `pnpm run build`).
2. **Root Directory** — Use **one** of:
   - **`.`** (repo root): root `vercel.json` applies; build copies output to `.vercel/output` at root. Build runs from repo root. Override Build Command in UI if needed.
   - **`apps/dashboard`**: `apps/dashboard/vercel.json` applies (`outputDirectory`: `.vercel/output`). Build runs from that folder; install is `cd .. && pnpm install`.
3. **Latest deployment** — Vercel → **Deployments**: open the latest deployment. If it **failed**, fix the build (e.g. lockfile, Node version) and redeploy. If the last **successful** deployment is old, trigger a new deploy from **main**.
4. **Runtime env** — In **Settings → Environment Variables**, set at least **Production**: `DATABASE_URL`, `NEON_AUTH_BASE_URL`. Missing env can cause serverless functions to fail and return 5xx or 404.

The browser messages *"Event handler must be added on initial evaluation"* and *"runtime.lastError... back/forward cache"* are from **extensions** (e.g. DevTools), not the site; they do not cause the 404s.

### Build log shows "Running \"vercel build\"" and build finishes in &lt;1s

If the deploy log shows **Running "vercel build"** and the build completes in a few hundred ms, Vercel is **ignoring** `vercel.json` and using the default CLI build. Override in the dashboard:

1. **Vercel** → **restormel-keys** → **Settings** → **Build and Deployment**.
2. Turn **on** the **Override** for **Build Command**; set to **`pnpm --filter dashboard build`**.
3. Turn **on** the **Override** for **Output Directory** and leave the value **empty** (clear any `public` or other path) so Vercel uses the Build Output API.
4. Save and **Redeploy**.

With that, the real SvelteKit build runs (~60s), the copy script puts `.vercel/output` at repo root, and the site should serve. Alternatively use **Root Directory = apps/dashboard** (see below) so the build runs from the app folder and no copy is needed.

### If still 404: switch to Root Directory = `apps/dashboard`

When the output lives in a subdirectory (`apps/dashboard/.vercel/output`), Vercel can sometimes fail to serve it. Use the app as project root so the output is at `.vercel/output` with no subpath:

1. **Vercel** → **restormel-keys** → **Settings** → **General** → **Root Directory**: set to **`apps/dashboard`** (no leading dot or slash). Save.
2. **Settings** → **Build and Deployment** — set these and **Save** (override toggles **ON** for each):
   - **Build Command:** `pnpm run build`
   - **Output Directory:** `.vercel/output`
   - **Install Command:** `cd .. && pnpm install`
3. **Framework Preset:** set to **Other** (or leave SvelteKit; the overrides take precedence).
4. **Deployments** → **Redeploy** the latest deployment (use **main**), or push a commit to **main** to trigger a new build.

With this, the build runs inside `apps/dashboard`, produces `.vercel/output` there, and Vercel serves it directly. Root `vercel.json` is not used when Root Directory is `apps/dashboard`; only `apps/dashboard/vercel.json` applies (and the UI overrides above match it).

## After extraction

- **Pulumi / GCP (decommissioning path)** — The dashboard now runs on Vercel. Plan for a burn-in window where Cloud Run remains as a manual rollback target, then:
  - Run `cd infra && pnpm run build && pulumi destroy` on the production stack to remove the `keys-dashboard` Cloud Run service, Artifact Registry repo, and the dedicated dashboard service account, once you are confident Vercel is stable.
  - After destroy, remove any Cloud Run–specific CI steps and treat `infra/` as archived or repurpose it for non-dashboard GCP resources only.
- **CI** — Remove or adjust the “Deploy dashboard to Cloud Run” job in `.github/workflows/ci.yml` if the dashboard is now deployed by Vercel (or another pipeline).

All config is **env-driven**; there is no hardcoded Cloud Run or GCP dependency in the app code.
