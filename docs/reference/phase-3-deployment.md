# Phase 3 — Cloud deployment runbook

This runbook covers deploying the **site** (Astro) to **Cloudflare Pages** and the **dashboard** (SvelteKit) to **GCP Cloud Run**, then wiring DNS and Paddle so all surfaces are accessible.

**Gate:** All surfaces accessible (landing, docs, dashboard, Paddle checkout, Zuplo gateway when applicable).

---

## DO NOT

- **Do not** switch Paddle to production mode from the sandbox used for Phase 3.
- **Do not** open public registration until explicitly planned.

---

## 1. Dashboard → Cloud Run

The dashboard (SvelteKit, `apps/dashboard`) is built as a Docker image, pushed to Artifact Registry, and deployed to the existing Cloud Run service `keys-dashboard`.

### 1.1 Ensure infra and registry exist

From repo root:

```bash
cd infra
pulumi stack select production   # or your stack name
pulumi config set gcp:project YOUR_GCP_PROJECT_ID   # if not set
pulumi up   # creates/updates Artifact Registry, Cloud Run service, load balancer
```

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
   or the canonical URL once DNS is set (e.g. `https://restormel.dev/keys/dashboard/api/billing/webhook`).
3. Select the events you need (e.g. subscription created, updated, cancelled).
4. Save. Paddle will send subscription events to this URL; ensure your dashboard API validates the signature and updates state accordingly.

---

## 3. Site → Cloudflare Pages

The marketing site and Keys docs (`apps/site`, Astro + Starlight) are deployed to **Cloudflare Pages**.

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

## 4. DNS: restormel.dev → Cloudflare, /keys/dashboard/* → Cloud Run

- **Point restormel.dev to Cloudflare**  
  At your DNS provider (e.g. Cloudflare DNS, or the registrar if using Cloudflare only for proxy), set:
  - **A** (apex) or **CNAME** for `restormel.dev` to the Cloudflare Pages target (or the Cloudflare proxy IPs as instructed when you add the custom domain in Pages).
  - **www** if you use it — same or CNAME to the Pages hostname.

- **Route /keys/dashboard/* to Cloud Run**  
  The site is on Cloudflare Pages; the dashboard runs on Cloud Run. You have two common options:

  1. **Cloudflare Workers (or Pages Functions) proxy**  
     Create a route that matches `restormel.dev/keys/dashboard` (and children) and proxies requests to the Cloud Run URL (`dashboardServiceUrl` from Pulumi). This keeps a single origin (restormel.dev) for users.

  2. **Subdomain for dashboard**  
     e.g. `dashboard.restormel.dev` or `keys-dashboard.restormel.dev` → CNAME or A to the Cloud Run load balancer (if you expose the load balancer for that host). Then the site can link to `https://dashboard.restormel.dev` (or the chosen subdomain) instead of `restormel.dev/keys/dashboard`.

Document the choice (single domain + proxy vs subdomain) and the exact URLs in this runbook or in `docs/04-design-and-site.md`.

---

## 5. Verify

After deployment and DNS/proxy are in place:

| Check | Expected |
|-------|----------|
| **Landing** | `https://restormel.dev` (or your domain) serves the marketing homepage. |
| **Docs** | `https://restormel.dev/keys/docs/` (or equivalent) serves Starlight docs. |
| **Dashboard** | `https://restormel.dev/keys/dashboard` (or dashboard subdomain) loads the SvelteKit app; login and shell work. |
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
