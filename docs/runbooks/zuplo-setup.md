# Zuplo gateway setup — Restormel Keys (Prompt 3.6)

This runbook sets up the **Zuplo API gateway** for the Keys cloud API. External clients call Zuplo with **consumer keys** (`zpka_...`); Zuplo validates them, applies policies, and forwards requests to the **dashboard backend** (Cloud Run) using a single **backend API key** (`sk-rk-...`).

**Gate:** External call through Zuplo → Cloud Run returns 200. Developer portal shows API docs.

**DO NOT:** Modify the dashboard backend to add Zuplo-specific logic. Consumer keys never hit the backend directly; only the backend key is sent to Cloud Run.

---

## Quick Start (10–15 min, CLI-first)

**Single path:** Use the CLI from `zuplo-gateway/` for deploy and env vars; use the Portal (or browser MCP) only where the CLI cannot do the step.

| Step | Action | Where |
|------|--------|--------|
| 1 | Create Zuplo project **`restormel-keys-gateway`** (once) | [Portal](https://portal.zuplo.com) — no CLI equivalent. |
| 2 | Get **required values** (see table below) | Portal + infra/dashboard. |
| 3 | Copy `zuplo-gateway/.env.example` → `.env`, fill in the three required vars | Local. |
| 4 | Run **setup + deploy** for **main**, then **working-copy** if you use it | `./scripts/setup-from-cli.sh` (see [zuplo-launch-cli.md](zuplo-launch-cli.md)). |
| 5 | Create at least one **consumer** and get a `zpka_...` key | Portal → API Key Service, or `./scripts/create-consumer-and-test.sh`. |
| 6 | Run **launch validation** | `./scripts/launch-checklist.sh` (see [zuplo-launch-cli.md](zuplo-launch-cli.md)). |
| 7 | **Portal-only:** Enable Developer Portal, import [docs/api/openapi.yaml](../api/openapi.yaml) | Portal (or browser MCP fallback). See [zuplo-launch-cli.md § Portal-only steps](zuplo-launch-cli.md#portal-only-steps). |

**Execution runbook:** For the exact commands and order (main then working-copy), use **[zuplo-launch-cli.md](zuplo-launch-cli.md)**.

---

## Where to get each value

Use this table to fill `zuplo-gateway/.env` and any script env. **Do not commit real values.**

| Variable | Where to get it |
|----------|-----------------|
| **ZUPLO_API_KEY** | Zuplo Portal → **Settings** → **API Keys**. Create or copy a key with access to the project. |
| **KEYS_BACKEND_URL** | Backend base URL, **no trailing slash**. Example: `https://<dashboardServiceUrl>/keys/dashboard` where `<dashboardServiceUrl>` is from `cd infra && pulumi stack output dashboardServiceUrl`. If using a custom domain: `https://restormel.dev/keys/dashboard`. |
| **KEYS_BACKEND_API_KEY** | Create in the **Keys dashboard** (Cloud Run): log in → create/select a project → create an API key. Use that key only in Zuplo (as secret). Format: `sk-rk-...`. |
| **ZUPLO_ACCOUNT_NAME** | From the Portal URL: `portal.zuplo.com/<ACCOUNT_NAME>/restormel-keys-gateway`. Example: `silver_profitable_wasp`. |
| **ZUPLO_PROJECT_NAME** | `restormel-keys-gateway` (default in scripts). |
| **ZUPLO_BRANCH** | Environment name: `main` or `working-copy` (or your branch name). Scripts default to `main`. |
| **ZUPLO_BUCKET_NAME** | Portal → **Project** → **Settings** → **Project Information** (API Key bucket ID), or same as `bucketName` in `zuplo-gateway/config/policies.json` (e.g. `zprj-...-production`). Required for `create-consumer-and-test.sh`. |
| **GATEWAY_URL** | After deploy: Portal → **Environments** → select env (e.g. main) → copy **Gateway** URL (e.g. `https://restormel-keys-gateway-main-XXXX.zuplo.app`). |
| **ZUPLO_CONSUMER_KEY** | After creating a consumer: the `zpka_...` key (shown once). Put in `.env` for `test-gateway.sh` / `launch-checklist.sh`. |

---

## 1. Create Zuplo project

1. Log in to [Zuplo](https://zuplo.com) (or your Zuplo host).
2. Create a new project: **`restormel-keys-gateway`**.
3. Note the project URL (e.g. `https://restormel-keys-gateway.<region>.zuplo.app`).

---

## 2. Configure routes (proxy to Cloud Run)

In the Zuplo project, open **Code** → **routes.oas.json** and use the **Route Designer** (or click **Add** to add a new route). Fill in every field as below.

### 2.1 Route Designer — field-by-field

| Field | What to enter | Notes |
|-------|----------------|--------|
| **Path** | `/*` | Wildcard: all paths hit this route. To expose only the API, use `/v1/*` and set **Forward to** so the backend receives the path it expects (see path rewrite below). |
| **Method** | `GET` (and add routes for `POST`, `PUT`, `PATCH`, `DELETE` if your API uses them) | Or use a single route with path `/*` and leave Method as `GET` only if you use the URL Forward handler for all methods (URL Forward forwards the incoming method). For a full REST API, add one route per method with the same path, or use a path that matches all methods depending on Zuplo’s route model. |
| **Summary** | e.g. `Keys API proxy` | Shown in docs; descriptive label. |
| **Operation ID** | (read-only) | Auto-generated (e.g. `new-route-ee8e252f`). Do not change. |
| **Deny All Origins (CORS)** | Uncheck if clients call from browsers; check to deny all origins. | For server-to-server only, denying CORS is fine. |
| **Request Handler** | **URL Forward** | Choose from the Handler dropdown. |
| **Forward to** | Your backend base URL. Use an env var for per-environment config. | See below. |

**Forward to (Request Handler URL):**

- **Option A — Direct Cloud Run:**  
  `https://keys-dashboard-<hash>.europe-west2.run.app`  
  (Use the exact URL from Pulumi output `dashboardServiceUrl`.)
- **Option B — Env var (recommended):**  
  `${env.KEYS_BACKEND_URL}`  
  Then in **Settings** → **Environment Variables**, add `KEYS_BACKEND_URL` with value = your Cloud Run or canonical dashboard URL (e.g. `https://restormel.dev/keys/dashboard` or the direct Run URL). No trailing slash.
- **Path behavior:** URL Forward appends the **incoming path** to this base. So if a client calls the gateway at `https://your-gateway.zuplo.app/v1/health`, the backend receives `https://<KEYS_BACKEND_URL>/v1/health`. Your backend must expect that path (e.g. `/v1/health`) or you need a path rewrite (see [URL Rewrite Handler](https://zuplo.com/docs/handlers/url-rewrite) if the gateway path and backend path differ).

**Path alignment with dashboard:**

- The dashboard is served under base path `/keys/dashboard`; API routes are `/keys/dashboard/api/health`, `/keys/dashboard/api/projects`, etc. (see [phase-3-deployment](../reference/phase-3-deployment.md)).
- If the gateway exposes `https://gateway.zuplo.app/v1/*`, set **Forward to** to a base that yields `/keys/dashboard/api/...` on the backend. For example, if backend base is `https://restormel.dev`, use **Forward to** = `https://restormel.dev/keys/dashboard` so that gateway path `/v1/health` becomes backend path `/v1/health` (still wrong unless your app serves `/v1/health`). To get `/keys/dashboard/api/health`, you either expose gateway path `/*` with Forward to `https://restormel.dev/keys/dashboard` and call gateway as `https://gateway.zuplo.app/api/health`, or use URL Rewrite to map `/v1/*` → `/keys/dashboard/api/*`.

**Practical recommendation:** Set **Path** = `/*`, **Forward to** = `https://restormel.dev/keys/dashboard` (or `${env.KEYS_BACKEND_URL}` with that value). Then client calls `https://<gateway>/api/health`, `https://<gateway>/api/projects`, etc., and the backend receives `/api/health`, `/api/projects` under the dashboard app (which serves at `/keys/dashboard`); the Host header and path the app sees depend on your Cloud Run/proxy setup—ensure the dashboard is configured to serve API at `/keys/dashboard/api/*` and that the URL you put in **Forward to** includes `/keys/dashboard` so the first path segment is correct.

### 2.2 Path rewrite (if gateway path ≠ backend path)

If the gateway exposes `/v1/*` but the backend expects `/keys/dashboard/api/*`, use the **URL Rewrite** handler instead of URL Forward, or add a route that forwards to a base URL that already includes the path prefix. See Zuplo docs: [URL Forward](https://zuplo.com/docs/handlers/url-forward), [URL Rewrite](https://zuplo.com/docs/handlers/url-rewrite). Keep the runbook’s path logic consistent with [phase-3-deployment](../reference/phase-3-deployment.md).

---

## 3. Inbound policies (order matters)

Attach the following **inbound** policies to the route, in this order:

| Order | Policy | Purpose |
|-------|--------|---------|
| 1 | **api-key-inbound** | Validate Zuplo consumer API key; reject missing or invalid keys (401). |
| 2 | **rate-limit-inbound** | Apply rate limits per consumer key. |
| 3 | **quota-inbound** | Enforce quota (e.g. daily/monthly) per consumer key. |
| 4 | **inject-backend-auth** | Add `Authorization: Bearer <KEYS_BACKEND_API_KEY>` (or equivalent header) before forwarding to Cloud Run. |

Create each policy in the Zuplo dashboard if it does not exist (same pattern as SOPHIA’s `sophia-api-gateway`). The backend must accept only the injected backend key and must **reject** Zuplo consumer keys (`zpka_...`) if they are sent directly to the backend (see §7).

---

## 4. Backend API key (Zuplo env)

1. Create a **backend API key** for server-to-server calls from Zuplo to Cloud Run. This key must be in the format used by your backend (e.g. `sk-rk-<random>`). Store it in your secrets manager; do not commit it.
2. In the Zuplo project, open **Settings** → **Environment Variables** (or **Secrets**).
3. Add a variable:
   - **Name:** `KEYS_BACKEND_API_KEY`
   - **Value:** the backend key (e.g. `sk-rk-...`).
   - **Mark as secret** so it is not shown in logs or the UI.
4. Configure the **inject-backend-auth** policy to use this variable (e.g. set the `Authorization` header to `Bearer ${KEYS_BACKEND_API_KEY}`).

The dashboard backend must accept this key for programmatic API requests. It must **not** accept Zuplo consumer keys (`zpka_...`) on direct calls to Cloud Run.

---

## 5. Developer portal and OpenAPI spec

1. In Zuplo, open **Developer Portal** (or **Docs**).
2. Enable the developer portal for the project.
3. Add or link an **OpenAPI spec** that describes the Keys cloud API (projects, project keys, health). You can:
   - **Use the canonical spec** in this repo: [docs/api/openapi.yaml](../api/openapi.yaml) — import or paste it into Zuplo Developer Portal (Portal → Developer Portal → add/import spec). Update the **Servers** URL in the portal to your gateway URL (e.g. from Environments → main → Gateway) if needed.
   - Or write a minimal OpenAPI (paths for `/api/health`, `/api/projects`, `/api/projects/{id}`, `/api/projects/{id}/keys`), or use an exported spec from the dashboard if one exists.
4. Configure the portal to show authentication (API key in header or query) and example requests so developers can try the API.

**Gate:** Developer portal is live and shows the API docs.

---

## 6. Create backend API key (via dashboard)

1. In the **Keys dashboard** (Cloud Run), log in and create or select a project.
2. Create an **API key** for the project (or use a dedicated “gateway” project). This key is the one you will use as **KEYS_BACKEND_API_KEY** in Zuplo (§4).
3. Store the key securely; configure it in Zuplo as in §4. The backend must accept this key for requests that Zuplo forwards (inject-backend-auth).

---

## 7. Validation

Run these checks to meet the gate:

| Check | Expected |
|-------|----------|
| **Missing auth** | Request to Zuplo with no API key → **401** from Zuplo. |
| **Invalid key** | Request to Zuplo with invalid or revoked consumer key → **401** from Zuplo. |
| **Valid consumer key** | Request to Zuplo with valid consumer key → Zuplo forwards to Cloud Run with backend key → **200** (or appropriate response) from backend. |
| **Direct backend rejects zpka_** | Request **directly** to Cloud Run (bypassing Zuplo) with `Authorization: Bearer zpka_...` → backend returns **401** or **403** (backend must not accept Zuplo consumer keys). |

**Important:** Opening the **gateway URL** (e.g. `https://restormel-keys-gateway-main-….zuplo.app/`) in a browser with no API key will always return **401 Unauthorized — No Authorization Header**. That is expected. Use the **Dev Portal** URL for docs and “Try it”; call the gateway with a consumer key in the `Authorization` header (or as configured in your API Key policy) for API requests.

Ensure the dashboard backend is configured so that:

- It accepts the **backend key** (`sk-rk-...`) for server-to-server calls (e.g. from Zuplo).
- It **rejects** Zuplo consumer keys (`zpka_...`) when they are sent directly to the backend (so clients cannot bypass Zuplo).

---

## Launch readiness checklist

Use this checklist to confirm Zuplo is **fully configured for launch**. Complete every item for the environment(s) you ship.

| # | Item | How to verify / notes |
|---|------|------------------------|
| 1 | **Project** | Zuplo project **`restormel-keys-gateway`** exists. Portal or CLI. |
| 2 | **Routes** | Routes deployed: path `/(.*)` (url-pattern), URL Forward to `${env.KEYS_BACKEND_URL}`, methods GET, POST, PUT, PATCH, DELETE. Code → routes.oas.json matches §2 and §8.3. |
| 3 | **Policies** | All four inbound policies attached in order: api-key-inbound → rate-limit-inbound → quota-inbound → inject-backend-auth. Code → policies.json. **API key bucket:** `api-key-inbound` uses a `bucketName` that is project-specific. If you created the project in the portal, the bucket ID is in Portal → Project → Settings → Project Information (or API Key Service). If deploy fails or keys are rejected, ensure `config/policies.json` uses the bucket for this project (or define policies in the Portal and export per §8.5). |
| 4 | **Env vars (per environment)** | For **main** (and for **Working Copy** or any other branch environment you use): **KEYS_BACKEND_URL** (backend base URL, no trailing slash), **KEYS_BACKEND_API_KEY** (secret, `sk-rk-...`). Portal → Settings → Environment Variables, or CLI `zuplo variable create/update` per §8.6. |
| 5 | **Backend key** | Backend API key created in the Keys dashboard (Cloud Run); same key set as **KEYS_BACKEND_API_KEY** in Zuplo. Backend accepts this key and rejects `zpka_...` on direct calls (§7). |
| 6 | **Developer portal** | Developer portal **enabled**. OpenAPI spec **added or imported** (e.g. from [docs/api/openapi.yaml](../api/openapi.yaml) or a minimal spec with paths `/api/health`, `/api/projects`, etc.). Portal shows API reference and auth (API key) so developers can try the API. §5. |
| 7 | **At least one consumer** | At least one API key **consumer** created (Portal → API Key Service or script `zuplo-gateway/scripts/create-consumer-and-test.sh`). Clients use the issued `zpka_...` key to call the gateway. |
| 8 | **Validation (§7)** | All four checks passed: no key → 401; invalid key → 401; valid key → 200 (or appropriate backend response); direct backend with `zpka_...` → 401/403. |
| 9 | **Other environments** | If you use **Working Copy** (or any non-main branch environment): that environment has the **same** routes and policies (same `routes.oas.json` in the branch or same deploy), and **env vars set for that environment**. Otherwise you see “no routes” or holding page. §11. |
| 10 | **CORS** | If clients call the gateway **from a browser**, CORS is configured (e.g. route not “Deny All Origins”). For server-to-server only, default is fine. §2.1. |

When all items are done, Zuplo is ready for launch: gateway returns 401 without a key, 200 with a valid consumer key; dev portal shows docs; backend receives only the backend key.

---

## Summary

| Item | Value |
|------|--------|
| Zuplo project | `restormel-keys-gateway` |
| Backend | Cloud Run dashboard URL (e.g. `https://keys-dashboard-<hash>.run.app` or canonical URL with `/keys/dashboard` base path). |
| Policy chain | api-key-inbound → rate-limit-inbound → quota-inbound → inject-backend-auth |
| Backend key env | `KEYS_BACKEND_API_KEY` (secret; `sk-rk-...`) |
| Consumer keys | Issued by Zuplo; used by clients; never sent to backend. |
| Direct backend | Must reject `zpka_` keys. |

For deployment of the dashboard and site, see [phase-3-deployment](../reference/phase-3-deployment.md).

---

## 8. Deployment checklist (zuplo-gateway / config-as-code)

Use this checklist so deployment matches Zuplo’s expectations and avoids build failures. The in-repo project is **`zuplo-gateway/`**.

| # | Check | Zuplo guidance / notes |
|---|--------|-------------------------|
| 1 | **zuplo.jsonc** at project root | `version: 1`, `compatibilityDate` (e.g. `2025-02-06`), `projectType: "managed-edge"`. See [zuplo.jsonc](https://zuplo.com/docs/programmable-api/zuplo-json). |
| 2 | **tsconfig.json** at project root | Required by the build. Use Zuplo’s [recommended tsconfig](https://zuplo.com/docs/articles/tsconfig): `include` for `modules/**/*`, `.zuplo/**/*`, `tests/**/*`; `compilerOptions` as in the doc. |
| 3 | **config/routes.oas.json** | Path: use **url-pattern** mode for catch-all, e.g. path `"/(.*)"` with `x-zuplo-path.pathMode: "url-pattern"` ([routing](https://zuplo.com/docs/articles/routing)). Handler: `urlForwardHandler`, `baseUrl`: `"${env.KEYS_BACKEND_URL}"`, `forwardSearch: true`, `followRedirects: false` ([URL Forward](https://zuplo.com/docs/handlers/url-forward)). |
| 4 | **config/policies.json** | Build schema can reject custom root keys. If the build fails with “additionalProperties” or “must be object”, see [§8.5 Troubleshooting: policies.json](#85-troubleshooting-policiesjson-build-failures). |
| 5 | **Environment variables** (in Zuplo) | `KEYS_BACKEND_URL` (backend base URL, no trailing slash), `KEYS_BACKEND_API_KEY` (secret). Set in Portal → Settings → Environment Variables or via CLI/API. |
| 6 | **Placeholder dirs** (optional) | Empty `modules/`, `.zuplo/`, `tests/` satisfy tsconfig `include`; avoids warnings. |
| 7 | **API key bucket** | The `api-key-inbound` policy in `config/policies.json` has a `bucketName` (e.g. `zprj-...-production`) that is **project-specific**. If you created the Zuplo project in the portal, get the bucket name from Portal → Project → Settings → Project Information (or API Key Service) and set it in `policies.json` before deploy; otherwise the build or key validation may fail. See also Launch readiness checklist item 3. |

After a successful build, create at least one API key consumer (Portal or API) and run the validation steps in §7.

### 8.5 Troubleshooting: policies.json build failures

The Zuplo build validates `config/policies.json` against an internal schema. If you see errors like **“must NOT have additional properties”** or **“must be object”**:

1. **Portal-first (recommended):** In the Zuplo project, use the **Route Designer** (Code → routes.oas.json) to add the four policies (API Key, Rate Limit, Quota, Set Headers) to the route. Save. Then use **Source Control** (or “Commit & push” / export) so Zuplo writes the correct `config/policies.json`. Copy that file into `zuplo-gateway/config/policies.json` and commit. Future CLI deploys will use the Portal-generated format.
2. **In-repo format:** The `zuplo-gateway/` folder currently uses a root object with key `policies` and value an array of policy objects. If the build accepts that, no change needed. If it rejects `policies`, do not add other root keys (e.g. `policyInstances`); use step 1 instead.
3. **Policy options:** Set Headers policy must use `$env(VAR_NAME)` for secret values ([Set Headers](https://zuplo.com/docs/policies/set-headers-inbound)); URL Forward uses `${env.VAR_NAME}` in `baseUrl` ([environment variables](https://zuplo.com/docs/articles/environment-variables)).

---

## 8.6 Complete setup from CLI (one script)

To set Zuplo env vars and deploy from the repo without using the Portal for variables:

1. **Create the Zuplo project** once (if needed) in the [Portal](https://portal.zuplo.com) as **`restormel-keys-gateway`**, or use `zuplo init` / `zuplo link` from `zuplo-gateway/` to link this folder to an existing project.

2. **Get values:**
   - **ZUPLO_API_KEY** — Portal → Settings → API Keys.
   - **KEYS_BACKEND_URL** — Direct Cloud Run URL + `/keys/dashboard`, e.g. `https://keys-dashboard-XXXXXXXX.run.app/keys/dashboard` (from `cd infra && pulumi stack output dashboardServiceUrl`). No trailing slash.
   - **KEYS_BACKEND_API_KEY** — Backend key (`sk-rk-...`) from the dashboard (create an API key for a project; use it only in Zuplo as a secret).

3. **Run the setup script** from repo root:
   ```bash
   cd zuplo-gateway
   pnpm install
   # Set env (or copy .env.example to .env and fill in)
   export ZUPLO_API_KEY="<your-portal-api-key>"
   export KEYS_BACKEND_URL="https://<dashboardServiceUrl>/keys/dashboard"
   export KEYS_BACKEND_API_KEY="sk-rk-..."
   ./scripts/setup-from-cli.sh
   ```
   The script creates/updates `KEYS_BACKEND_URL` and `KEYS_BACKEND_API_KEY` in Zuplo for the `main` branch, then deploys with `--no-verify-remote` (required when the project lives in a monorepo subfolder). Optional: `ZUPLO_ACCOUNT_NAME`, `ZUPLO_PROJECT_NAME`, `ZUPLO_BRANCH`.

4. **Create a consumer** (Portal → API Key Service, or `./scripts/create-consumer-and-test.sh` with `ZUPLO_ACCOUNT_NAME`, `ZUPLO_BUCKET_NAME`, `GATEWAY_URL` set).

5. **Validate** per §7 (no key → 401, valid key → 200, direct backend rejects `zpka_`).

See [zuplo-gateway/README.md](../../zuplo-gateway/README.md) for `.env.example` and script details.

---

## 9. Automated setup (CLI, config-as-code, agent)

Zuplo has **no official MCP server or VS Code extension**. You can still drive setup from a Cursor agent or subagent using **config-as-code** plus the **Zuplo CLI** and optional **Developer API**.

### 9.1 How it works

- **Routes and policies** are defined in project files: `config/routes.oas.json`, `config/policies.json`, and optionally `zuplo.jsonc`. There is no REST API to create or edit routes; they live in the deployed bundle.
- **Deployment** is either:
  - **Git-based:** Connect the Zuplo project to a GitHub repo (Settings → Source Control). Push to the repo (or a branch) → Zuplo auto-deploys. An agent can edit the config files in-repo and push.
  - **CLI-based:** From a directory containing the Zuplo project files, run `zuplo deploy` (see [Custom CI/CD](https://zuplo.com/docs/articles/custom-ci-cd)). Requires `ZUPLO_API_KEY` (Settings → API Keys in the portal).
- **Environment variables** (e.g. `KEYS_BACKEND_URL`, `KEYS_BACKEND_API_KEY`) can be set:
  - In the portal (Settings → Environment Variables), or
  - Via **CLI:** `zuplo variable create` / `zuplo variable update` (see [Zuplo CLI](https://zuplo.com/docs/cli/overview)), or
  - Via **Developer API:** [Variables API](https://dev.zuplo.com/docs/api/variables) with your Zuplo API key.
- **API key consumers** (for issuing `zpka_...` keys to clients) can be created in the portal or via the [API Key API](https://zuplo.com/docs/articles/api-key-api) (e.g. create consumer with key for testing).

So an agent can:

1. **Create or update config in repo** — Edit or generate `config/routes.oas.json` and `config/policies.json` (see [Reference config](#82-reference-config-for-agent)) in a Zuplo project directory. This repo has a ready-made project at **`zuplo-gateway/`** (see [zuplo-gateway/README.md](../../zuplo-gateway/README.md)).
2. **Deploy** — Run `zuplo deploy` from that directory (with `ZUPLO_API_KEY` set), or push to the connected GitHub repo to trigger deploy.
3. **Set variables** — Run `zuplo variable create` / `zuplo variable update`, or call the Variables API, for `KEYS_BACKEND_URL` and `KEYS_BACKEND_API_KEY` (secret).
4. **Create a test consumer** — Use the Developer API to create a consumer with an API key for validation.

### 9.2 Reference config for agent

A Cursor agent or subagent can generate or update the Zuplo project from a known schema:

- **Project:** One Zuplo project (e.g. `restormel-keys-gateway`). Create once in the portal or with `zuplo project create --name restormel-keys-gateway` (CLI).
- **Routes** (`config/routes.oas.json`): OpenAPI-style `paths` with Zuplo extensions. Catch-all: path `"/(.*)"` with `x-zuplo-path.pathMode: "url-pattern"`; methods `get`, `post`, `put`, `patch`, `delete`; `x-zuplo-route` containing:
  - `handler`: URL Forward with `baseUrl`: `"${env.KEYS_BACKEND_URL}"`.
  - `policies.inbound`: array of policy names in order: api-key, rate-limit, quota, inject-backend-auth (names must match `config/policies.json`).
- **Policies** (`config/policies.json`): Format required by the Zuplo build may vary by runtime. If deploying from code, try root object with key `policies` and value an array of policy objects (each with `name`, `policyType`, `handler`). If the build rejects that, define policies in the Portal (Route Designer) and export/sync to obtain the valid file; then commit that format. Required policy names:
  - **api-key-inbound** — `policyType`: `"api-key-inbound"`, handler from `@zuplo/runtime` `ApiKeyInboundPolicy`, options e.g. `allowUnauthenticatedRequests: false`.
  - **rate-limit-inbound** — `policyType`: `"rate-limit-inbound"`, `RateLimitInboundPolicy`, options e.g. `rateLimitBy: "user"`, `requestsAllowed`, `timeWindowMinutes`.
  - **quota-inbound** — `policyType`: `"quota-inbound"`, `QuotaInboundPolicy`, options e.g. `quotaBy: "user"`, `period: "monthly"`, `allowances: { "requests": N }`.
  - **inject-backend-auth** — `policyType`: `"set-headers-inbound"`, `SetHeadersInboundPolicy`, options `headers`: `[{ "name": "Authorization", "value": "Bearer $env(KEYS_BACKEND_API_KEY)", "overwrite": true }]`.

Minimal reference files are in this repo at **`docs/runbooks/zuplo-config-reference/`**:
- `config-routes.example.json` — path `/(.*)` (url-pattern), URL Forward to `${env.KEYS_BACKEND_URL}`, inbound policy list.
- `config-policies.example.json` — api-key-inbound, rate-limit-inbound, quota-inbound, inject-backend-auth (Set Headers with `$env(KEYS_BACKEND_API_KEY)`).

If your Zuplo project uses a different path format for catch-all (e.g. from the Route Designer), match that. The agent should:

1. Ensure the Zuplo project exists and is linked to the repo (or use CLI deploy).
2. Use the in-repo project at **`zuplo-gateway/`** (it already contains `config/routes.oas.json` and `config/policies.json` matching this runbook), or write/update those files in your project directory.
3. Set env vars `KEYS_BACKEND_URL` and `KEYS_BACKEND_API_KEY` in Zuplo (portal or CLI/API); do not commit secrets.
4. From `zuplo-gateway/` run `pnpm install` then `pnpm run deploy` (with `ZUPLO_API_KEY` set), or push to the connected branch to trigger Git-based deploy.

### 9.3 CLI prerequisites

- **Node.js** 20+ (22 recommended).
- **Install:** `npm install -g zuplo` (or `npm install -g @zuplo/cli` if the package name differs; see [Zuplo CLI](https://zuplo.com/docs/cli/overview)).
- **Auth:** `ZUPLO_API_KEY` from Zuplo portal (Settings → API Keys). Use for `zuplo deploy` and variable commands; do not commit.

### 9.4 What cannot be fully automated today

- **Linking the Zuplo project to a GitHub repo** is done in the portal (Settings → Source Control). After that, pushes deploy automatically; the agent only needs to edit files and push (or use `zuplo deploy` if not using GitHub).
- **First-time project creation** can be done with `zuplo project create`; connecting a repo is portal-only.
- **Developer Portal** (docs, try-it) is configured in the portal; OpenAPI can be imported or synced from the route spec.

---

## 10. Connecting to GitHub (optional — do after gateway is working)

Zuplo **Source Control** (Settings → Source Control) only accepts:

- An **empty** repository, or  
- A repository whose **root** is a valid Zuplo project (i.e. `config/`, `zuplo.jsonc`, `tsconfig.json` at the **top level** of the repo).

The **restormel-keys** repo is a monorepo with the gateway in **`zuplo-gateway/`**. Zuplo checks the repo root and does not see a Zuplo project there, so it shows: *"We can only connect to an empty repository or a repository containing a valid Zuplo project."* Do not connect the main restormel-keys repo to Zuplo unless the project root is changed (not supported by Zuplo today).

**Options when you are ready to use GitHub:**

| Option | Description |
|--------|-------------|
| **A — Dedicated gateway repo** | Create a new GitHub repo (e.g. `restormel-keys-gateway`). Copy the **contents** of this repo’s `zuplo-gateway/` into the **root** of that repo (so the new repo has `config/`, `zuplo.jsonc`, `tsconfig.json`, `package.json`, `README.md` at top level). Push, then in Zuplo connect to that repo. You get branch-based environments and deploy-on-push; keep `zuplo-gateway/` in restormel-keys as the source of truth and sync to the dedicated repo when needed (script or manual copy). |
| **B — CLI deploy only** | Do not connect a repo. Deploy from this repo with `cd zuplo-gateway && ZUPLO_API_KEY=<key> pnpm run deploy` whenever you change the gateway. Optionally run the same from CI with `ZUPLO_API_KEY` as a secret. |

**Recommendation:** Finish configuring and validating the gateway (env vars, consumers, §7 validation) first. Then choose A if you want branch environments and push-to-deploy, or B if a single gateway and CLI/CI deploys are enough. See also [zuplo-gateway/README.md](../../zuplo-gateway/README.md).

---

## 11. Troubleshooting: 401 on Main, “no routes” / holding page on Working Copy

### Main — 401 when opening gateway or dev portal in browser

- **Gateway URL** (`*.zuplo.app`, e.g. `restormel-keys-gateway-main-….zuplo.app`):  
  Every route has **api-key-inbound** with `allowUnauthenticatedRequests: false`. Visiting the gateway in a browser (no API key) **correctly** returns **401 — No Authorization Header**. This is not a misconfiguration.

  **What to do:**  
  - For **API calls:** send a valid Zuplo consumer key (e.g. `Authorization: Bearer zpka_…` or the header your API Key policy uses). Create a consumer and key in Portal → API Key Service (or your API Key bucket) and use it in requests.  
  - For **docs and Try it:** use the **Dev Portal** URL, not the gateway URL. In Zuplo go to **Environments** → **main** → copy the **Dev Portal** link (typically `*.zuplo.site`). The portal page should load without an API key; use “Try it” or the portal’s auth UI to send a key when calling the API.

- If you see 401 on the **Dev Portal** URL (the `.zuplo.site` link):  
  - Confirm you are opening the **Dev Portal** link from Environments, not the **Gateway** link.  
  - Some Zuplo setups require you to **Log in** (Zuplo account) to view the portal; that is separate from the API key. Use the **Login** button on the portal if shown.  
  - If the portal URL redirects to the gateway, or the portal is configured to sit behind the same routes, you would need to adjust portal/gateway separation in Zuplo (see Zuplo docs for your plan).

### Working Copy — “no routes” on gateway, holding page on dev portal

- **“No routes”** on the gateway for the Working Copy environment means that environment’s deployed config has **no route definitions** (or the build did not include them).  
  - If Working Copy is a **branch environment** (e.g. from GitHub Source Control), that branch in the **connected repo** may have an empty or different `config/routes.oas.json` (or the branch was never synced with the same content as main).  
  - **Fix:** Ensure the branch that backs “Working Copy” has the same `config/routes.oas.json` as main (e.g. merge main into that branch, or copy `zuplo-gateway/config/routes.oas.json` into the root of the dedicated gateway repo on that branch and push). After a successful deploy, the gateway for that environment should list the same routes as main.

- **Holding page** on the dev portal for Working Copy is typically what Zuplo shows when there is **no OpenAPI spec or no routes** for that environment. Once the Working Copy environment has the same routes (and optional OpenAPI) as main and is redeployed, the dev portal for that environment should show the API reference instead of the holding page.
