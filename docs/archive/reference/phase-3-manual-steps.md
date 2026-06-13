# Phase 3 — Manual actions required

This document lists **all** manual actions required to complete Phase 3 of the Restormel Keys project (site, dashboard, pricing, Zuplo, deployment). It follows the template in [09-prompt-pack-phase-3.md](09-prompt-pack-phase-3.md) § Manual actions required. Beginner-friendly, step-by-step. **Menu names in third-party UIs may vary slightly.**

---

## 1. What you need to do now

Do these in the order below. Skip a step only if the note says “optional” or “when you’re ready.”

### A. GCP and Pulumi (legacy, only if you need rollback)

**A1. Create or select a GCP project.**

1. Go to [Google Cloud Console](https://console.cloud.google.com).
2. Click the project dropdown (top bar) → **New Project** (or select an existing project).
3. **Project name:** e.g. `restormel-keys-prod`. Note the **Project ID** (e.g. `restormel-keys-prod`).
4. Click **Create** (or **Select**). You will use the Project ID in Pulumi and GitHub secrets.

**A2. Enable required APIs.**

1. In the same console, open **APIs & Services** → **Library** (or search “APIs & Services”).
2. Search for and **Enable** each of: **Artifact Registry API**, **Cloud Run Admin API**, **Compute Engine API**. Enable **Secret Manager API** if you will store secrets in GCP.
3. Wait until each shows “API enabled.” You do not need to paste anything back.

**A3. Pulumi: login and create/select stack.**

1. In a terminal, run: `pulumi login`. If you use the Pulumi web backend, open the URL it prints and complete sign-in.
2. In the repo root, run: `cd infra && pulumi stack select production` (or `pulumi stack init production` if the stack does not exist).
3. Set config: `pulumi config set gcp:project YOUR_PROJECT_ID` (use the Project ID from A1). Optionally: `pulumi config set domain restormel.dev` when you are ready for custom domain.
4. **Only if you are intentionally running the legacy GCP stack:** Before `pulumi up`, run `pnpm run build` in `infra` (Pulumi runs the compiled output; a stale build can cause wrong resources or 403). See **Before any pulumi up** in `infra/README.md`. Then run `pulumi preview` and `pulumi up` and confirm. Note the outputs (e.g. `dashboardServiceUrl`) for later steps. Configure dashboard secrets (DATABASE_URL, NEON_AUTH_BASE_URL) per infra/README and section B below. For normal operation, the dashboard is deployed by Vercel, not this stack.
5. **Do not** commit `Pulumi.production.yaml` if it contains secrets; use `pulumi config set --secret` for any secret values.

**A4. GitHub secrets for deploy (CI).**

1. Go to your repo on GitHub → **Settings** → **Secrets and variables** → **Actions**.
2. Add **Repository secrets** (if not already present from Phase 1):
   - **GCP_PROJECT_ID** — value: your GCP Project ID (e.g. `restormel-keys-prod`).
   - **WIF_PROVIDER** and **WIF_SERVICE_ACCOUNT** — follow [Google Workload Identity Federation](https://github.com/google-github-actions/auth#setting-up-workload-identity-federation) so the deploy workflow can authenticate to GCP without a key file. Copy the provider name and service account email into these two secrets.
   - **Dashboard (Neon Auth + Neon DB):** For CI deploy, the dashboard image does not need build-time secrets. At **runtime**, Cloud Run needs `DATABASE_URL`, `NEON_AUTH_BASE_URL` (set via Pulumi secret refs or Cloud Run env). GitHub OAuth is configured in Neon Console. See section B (Neon and Neon Auth).
3. **Never** commit these values. They stay only in GitHub Actions secrets.
4. If deploy fails with “Artifact Registry” or “Cloud Run” permission errors, see `docs/domain-mapping-restormel-dev.md` §9 (grant the deploy identity **Artifact Registry Writer**, **Cloud Run Admin**, and **Service Account User** on `keys-dashboard-sa`).

---

### B. Neon and Neon Auth (dashboard data + GitHub sign-in)

**B1. Neon (Postgres).**

1. Create a project at [Neon](https://neon.tech) and a database.
2. Copy the **connection string** (e.g. `postgresql://user:pass@host/dbname?sslmode=require`). Store it in GCP Secret Manager (e.g. secret name `neon-database-url`) or set as Cloud Run env `DATABASE_URL`. For Pulumi: `pulumi config set DATABASE_URL_SECRET_REF neon-database-url` (or the secret name you use).
3. Run the dashboard migrations once against this database:
   - From repo root: `psql "$DATABASE_URL" -f apps/dashboard/migrations/001_initial.sql` (and optionally `002_better_auth.sql` if you had in-app Better Auth; Neon Auth uses its own schema).
   - Or in Neon SQL Editor, paste and run the contents of each file in order.

**B2. Neon Auth (enable and get URL).**

1. In [Neon Console](https://console.neon.tech), open your project → branch → **Auth** → enable Auth and open **Configuration**.
2. Copy the **Auth base URL** (e.g. `https://ep-xxx.neonauth.region.aws.neon.tech/neondb/auth`). Set it as Cloud Run env `NEON_AUTH_BASE_URL` (or store in Secret Manager and set `NEON_AUTH_BASE_URL_SECRET_REF` in Pulumi).
3. In the same Auth section, add **GitHub** as an OAuth provider: enter your GitHub OAuth App **Client ID** and **Client Secret** (from B3). You do **not** set these in the dashboard env; they live in Neon Console.

**B3. GitHub OAuth App (for “Sign in with GitHub”).**

1. Go to [GitHub Developer Settings](https://github.com/settings/developers) → **OAuth Apps** → **New OAuth App** (or use an existing one).
2. **Authorization callback URL:** set to your **dashboard** auth callback: `https://restormel.dev/keys/dashboard/api/auth/callback/github`.
3. Note **Client ID** and **Client Secret**. Enter them in **Neon Console** (Auth → OAuth providers → GitHub). **Do not** commit the client secret or put it in app env.

Ensure Cloud Run has: `DATABASE_URL`, `NEON_AUTH_BASE_URL`. Use Pulumi config `*_SECRET_REF` for each if stored in Secret Manager (see `infra/README.md`). You do **not** need to paste the actual secrets back into Cursor; only confirm that you have set them where the dashboard runs and in Neon Console.

---

### C. Paddle (pricing and checkout)

**Reusing existing Paddle (SOPHIA / Allotment Technology Ltd)**  
Paddle is already configured for SOPHIA (sandbox and prod) under the same vendor. Reuse the same account and copy existing values into restormel-keys as follows:

| What you have (SOPHIA sandbox) | Where it goes in restormel-keys |
|--------------------------------|----------------------------------|
| **Client-side token** | **Site:** `PUBLIC_PADDLE_CLIENT_TOKEN` (Cloudflare Pages → Environment variables, or local `apps/site/.env`). |
| **API key** (server-side) | **Dashboard:** Create a GCP Secret Manager secret (e.g. `paddle-api-key`) with the key value; set Pulumi config `PADDLE_API_KEY_SECRET_REF=paddle-api-key` (or whatever secret name you use). |
| **Webhook secret** | **Dashboard:** Add a **new** webhook in Paddle for the Keys dashboard URL (see C2). Use that webhook’s **Endpoint secret key** in a GCP secret (e.g. `paddle-webhook-secret`) and set `PADDLE_SECRET_REF` to that secret name. (SOPHIA’s webhook URL is different, so Keys needs its own webhook and thus its own endpoint secret.) |
| **Sandbox price ID** (e.g. SOPHIA-CHECKOUT-SANDBOX or the actual `pri_...` id) | **Site (optional):** `PUBLIC_PADDLE_SANDBOX_PRICE_ID`. Lets the pricing page open Paddle checkout with that price when the dashboard is not yet available. |
| — | **Site:** `PUBLIC_KEYS_DASHBOARD_URL` = dashboard URL (e.g. `https://restormel.dev/keys/dashboard`). Needed so Subscribe buttons POST to `/api/billing/checkout`. |

No new Paddle account or client-side token is required; use the existing sandbox (and later prod) credentials.

**If you already have GCP secrets** (e.g. `RESTORMEL-SANDBOX-TOKEN`, `RESTORMEL-SANDBOX-SUBSCRIPTIONS`):  
- **Client token** (e.g. `RESTORMEL-SANDBOX-TOKEN`): use the secret’s value as `PUBLIC_PADDLE_CLIENT_TOKEN` for the **site** (Cloudflare Pages env or local `.env`). The dashboard does not need the client token.  
- **API key** (e.g. `RESTORMEL-SANDBOX-SUBSCRIPTIONS` if that’s where you stored the Paddle API key): point the **dashboard** at it via Pulumi: `pulumi config set PADDLE_API_KEY_SECRET_REF RESTORMEL-SANDBOX-SUBSCRIPTIONS` (use your actual secret name).  
- **Webhook secret:** you get this only after creating a **notification destination** in Paddle (C2 below). Create a new GCP secret with that value and set `PADDLE_SECRET_REF` to it.

**C0. Create Paddle catalog (products and prices) for Keys.**

Use the repo bootstrap script to create (or reuse) Paddle products and prices for Pro, Team, and Enterprise. Paddle recommends the Dashboard for catalog setup; the script is for automation. The script does **not** create webhooks — configure those in C2.

1. Ensure **PADDLE_API_KEY** is set (sandbox API key). From GCP:  
   `export PADDLE_API_KEY="$(gcloud secrets versions access latest --secret=paddle-api-key-sandbox --project=restormel-keys-prod)"`
2. From the repo root: `pnpm run bootstrap-paddle -- --force-create`  
   Use `--force-create` to skip discovery (avoids hangs on List prices in sandbox). Use `--dry-run` to preview.
3. Optional: write the generated price IDs to a file:  
   `pnpm run bootstrap-paddle -- --force-create --write-env=apps/dashboard/.env.paddle.generated`  
   Do **not** commit that file if it contains real price IDs; use it locally or copy values into env.
4. The script creates products **Restormel Keys Pro**, **Restormel Keys Team**, **Restormel Keys Enterprise** and prices in GBP and USD (monthly and annual for Pro and Team; monthly only for Enterprise). Default amounts: Pro £19/mo, £192/yr; Team £49/mo, £468/yr; Enterprise £149/mo (and USD equivalents). Override with env vars like `PADDLE_SETUP_KEYS_PRO_MONTHLY_GBP=1900` (amounts in minor units).
5. Copy the printed **env block** (price IDs) into your dashboard env. Price IDs are **not secrets** — env vars are fine; Secret Manager is optional if you want all Paddle config in one place.

**Alternative:** Create products and prices manually in Paddle Dashboard → Catalog → Products, then copy the `pri_...` IDs into your env.

**C1. Create or use a Paddle sandbox account.** *(Skip if reusing SOPHIA Paddle above.)*

1. Go to [Paddle](https://www.paddle.com) and sign up or log in.
2. Use **Sandbox** for Phase 3 (do **not** switch to production yet).
3. In Paddle Dashboard, open **Developer tools** → **Authentication** (or **API keys**). Create or copy a **Client-side token** (public) for your Paddle app. You will use this in the site and pricing page.

**C2. Set the webhook URL in Paddle (notification destination).**

In Paddle, webhooks are set up as **notification destinations** under **Developer tools → Notifications** (not a “Webhooks” menu).

1. In the **Paddle sandbox** dashboard, go to **Developer tools** (left sidebar or top) → **Notifications**.
2. Click **New destination**.
3. **Description:** e.g. `Restormel Keys sandbox`.
4. **Notification type:** URL (webhook endpoint).
5. **URL:** your dashboard billing webhook endpoint, e.g.  
   - Cloud Run at root: `https://<your-cloud-run-url>/api/billing/webhook`  
   - Dashboard: `https://restormel.dev/keys/dashboard/api/billing/webhook`  
   Use the same base URL/path as your checkout (where the site POSTs to `/api/billing/checkout`).
6. **API version:** leave default. **Usage type:** Platform only (or include Simulation if you want test events).
7. **Events:** tick at least `subscription.created`, `subscription.updated`, `subscription.canceled`, `transaction.completed` (and optionally `transaction.updated`).
8. Click **Save destination**. After saving, Paddle shows a **secret key** for this destination — copy it and create a new GCP Secret Manager secret (e.g. `paddle-webhook-secret-sandbox`) with that value; then set Pulumi config `PADDLE_SECRET_REF=paddle-webhook-secret-sandbox` (or your secret name).
9. **Do not** paste the secret into Cursor or the repo; store only in GCP and in Paddle.

If you don’t see **Developer tools** or **Notifications**, make sure you’re in the **sandbox** (toggle at top or in account settings) and that your role has access to developer settings.

**C3. Add Paddle-related env to the site and dashboard.**

1. **Site (e.g. Cloudflare Pages or build env):** Add `PUBLIC_PADDLE_CLIENT_TOKEN` (the client-side token from C1). Add `PUBLIC_KEYS_DASHBOARD_URL` (e.g. `https://restormel.dev` or your Cloud Run URL) so the pricing page knows where to POST for checkout. Optional: `PUBLIC_PADDLE_SANDBOX_PRICE_ID` for testing checkout without the dashboard. See `apps/site/.env.example`.
2. **Dashboard (Cloud Run or local):** Server-side Paddle env is wired via Pulumi and Secret Manager:
   - **PADDLE_API_KEY** — from Secret Manager (set `PADDLE_API_KEY_SECRET_REF` in Pulumi config to the secret name containing your Paddle API key).
   - **PADDLE_SECRET** (or **PADDLE_WEBHOOK_SECRET**) — webhook signing secret (set `PADDLE_SECRET_REF` to the Secret Manager secret name). Optionally set `PADDLE_ENVIRONMENT=sandbox` for Phase 3.
   - See `apps/dashboard/.env.example` for all variable names.
3. **Never** commit real tokens. Use env vars or secret managers only.

---

### D. Cloudflare Pages (site and docs)

**D1. Connect the repo to Cloudflare Pages.**

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com) → **Workers & Pages** → **Pages** → **Create project** → **Connect to Git**.
2. Select your Git provider and authorize if needed. Select the **repository** (e.g. `restormel/restormel-keys`) and **branch** (e.g. `main`).
3. Click **Begin setup**.

**D2. Set build configuration.**

1. **Project name:** e.g. `restormel-site`.
2. **Production branch:** `main` (or your default).
3. **Build settings:**
   - **Framework preset:** None (or Astro if listed).
   - **Build command:** From repo root use `pnpm install && pnpm --filter site build`, or from `apps/site` use `pnpm build`. Set **Root directory** to the repo root if you use the first form, or to `apps/site` if you use the second.
   - **Build output directory:** `apps/site/dist` (if root is repo) or `dist` (if root is `apps/site`).
4. **Environment variables (optional):** Add `PUBLIC_KEYS_DASHBOARD_URL` if the site needs it for pricing links. Do not add secrets here.
5. Click **Save and Deploy**. Wait for the first build to finish. Note the deployed URL (e.g. `https://restormel-site.pages.dev`).

**D3. Add custom domain.**

1. In the same Pages project, open **Custom domains** → **Set up a custom domain**.
2. Enter e.g. `restormel.dev` (and optionally `www.restormel.dev`). Follow Cloudflare’s instructions to add the CNAME or A record at your DNS provider. You will complete DNS in step E.

You do not need to paste build logs back into Cursor; only confirm the first deploy succeeded and the URL loads.

---

### E. DNS (restormel.dev → Cloudflare; dashboard → Cloud Run)

**E1. Point the apex domain to Cloudflare.**

1. At your DNS provider (e.g. where you bought `restormel.dev`), open the DNS settings for `restormel.dev`.
2. Add or update the record as Cloudflare instructed when you added the custom domain in D3 (typically a **CNAME** for the Pages hostname, or **A** records to Cloudflare’s IPs). Save.
3. Wait for propagation (minutes to hours). You can verify in Cloudflare Dashboard when the domain shows “Active.”

**E2. Enable /keys/dashboard proxy (Worker deploy).**

The site Worker (`apps/site/worker.js`) proxies `/keys/dashboard` to Cloud Run when `KEYS_DASHBOARD_URL` is set. You must deploy with the **Worker** flow (`pnpm build` then `npx wrangler deploy` from `apps/site`) and set the variable:

1. Get your Cloud Run URL: `cd infra && pulumi stack output dashboardServiceUrl` (e.g. `https://keys-dashboard-XXXXXXXX.run.app`).
2. In Cloudflare: **Workers & Pages** → **restormel-site** → **Settings** → **Variables** → add **KEYS_DASHBOARD_URL** = that URL (no trailing slash). Apply to Production (and Preview if needed).
3. Redeploy the Worker so the new variable is in effect (e.g. from repo: `cd apps/site && pnpm build && npx wrangler deploy`).

If you use **Pages-only** deploy (`wrangler pages deploy dist`) with no Worker, the proxy does not run; use **Option B** (subdomain) or switch to Worker deploy.

**Option B — Subdomain instead:** Use e.g. `dashboard.restormel.dev` and point it to Cloud Run via CNAME; then link to that URL from the site. No Worker env var needed.

If you see **401** on `/keys/dashboard`, see [Phase 3 deployment §5.1 — 401 on /keys/dashboard](phase-3-deployment.md#51-troubleshooting-401-on-keysdashboard) (proxy target, direct URL fallback, API auth).

You do not need to paste DNS records back into Cursor; only confirm that `https://restormel.dev` serves the site and that the dashboard is reachable at your chosen path or subdomain.

---

### F. Zuplo gateway (optional for Phase 3 gate)

**F1. Create Zuplo project and configure.**

1. Follow the full runbook: [docs/runbooks/zuplo-setup.md](../runbooks/zuplo-setup.md).
2. In short: log in to [Zuplo](https://zuplo.com) → create project **`restormel-keys-gateway`** → add route proxying to your Cloud Run dashboard URL → attach inbound policies (api-key-inbound → rate-limit-inbound → quota-inbound → inject-backend-auth) in that order → set **KEYS_BACKEND_API_KEY** in Zuplo env (secret; value is a Gateway Key from the dashboard Access page; env var name kept for compatibility) → configure developer portal with OpenAPI.
3. **Never** paste `KEYS_BACKEND_API_KEY` (Gateway Key) or consumer keys into Cursor. Store them only in Zuplo and in your secret manager or dashboard.

**F2. Validate.**

1. Call Zuplo with no key → expect 401.
2. Call Zuplo with a valid consumer key → expect 200 (or the appropriate API response).
3. Call the Cloud Run URL directly with a `zpka_` key → backend should return 401/403.

---

## 2. What to bring back into Cursor

- **GCP Project ID** — Only if you need Cursor to add it to a config file (e.g. a non-committed example); otherwise keep it in Pulumi config and GitHub secrets only.
- **Neon / Neon Auth:** Do **not** paste `DATABASE_URL` or Neon Auth URL into Cursor. Confirm that you have set the required env vars (or Secret Manager refs) where the dashboard runs; GitHub credentials live in Neon Console.
- **Paddle:** Do **not** paste the client token or webhook secret into Cursor unless you are adding them to a local `.env.example` with placeholders; real values stay in env/secret manager only.
- **Cloudflare:** No need to paste anything back; confirm the Pages deploy URL and that the custom domain is active.
- **DNS:** No need to paste records back; confirm that the site and dashboard URLs resolve as expected.
- **Zuplo:** Do **not** paste `KEYS_BACKEND_API_KEY` or consumer keys. You can paste the **Zuplo project URL** (e.g. `https://restormel-keys-gateway.<region>.zuplo.app`) if you want it documented in a non-secret config or doc.
- **Confirmation:** Tell Cursor that you have completed the manual steps (which sections: A–F) and whether deploy, Paddle, and Zuplo validation succeeded or where they failed.

If nothing needs to be brought back, you can simply say: “Phase 3 manual steps done; deploy and Paddle webhook are configured; Zuplo is set up [or skipped].”

---

## 3. What to do with any code or files

- **Pulumi config:** Keep `infra/Pulumi.production.yaml` (or stack state) out of commits if it contains secrets. Use `pulumi config set --secret` for sensitive values. Commit only non-secret config (e.g. `gcp:project`, `domain`).
- **Environment files:** If you create a local `.env` or `.env.local` for the dashboard or site, add them to `.gitignore` and do not commit. You may add a `.env.example` with placeholder names (e.g. `DATABASE_URL=`, `NEON_AUTH_BASE_URL=`) and commit that.
- **GitHub secrets:** Values stay in GitHub only. No file in the repo should contain them.
- **Zuplo:** No code or files need to be added to the repo for Zuplo; the runbook and this doc are sufficient. If you add an OpenAPI spec to the repo (e.g. `docs/api/openapi.yaml`), commit that; do not commit any Zuplo API keys or tokens.

---

## 4. What to ask Cursor next

After completing the manual steps, you can send:

```
Phase 3 manual steps are done. I’ve completed [list which: GCP/Pulumi, Firebase, Paddle, Cloudflare, DNS, Zuplo]. Deploy [succeeds / fails with: …]. Paddle webhook is [set / not set]. Zuplo [is configured and validated / skipped]. Please [update the deployment runbook with any fixes / add a verification checklist for the gateway / document the final URLs in STATUS or ROADMAP].
```

Or, if something failed:

```
Phase 3 manual step [letter/number] failed: [paste the error or describe what you see]. I have [not] added the GitHub secrets / Firebase env / Paddle webhook. What should I do next?
```

---

## 5. Safety checks before continuing

- [ ] **Secrets:** No GCP keys, Firebase private keys, Paddle tokens, or Zuplo `KEYS_BACKEND_API_KEY` are committed or pasted into the repo or into Cursor chat. They are only in GitHub Actions secrets, Cloud Run env/Secret Manager, Cloudflare env, Zuplo env, or local `.env` (gitignored).
- [ ] **Paddle:** Still on **Sandbox**; production is not enabled. Webhook URL points to your dashboard billing endpoint and is saved in Paddle.
- [ ] **Deploy:** A push to `main` (or your deploy branch) triggers the deploy job and the dashboard image builds and deploys to Cloud Run, or you have run the deploy steps locally and confirmed `/api/health` returns 200.
- [ ] **Site:** The site builds on Cloudflare Pages and the custom domain (e.g. `restormel.dev`) loads the marketing site and docs. The pricing page loads and the “Subscribe” flow opens Paddle (or shows the expected redirect if dashboard URL is unset).
- [ ] **Dashboard:** You can open the dashboard at your configured URL, sign in with GitHub, create a project, and create a Gateway Key (Access). No raw keys are logged or displayed after creation.
- [ ] **Zuplo (if configured):** A request to Zuplo with a valid consumer key returns 200; a request with no key or invalid key returns 401; a direct request to Cloud Run with a `zpka_` key is rejected.

If any check fails, fix that step (or ask Cursor to help) before treating Phase 3 deployment as complete.

---

## No manual actions for code-only Phase 3 work

If you have **not** yet deployed or connected any external services (GCP, Firebase, Paddle, Cloudflare, Zuplo), and you are only implementing the Phase 3 prompts (site, landing, pricing, dashboard, docs polish, runbooks), then **no manual actions are required** for that code-only work. You can deploy and configure services later using this document and [phase-3-deployment.md](phase-3-deployment.md) when you are ready.
