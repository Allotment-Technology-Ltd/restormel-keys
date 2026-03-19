# Staging and CI setup — Restormel Keys

This guide walks you through setting up a **non-production** Restormel target and wiring it into your app’s CI (e.g. GitHub Actions) for PR validation, nightly checks, and optional post-deploy smoke tests. It tells you exactly **where to get** each value, **what to call it**, **where to save it**, and **what to do if you need to rotate or replace it**.

**Dashboard:** [restormel.dev/keys/dashboard](https://restormel.dev/keys/dashboard). Open your **staging project** → the **Copy for CI (GitHub Secrets)** section lists the secret names, lets you copy project ID and environment ID, and tells you where to create and copy a Gateway key (keys are never shown in full after creation).

**Principle:** Do not point CI at your main production environment unless you explicitly accept that risk. Use a dedicated staging project or at least a staging environment inside your project.

---

## Quick reference

| Goal | In Restormel Dashboard | In your app repo (e.g. GitHub) |
|------|------------------------|-------------------------------|
| **Minimum (PR doctor + validate)** | Project + environment + Gateway Key | `RESTORMEL_GATEWAY_KEY_STAGING`, `RESTORMEL_PROJECT_ID_STAGING`, `RESTORMEL_ENVIRONMENT_ID_STAGING` |
| **+ Smoke tests** | Route ID for resolve | `RESTORMEL_SMOKE_ROUTE_ID_STAGING` (or `RESTORMEL_ANALYSE_ROUTE_ID_STAGING`) |
| **+ Blocked-model policy test** | A model/provider your policies reject | `RESTORMEL_SMOKE_BLOCKED_MODEL_ID_STAGING`, `RESTORMEL_SMOKE_BLOCKED_PROVIDER_TYPE_STAGING` |

---

## 1. What to create in Restormel first

Before you store any secrets, create the resources in the Dashboard.

### 1.1 Non-production project or environment

- **Preferred:** Create a **dedicated staging Restormel project** (e.g. “My App Staging”).
- **Alternative:** Use your existing project and add a **staging environment** (e.g. `staging` alongside `production`).

### 1.2 Route for smoke tests (if you will run smoke tests)

Identify the route you want smoke tests to hit (usually **interactive** or your main resolve route). You will need its **route ID** (see the Dashboard route list or detail).

### 1.3 Optional: blocked-model test (for policy smoke tests)

Pick a **model + provider** pair that your staging policies **reject** (e.g. a model not on the allowlist). You will use that model ID and provider type in two optional secrets.

---

## 2. Each secret: where to get it, what to call it, where to save it, rotate/replace

Store secrets in your **app repo** (e.g. GitHub). Path: **Repo → Settings → Secrets and variables → Actions → New repository secret.** In your workflow, map each secret into the env var your scripts expect (e.g. `RESTORMEL_GATEWAY_KEY: ${{ secrets.RESTORMEL_GATEWAY_KEY_STAGING }}`).

If you use **GCP Secret Manager** for deploy-time or post-deploy checks, store the same values there and fetch them in the workflow the same way you already fetch app secrets. Use the same logical names below.

---

### Gateway Key (required for doctor, validate, and smoke)

| | |
|--|--|
| **Where to get it** | Dashboard → select your **staging project** → **API Keys** → **Generate key**. Copy the key (prefix `rk_...`). You see it once; store it immediately. |
| **What to call it** | `RESTORMEL_GATEWAY_KEY_STAGING` (in GitHub or GCP). Your workflow passes it as `RESTORMEL_GATEWAY_KEY` to the CLI/scripts. |
| **Where to save it** | GitHub: **Settings → Secrets and variables → Actions → New repository secret** → Name: `RESTORMEL_GATEWAY_KEY_STAGING`, Value: the `rk_...` string. Or store in GCP Secret Manager and inject in the workflow. |
| **Rotate or replace** | Dashboard → same project → **API Keys** → revoke the old key (if needed), generate a new one. Update the **value** of `RESTORMEL_GATEWAY_KEY_STAGING` in GitHub (or GCP) with the new key. No code change; next CI run uses the new key. |

---

### Project ID (required)

| | |
|--|--|
| **Where to get it** | Dashboard → select the **staging project** → project settings or the URL. The **project ID** is the project’s UUID (e.g. `550e8400-e29b-41d4-a716-446655440000`). |
| **What to call it** | `RESTORMEL_PROJECT_ID_STAGING` (in GitHub or GCP). Your workflow passes it as `RESTORMEL_PROJECT_ID`. |
| **Where to save it** | GitHub: **Settings → Secrets and variables → Actions → New repository secret** → Name: `RESTORMEL_PROJECT_ID_STAGING`, Value: the project UUID. Or GCP Secret Manager. |
| **Rotate or replace** | Project IDs do not “rotate.” If you **replace** the staging project (e.g. create a new project and retire the old one), copy the **new** project’s UUID and update the `RESTORMEL_PROJECT_ID_STAGING` secret with that value. No code change. |

---

### Environment ID (required)

| | |
|--|--|
| **Where to get it** | Dashboard → same project → **Environments** (or project settings). The **environment ID** is the staging environment’s UUID or slug (e.g. `staging` or a UUID). Use the value the API expects (often the slug like `staging`). |
| **What to call it** | `RESTORMEL_ENVIRONMENT_ID_STAGING` (in GitHub or GCP). Your workflow passes it as `RESTORMEL_ENVIRONMENT_ID`. |
| **Where to save it** | GitHub: **Settings → Secrets and variables → Actions → New repository secret** → Name: `RESTORMEL_ENVIRONMENT_ID_STAGING`, Value: the environment ID. Or GCP Secret Manager. |
| **Rotate or replace** | Environment IDs do not “rotate.” If you **replace** the staging environment (e.g. delete and recreate), update `RESTORMEL_ENVIRONMENT_ID_STAGING` with the new environment’s ID. No code change. |

---

### Smoke route ID (optional; for resolve smoke tests)

| | |
|--|--|
| **Where to get it** | Dashboard → same project → **Routes** → open the route you want smoke tests to call (e.g. **interactive**). Copy the **route ID** (often the slug, e.g. `interactive`). |
| **What to call it** | `RESTORMEL_SMOKE_ROUTE_ID_STAGING` or `RESTORMEL_ANALYSE_ROUTE_ID_STAGING` (in GitHub or GCP). Your workflow passes it as `RESTORMEL_SMOKE_ROUTE_ID` or `RESTORMEL_ANALYSE_ROUTE_ID`. |
| **Where to save it** | GitHub: **Settings → Secrets and variables → Actions → New repository secret** → Name: `RESTORMEL_SMOKE_ROUTE_ID_STAGING`, Value: the route ID. Or GCP Secret Manager. |
| **Rotate or replace** | If you rename or replace the route, update the secret with the new route ID. If you use a different route for smoke tests, update the secret to that route’s ID. No code change if your script reads the env var. |

---

### Blocked model ID (optional; for policy smoke tests)

| | |
|--|--|
| **Where to get it** | Choose a **model ID** that your staging policies **block** (e.g. a model not on your allowlist). Example: `gpt-3.5-turbo`. You can confirm it’s blocked by calling the evaluate endpoint or checking the Dashboard policy. |
| **What to call it** | `RESTORMEL_SMOKE_BLOCKED_MODEL_ID_STAGING` (in GitHub or GCP). Your workflow passes it as `RESTORMEL_SMOKE_BLOCKED_MODEL_ID`. |
| **Where to save it** | GitHub: **Settings → Secrets and variables → Actions → New repository secret** → Name: `RESTORMEL_SMOKE_BLOCKED_MODEL_ID_STAGING`, Value: e.g. `gpt-3.5-turbo`. Or GCP Secret Manager. |
| **Rotate or replace** | If your allowlist or policies change and this model becomes allowed (or no longer exists), pick another blocked model and update the secret. No code change if your script reads the env var. |

---

### Blocked provider type (optional; for policy smoke tests)

| | |
|--|--|
| **Where to get it** | The **provider type** for the same blocked model (e.g. `openai`, `anthropic`). Must match the model you chose for `RESTORMEL_SMOKE_BLOCKED_MODEL_ID_STAGING`. |
| **What to call it** | `RESTORMEL_SMOKE_BLOCKED_PROVIDER_TYPE_STAGING` (in GitHub or GCP). Your workflow passes it as `RESTORMEL_SMOKE_BLOCKED_PROVIDER_TYPE`. |
| **Where to save it** | GitHub: **Settings → Secrets and variables → Actions → New repository secret** → Name: `RESTORMEL_SMOKE_BLOCKED_PROVIDER_TYPE_STAGING`, Value: e.g. `openai`. Or GCP Secret Manager. |
| **Rotate or replace** | Update if you change the blocked model to one from a different provider. No code change if your script reads the env var. |

---

### Keys base URL (optional; usually not needed)

| | |
|--|--|
| **Where to get it** | Default is `https://restormel.dev`. Only set this if you use a **different host** for the Restormel Keys API (e.g. self-hosted or a different domain). |
| **What to call it** | `RESTORMEL_KEYS_BASE_STAGING` (in GitHub or GCP). Your workflow passes it as `RESTORMEL_KEYS_BASE` or `RESTORMEL_KEYS_BASE_URL`. |
| **Where to save it** | GitHub or GCP, same as above. Omit entirely if you use the default `https://restormel.dev`. |
| **Rotate or replace** | Only if the API host changes (e.g. migration to a new domain). Update the secret with the new base URL. No code change if your app reads the env var. |

---

## 3. Configure scheduled CI (nightly)

Use your existing **nightly** or audit workflow (e.g. `nightly-gate-audit.yml`).

1. Add env from the staging secrets, for example:

   ```yaml
   env:
     RESTORMEL_GATEWAY_KEY: ${{ secrets.RESTORMEL_GATEWAY_KEY_STAGING }}
     RESTORMEL_PROJECT_ID: ${{ secrets.RESTORMEL_PROJECT_ID_STAGING }}
     RESTORMEL_ENVIRONMENT_ID: ${{ secrets.RESTORMEL_ENVIRONMENT_ID_STAGING }}
   ```

2. Run:

   ```bash
   npx @restormel/validate
   ```

3. Optionally run:

   ```bash
   pnpm run smoke:restormel
   ```

Add **smoke:restormel** to nightly only if the staging Restormel environment is stable, the route and policies are valid, and you are comfortable with nightly traffic hitting that non-production target.

---

## 4. Configure post-deploy

**Safer at first:** After deploy, an operator runs `pnpm run smoke:restormel` manually and checks the dashboard.

**Automated:** Add a post–health-check step in your deploy workflow; inject the staging secrets; run `pnpm run smoke:restormel`. Do not make it deploy-blocking until the network path and staging project are reliably healthy.

---

## 5. Recommended minimum setup (phased)

**Phase A — PR doctor and validate only**  
Secrets: `RESTORMEL_GATEWAY_KEY_STAGING`, `RESTORMEL_PROJECT_ID_STAGING`, `RESTORMEL_ENVIRONMENT_ID_STAGING`.  
Enough for: PR `keys doctor`, PR or nightly `npx @restormel/validate`.

**Phase B — Add resolve smoke**  
Add secret: `RESTORMEL_SMOKE_ROUTE_ID_STAGING` (or `RESTORMEL_ANALYSE_ROUTE_ID_STAGING`).  
Enough for: post-deploy or nightly `pnpm run smoke:restormel`.

**Phase C — Add blocked-model policy test**  
Add secrets: `RESTORMEL_SMOKE_BLOCKED_MODEL_ID_STAGING`, `RESTORMEL_SMOKE_BLOCKED_PROVIDER_TYPE_STAGING`.  
Do this after your staging policies are stable and you have a model/provider pair that is intentionally blocked.

---

## 6. Workflow file changes (optional)

- **Nightly:** In `nightly-gate-audit.yml` (or equivalent), add the staging env vars and a step that runs `npx @restormel/validate`, and optionally `pnpm run smoke:restormel`.
- **Post-deploy:** In `deploy.yml`, add an optional post–health-check step that injects the same secrets and runs `pnpm run smoke:restormel`, without making it deploy-blocking until you are confident.

See [Verification strategy](10-verification-strategy.md) for CLI and smoke details, and [Phase 6 — Go live](08-phase-6-golive.md) for the smoke script.
