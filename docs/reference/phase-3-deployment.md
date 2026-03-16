# Phase 3 — Cloud deployment runbook

**Current deployment:** Site and dashboard run on **Vercel** only. No Cloudflare or GCP Cloud Run.

- **Site** (Astro): Vercel project, Root `apps/site`, custom domain **restormel.dev**. Redirects `/keys/dashboard` and `/keys/dashboard/*` to the dashboard.
- **Dashboard** (SvelteKit): Vercel project, Root `.`, custom domain **restormel.dev/keys/dashboard**. Served at root (no path prefix).

**Gate:** All surfaces accessible (landing, docs, dashboard at restormel.dev/keys/dashboard, Paddle checkout, Zuplo gateway when applicable).

The sections below retain historical Cloud Run and Cloudflare notes for reference; follow [extraction-vercel.md](extraction-vercel.md) for current Vercel setup.

---

## DO NOT

- **Do not** switch Paddle to production mode from the sandbox used for Phase 3.
- **Do not** open public registration until explicitly planned.

---

## 1. Dashboard hosting (historical Cloud Run, current Vercel)

Today the dashboard runs on **Vercel** (see [extraction-vercel.md](extraction-vercel.md)). This section documents the **historical** Cloud Run path managed by Pulumi for reference and potential short-term rollback only.

The legacy path builds the dashboard (SvelteKit, `apps/dashboard`) as a Docker image, pushes it to Artifact Registry, and deploys it to the existing Cloud Run service `keys-dashboard`.

### 1.1 Ensure infra and registry exist

From repo root:

```bash
cd infra
pnpm run build                  # required: Pulumi runs bin/index.js; stale build causes wrong resources or 403
pulumi stack select production  # or your stack name
pulumi config set gcp:project YOUR_GCP_PROJECT_ID   # if not set
pulumi up   # creates/updates Artifact Registry, Cloud Run service
```

See **Before every pulumi up** in `infra/README.md` for the full checklist.

Note the outputs: `dashboardServiceUrl`, etc. (Site is on Cloudflare Worker; dashboard is reached via direct Cloud Run URL or Worker proxy.)

### 1.2 Build and push dashboard image (local or CI)

**Option A — CI (recommended):** Push to `main` (or trigger workflow_dispatch). The deploy job in `.github/workflows/ci.yml` will:

1. Build `Dockerfile.dashboard` (SvelteKit app).
2. Push to `europe-west2-docker.pkg.dev/<PROJECT>/restormel-keys/dashboard:<sha>`.
3. Run `gcloud run deploy keys-dashboard --image ... --region europe-west2`.

**Option B — Local:**

```bash
# From repo root; ensure gcloud is authenticated and Docker configured for Artifact Registry
export PROJECT=YOUR_GCP_PROJECT_ID
export REGION=europe-west2
gcloud auth configure-docker ${REGION}-docker.pkg.dev --quiet
docker build -f Dockerfile.dashboard -t ${REGION}-docker.pkg.dev/${PROJECT}/restormel-keys/dashboard:latest .
docker push ${REGION}-docker.pkg.dev/${PROJECT}/restormel-keys/dashboard:latest
gcloud run deploy keys-dashboard \
  --image ${REGION}-docker.pkg.dev/${PROJECT}/restormel-keys/dashboard:latest \
  --region ${REGION} --platform managed --allow-unauthenticated
```

### 1.3 Verify dashboard and health

- **Direct Cloud Run URL:** `https://keys-dashboard-<hash>.europe-west2.run.app`
- **Health:** `GET https://keys-dashboard-<hash>.europe-west2.run.app/api/health` — should return 200 (direct Cloud Run URL; base path applies to the app shell, API routes are at `/api/*`).

Use the `dashboardServiceUrl` from `pulumi stack output` for the exact URL.

---

## 2. Configure Paddle webhook URL

In the **Paddle dashboard** (sandbox or production):

1. Open **Developer tools** → **Webhooks** (or **Notifications**).
2. Set the **Webhook URL** to your dashboard’s billing endpoint, e.g.  
   `https://<your-cloud-run-url>/keys/dashboard/api/billing/webhook`  
   or the dashboard URL (e.g. `https://restormel.dev/keys/dashboard/api/billing/webhook`).
3. Select the events you need (e.g. subscription created, updated, cancelled).
4. Save. Paddle will send subscription events to this URL; ensure your dashboard API validates the signature and updates state accordingly.

---

## 3. Site → Vercel (current)

The marketing site and Keys docs (`apps/site`, Astro + Starlight) are deployed to **Vercel**. Create a Vercel project with Root Directory **apps/site**; add custom domain **restormel.dev**. The site’s `vercel.json` redirects `/keys/dashboard` and `/keys/dashboard/*` to **https://restormel.dev/keys/dashboard**.

### 3.1 (Historical) Site → Cloudflare Pages

The following described **Cloudflare Pages**; it is superseded by Vercel.

### 3.1 Connect repo and build

1. In **Cloudflare Dashboard** → **Pages** → **Create project** → **Connect to Git**.
2. Select the repo and branch (e.g. `main`).
3. **Build configuration:**
   - **Framework preset:** None (or Astro if available).
   - **Build command:** `pnpm build` (or `pnpm install && pnpm --filter site build` from repo root; if using root, set **Root directory** to repo root and ensure `pnpm-workspace.yaml` is present).
   - **Build output directory:** `apps/site/dist` (if root is repo) or `dist` (if root is `apps/site`).
4. **Environment variables:** Add any needed (e.g. `PUBLIC_KEYS_DASHBOARD_URL` for the dashboard URL). No secrets in Pages env for the static site.
5. Save and deploy. Cloudflare will build and publish the site.

### 3.2 Custom domain

In the same Pages project, add **Custom domains** → **Set up a custom domain** → e.g. `restormel.dev` and optionally `www.restormel.dev`. Cloudflare will prompt for DNS (CNAME or A record); see section 4.

### 3.3 Deploy command (Workers Git flow)

If the project was created via **Create application** (Workers Git), use **Worker** deploy with an explicit config so Wrangler does not run Astro autoconfig:

**Deploy command:** `npx wrangler deploy --config apps/site/wrangler.toml` (run from repo root; ensure `apps/site/wrangler.toml` and `apps/site/worker.js` are committed).

Ensure **Build output directory** is set to `apps/site/dist` if the UI has that field. The site uses a minimal `worker.js` and `[assets]` in `wrangler.toml` to serve the Astro build.

### 3.4 Manual deploy (optional)

From repo root or `apps/site`:

```bash
cd apps/site
pnpm build
npx wrangler pages deploy dist --project-name=restormel-site
```

(See `apps/site/README.md` and `apps/site/wrangler.toml`.)

---

## 4. DNS (Vercel)

Domain is managed in **Vercel**. Add **restormel.dev** to the site project and **restormel.dev/keys/dashboard** to the dashboard project. No Cloudflare or Worker; the site project’s redirects send `/keys/dashboard` traffic to restormel.dev/keys/dashboard.

---

## 5. Troubleshooting: restormel.dev not loading (ERR_CONNECTION_RESET)

If **restormel.dev** or **www.restormel.dev** shows "Connection reset" or "This site can't be reached", the cause is usually **DNS still pointing at the old GCP load balancer IP** after the load balancer was removed. Traffic hits an IP that no longer has listeners, so the connection is reset.

**Do this first:**

1. **Check what the domain resolves to** (from your machine or a tool like `dig`):
   ```bash
   dig restormel.dev +short
   dig www.restormel.dev +short
   ```
   If you see **35.190.37.201** (or any other GCP static IP), that is the old load balancer; it has been torn down and must no longer be used.

2. **Fix DNS — choose the panel where restormel.dev is managed:**

   **If DNS is in Vercel** (e.g. apex and `*` ALIAS to `cname.vercel-dns-017.com`):
   - Open **Vercel** → **Domains** (or the project that owns restormel.dev) → **restormel.dev** → **DNS** or **Configure**.
   - The apex and wildcard ALIAS to Vercel may be resolving to the old GCP IP if the domain was ever assigned to a project that used that IP. To serve the site from the **Cloudflare Worker** instead:
     - **Option A:** In Vercel, remove or unassign restormel.dev from any project that was pointing at the GCP load balancer. Then add **CNAME** records that point to your Cloudflare Worker: get the Worker’s hostname from **Cloudflare** → **Workers & Pages** → **restormel-site** → **Settings** → **Domains & routes** (e.g. `restormel-site.<your-subdomain>.workers.dev`). In Vercel DNS: add **CNAME** for **www** → that hostname. For the **apex** (@), Vercel often uses ALIAS; set the ALIAS target to the same Workers hostname if Vercel allows it, or use Cloudflare’s recommended apex target from the Worker custom-domain setup.
     - **Option B:** Move DNS to Cloudflare (change nameservers at the registrar to Cloudflare, then manage DNS and Worker custom domains in Cloudflare). Re-add your existing mail/MX/TXT/CAA records in Cloudflare so email keeps working.
   - Leave **mail, MX, TXT, CAA** (MailerSend, Zoho, ACME, etc.) as they are unless you move DNS; only change the records that control where the **website** (apex and www) resolve.

   **If DNS is in Cloudflare:**
   - Open **Cloudflare Dashboard** → **Websites** → **restormel.dev** → **DNS** → **Records**.
   - Remove any **A** or **AAAA** records for **@** (apex) or **www** that point to **35.190.37.201** (or the old GCP IP).
   - For the **Worker** (site), add the custom domain in **Workers & Pages** → your Worker (**restormel-site**) → **Settings** → **Domains & routes** → add `restormel.dev` and `www.restormel.dev`. Ensure those records are **Proxied** (orange cloud).

3. **Wait for propagation** (a few minutes to an hour), then try `https://restormel.dev` again. Optionally test the Worker directly first: `https://restormel-site.<your-subdomain>.workers.dev` — if that works, the issue is DNS only.

4. **Confirm the Worker is deployed:** From repo root run `cd apps/site && pnpm build && npx wrangler deploy --config apps/site/wrangler.toml` so the latest build is live.

**Summary:** restormel.dev must resolve to **Cloudflare** (for the Worker), not to the old GCP IP. Remove stale A records and attach the domain to the Worker with proxied DNS.

---

## 4.1 Deploy site Worker from GitHub Actions only (optional)

To avoid Git-triggered Cloudflare deploys wiping **KEYS_DASHBOARD_URL**, you can deploy the site Worker only from CI and disconnect Cloudflare’s Git deployment.

**1. GitHub — add secrets**

- Repo → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**.
- Add:
  - **KEYS_DASHBOARD_URL** — value: Cloud Run origin only, e.g. from `cd infra && pulumi stack output dashboardServiceUrl` (e.g. `https://keys-dashboard-xxx.run.app`). Do **not** append `/keys/dashboard`; the Worker appends the request path.
  - **CLOUDFLARE_API_TOKEN** — value: a [Cloudflare API token](https://dash.cloudflare.com/profile/api-tokens) with:
  - **Account** → **Workers Scripts** → **Edit**
  - **Account** → **Account Settings** → **Read**
  - **User** → **User Details** → **Read**
  - **User** → **Memberships** → **Read** (required for wrangler’s /memberships call; without it you get authentication error 10000). Use the same Cloudflare account that owns **restormel-site**.

**2. Cloudflare — disconnect Git**

- **Workers & Pages** → **restormel-site** → open **Build** (or the page that shows “Connect your Worker to a Git repository”).
- Click **Disconnect** next to the connected repository (`Allotment-Technology-Ltd/restormel-keys`).
- Confirm. After this, Cloudflare will no longer build or deploy on push; only the GitHub Actions workflow will deploy the Worker (when the deploy job runs and the **deploy-site-worker** job injects `KEYS_DASHBOARD_URL` and runs `wrangler deploy`).

**3. Result**

- Pushes to `main` that touch `apps/**` or the deploy paths trigger the CI workflow; the **deploy-site-worker** job builds the site, injects `KEYS_DASHBOARD_URL` from the secret into `wrangler.toml`, and runs `npx wrangler deploy`. The Worker is updated with the var set, so the proxy keeps working and the var is not wiped.

If you leave Git connected, you can still add the two GitHub secrets; the job will deploy after each push and re-inject the var, but a Cloudflare build that runs in parallel could occasionally overwrite the Worker. Disconnecting Git avoids that.

---

## 5.0 Error 1101 — Worker threw exception

**(Superseded — no Cloudflare.)** Dashboard is at **restormel.dev/keys/dashboard**; use [extraction-vercel.md](extraction-vercel.md) for troubleshooting.

---

## 5.1 Troubleshooting: 401 on dashboard

If **restormel.dev/keys/dashboard** returns **401** on API calls when not signed in, that is expected. Sign in with GitHub; the session cookie then authenticates requests. For auth callback issues, set GitHub OAuth callback to `https://restormel.dev/keys/dashboard/api/auth/callback/github` and ensure **NEON_AUTH_BASE_URL** is set in the dashboard Vercel project.

---

## 5.2 Troubleshooting: 500 on Sign in with GitHub / dashboard links

**500 or auth errors when clicking “Sign in with GitHub”:**

1. **Dashboard env (Neon Auth)** — In the dashboard Vercel project, set **DATABASE_URL** and **NEON_AUTH_BASE_URL**. GitHub OAuth is configured in Neon Console (Auth → OAuth providers).
2. **GitHub OAuth App** — **Authorization callback URL** = `https://restormel.dev/keys/dashboard/api/auth/callback/github`. In Neon Console, add GitHub as an OAuth provider with the same Client ID and Client Secret.
3. **Vercel logs** — Check dashboard function logs for `/api/auth/*` errors (no tokens or secrets in logs).

**Sidebar links:** When not signed in, links show “Sign in to use the dashboard”. After sign-in they load the real pages. Use **restormel.dev/keys/dashboard** as the dashboard URL.

---

## 5.3 Signed in with GitHub but dashboard still shows “Sign in to use the dashboard”

If GitHub sign-in succeeds but Overview/Projects still show “Sign in to use the dashboard”:

1. **Session cookie not reaching the browser** — When the dashboard is behind the Cloudflare Worker proxy, the backend’s `Set-Cookie` can be stripped from the response. The app sends the session cookie in a custom **X-Session-Cookie** header; the Worker copies it to `Set-Cookie` so the browser stores it. Ensure the latest Worker is deployed (X-Session-Cookie handling in `apps/site/worker.js`).
2. **Full page redirect after login** — Neon Auth (proxied at `/api/auth/*`) redirects to GitHub then back to the callback; after callback the app sets the session cookie. If you still see the prompt, try a hard refresh (Ctrl+F5 / Cmd+Shift+R) or clear cookies for the domain and sign in again.
3. **Zuplo vs dashboard login** — Dashboard “logged in” state is **separate** from Zuplo. The dashboard uses a **session cookie** (set via Neon Auth proxy at `/api/auth/*`). Zuplo (modules, schemas, docs, API keys) is for **external API access**; finishing Zuplo setup does not change whether the dashboard shows you as signed in. See `docs/runbooks/zuplo-setup.md` for gateway setup.

---

## 5.4 “Unable to load projects” or 500 on Overview / Projects

If you see **“Unable to load projects”** or 500 on Overview/Projects:

1. **Cause** — Overview and Projects use **Neon Postgres** via `listProjects()`. The failure is usually `DATABASE_URL` not set, wrong connection string, or migrations not run.
2. **Neon setup** — Create a Neon project and database at [Neon](https://neon.tech), copy the connection string, and set `DATABASE_URL` (or `DATABASE_URL_SECRET_REF` in Pulumi) for the dashboard. Run the SQL migrations in `apps/dashboard/migrations/` (001_initial.sql, 002_better_auth.sql) against the Neon database once. See **Neon setup** in `infra/README.md` and phase-3-manual-steps.
3. **Soft failure** — The app shows “Unable to load projects” instead of 500 so the page still loads. After `DATABASE_URL` is set and migrations are applied, refresh the page; creating a project should then work.

---

## 6. Verify

After deployment and DNS/proxy are in place:

| Check | Expected |
|-------|----------|
| **Landing** | `https://restormel.dev` (or your domain) serves the marketing homepage. |
| **Docs** | `https://restormel.dev/keys/docs/` (or equivalent) serves Starlight docs. |
| **Dashboard** | `https://restormel.dev/keys/dashboard` loads the SvelteKit app; login and shell work. |
| **Paddle checkout** | From `/keys/pricing`, “Subscribe” opens Paddle checkout; success redirects to dashboard with `?billing=success` (or configured path). |
| **Zuplo gateway** | If Phase 3 includes Zuplo, external calls through Zuplo to the Cloud Run API work and developer portal shows docs. |

---

## Summary

| Surface | Host | How |
|---------|------|-----|
| Site (home, /keys, /keys/pricing, /keys/docs) | Cloudflare Pages | Git-connected build; custom domain restormel.dev. |
| Dashboard + API | GCP Cloud Run | Dockerfile.dashboard → Artifact Registry → `keys-dashboard`; proxy or subdomain for /keys/dashboard. |
| Paddle | Paddle | Webhook URL points to dashboard billing API. |
| DNS | Cloudflare (or current provider) | restormel.dev → Cloudflare; /keys/dashboard/* → Cloud Run (proxy or subdomain). |

For GCP-only domain setup (restormel.dev entirely on GCP), see `docs/domain-mapping-restormel-dev.md`. For the split (site on Cloudflare, dashboard on Cloud Run), follow this runbook.
