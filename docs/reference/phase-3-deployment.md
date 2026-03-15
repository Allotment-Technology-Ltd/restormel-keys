# Phase 3 — Cloud deployment runbook

This runbook covers deploying the **site** (Astro) to **Cloudflare Pages** and the **dashboard** (SvelteKit) to **GCP Cloud Run**, then wiring DNS and Paddle so all surfaces are accessible.

**Gate:** All surfaces accessible (landing, docs, dashboard, Paddle checkout, Zuplo gateway when applicable).

**Site URLs:** Custom domain **restormel.dev** DNS has been updated (namespaces no longer pointing at Vercel); the site is served from Cloudflare. If the custom domain is not yet active, use [https://restormel-site.adam-boon1984.workers.dev/keys/](https://restormel-site.adam-boon1984.workers.dev/keys/) for the marketing site.

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
pnpm run build                  # required: Pulumi runs bin/index.js; stale build causes wrong resources or 403
pulumi stack select production  # or your stack name
pulumi config set gcp:project YOUR_GCP_PROJECT_ID   # if not set
# One-time: if dashboard needs Firebase secret, run from repo root: ./infra/grant-firebase-secret-access.sh
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
  The site Worker (`apps/site/worker.js`) can proxy `/keys/dashboard` to Cloud Run. Set **KEYS_DASHBOARD_URL** in Cloudflare (Workers & Pages → restormel-site → Settings → Variables) to the Cloud Run URL from `pulumi stack output dashboardServiceUrl` (no trailing slash). Deploy with `cd apps/site && pnpm build && npx wrangler deploy` so the Worker (and proxy) run. See **docs/reference/phase-3-manual-steps.md** E2.

  **Alternative — subdomain:** e.g. `dashboard.restormel.dev` → CNAME to Cloud Run; then link to that URL from the site. No Worker env var needed.

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

## 5.1 Troubleshooting: 401 on /keys/dashboard

If **restormel.dev/keys/dashboard** (or the path where the dashboard is proxied) returns **401 Unauthorized**:

0. **Proxy enabled** — The in-repo Worker (`apps/site/worker.js`) proxies when **KEYS_DASHBOARD_URL** is set. In Cloudflare: **Workers & Pages** → **restormel-site** → **Settings** → **Variables** → set **KEYS_DASHBOARD_URL** to your Cloud Run URL (from `pulumi stack output dashboardServiceUrl`). Deploy with `cd apps/site && pnpm build && npx wrangler deploy` (Worker flow); Pages-only deploy does not run the proxy.

1. **Proxy target**  
   If you use a Cloudflare route to proxy `/keys/dashboard` to Cloud Run, the target must be the **direct Cloud Run URL** from `cd infra && pulumi stack output dashboardServiceUrl`. The dashboard app uses base path `/keys/dashboard`, so the backend must receive paths like `/keys/dashboard` and `/keys/dashboard/api/health`. Do **not** point the proxy at a load balancer or URL that requires IAM; the Cloud Run service is configured with public invoker (`allUsers` in infra).

2. **Use direct Cloud Run until the proxy works**  
   You can open the dashboard at `https://<dashboardServiceUrl>/keys/dashboard` (e.g. `https://keys-dashboard-XXXXXXXX.europe-west2.run.app/keys/dashboard`). For Zuplo, set **KEYS_BACKEND_URL** to that base (no trailing slash) so the gateway forwards to Cloud Run directly.

3. **401 from dashboard API in the browser**  
   If the 401 is from a **dashboard API** call (e.g. `GET /keys/dashboard/api/projects`) when using the UI, that is expected when not logged in. Sign in with GitHub via the dashboard; the session cookie then authenticates API requests.

---

## 5.2 Troubleshooting: 500 on Sign in with GitHub / dashboard links

**500 or `auth/invalid-api-key` when clicking “Sign in with GitHub”:**

1. **Firebase client config (auth/invalid-api-key)** — The client bundle is built with `PUBLIC_FIREBASE_API_KEY`, `PUBLIC_FIREBASE_AUTH_DOMAIN`, `PUBLIC_FIREBASE_PROJECT_ID`. These must be set as **GitHub Actions secrets** and passed as Docker build args so the dashboard image includes them. Add those three secrets in GitHub → Settings → Secrets and variables → Actions, then re-run the deploy workflow (or push a commit so the dashboard image is rebuilt). See phase-3-manual-steps A4 and B4.
2. **Dashboard image** — The dashboard must be built and deployed to Cloud Run with the Firebase Admin change that uses `GOOGLE_APPLICATION_CREDENTIALS` (see `apps/dashboard/src/lib/server/firebase-admin.ts`). Redeploy the dashboard (CI or `gcloud run deploy`) so the new code is live.
3. **Firebase authorized domains** — In [Firebase Console](https://console.firebase.google.com) → your project → **Authentication** → **Settings** → **Authorized domains**, add **`restormel.dev`** (and `www.restormel.dev` if you use it). Without this, Firebase can block the popup or token and the session endpoint may fail.
4. **Cloud Run secret** — Ensure the dashboard service has the Firebase Admin secret mounted and the service account can read it (run `./infra/grant-firebase-secret-access.sh` if needed). Check Cloud Run logs for the request to `POST /keys/dashboard/api/auth/session` for the actual error.

**Sidebar links (Overview, Projects, Billing, Settings) “not working”:**  
When not signed in, those links load the same shell and show “Sign in to use the dashboard” — that is expected. After you sign in, they load the real pages. If they 404 or fail when clicked, confirm the dashboard was redeployed and that you’re opening `restormel.dev/keys/dashboard/...` (proxy and Worker env var set).

---

## 6. Verify

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
