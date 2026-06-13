# Staging and CI setup — Restormel Keys

**Public guide:** For the full step-by-step guide with **where to get** each value, **what to call it**, **where to save it**, and **how to rotate or replace it**, use the walkthrough:

- **In-app:** [Staging and CI setup](/keys/docs/walkthrough/staging-and-ci-setup) (restormel.dev/keys/docs/walkthrough/staging-and-ci-setup)
- **In repo:** [docs/archive/walkthrough-source/walkthrough/12-staging-and-ci-setup.md](../archive/walkthrough-source/walkthrough/12-staging-and-ci-setup.md)

This runbook is a short **ops checklist** for anyone who has already read the guide and needs a reminder.

---

## Ops checklist

### In Restormel Dashboard

1. Create or use a **non-production** project or environment (dedicated staging project preferred).
2. **Get the three required values** from the **Copy for CI** page:
   - Open [restormel.dev/keys/dashboard/copy-for-ci](https://restormel.dev/keys/dashboard/copy-for-ci), or in the dashboard **left sidebar** click **Copy for CI** (under Projects).
   - If you get a **404** or don’t see “Copy for CI”: the page is in the current dashboard release; ensure the app is deployed from the branch that includes it (e.g. merge to `main` and redeploy). **Fallback:** **Projects** → click your staging project name → on the project page, scroll to **Copy for CI (GitHub Secrets)**.
   - On the Copy for CI page, click your **staging project** name. Copy **project ID** and **environment ID**; click **Create key in Access**, copy the key once (that’s `RESTORMEL_GATEWAY_KEY_STAGING`). Copy **project ID** → `RESTORMEL_PROJECT_ID_STAGING`, **environment ID** → `RESTORMEL_ENVIRONMENT_ID_STAGING`.
3. (Optional) Note **route ID** from the same project → `RESTORMEL_SMOKE_ROUTE_ID_STAGING`; pick **blocked model + provider** from Routes/Policies → `RESTORMEL_SMOKE_BLOCKED_MODEL_ID_STAGING`, `RESTORMEL_SMOKE_BLOCKED_PROVIDER_TYPE_STAGING`.

### In your app repo (e.g. GitHub)

- **Path:** Settings → Secrets and variables → Actions → New repository secret.
- Add the secrets with the names above (see walkthrough for exact names and rotate/replace steps).
- **In workflows:** you must **map** the secret names to the env vars your script or CLI expects. If you store `RESTORMEL_GATEWAY_KEY_STAGING` but your step runs `test -n "$RESTORMEL_GATEWAY_KEY"`, the step will see an empty value unless you set env, e.g.:
  ```yaml
  env:
    RESTORMEL_GATEWAY_KEY: ${{ secrets.RESTORMEL_GATEWAY_KEY_STAGING }}
    RESTORMEL_PROJECT_ID: ${{ secrets.RESTORMEL_PROJECT_ID_STAGING }}
    RESTORMEL_ENVIRONMENT_ID: ${{ secrets.RESTORMEL_ENVIRONMENT_ID_STAGING }}
  ```
  Add this at the **job** or **step** level so the step that runs the test (or `npx @restormel/validate`) receives the values.

### Nightly CI

- In `nightly-gate-audit.yml` (or equivalent): add env from staging secrets; run `npx @restormel/validate`; optionally `pnpm run smoke:restormel` if staging is stable.

### Post-deploy

- **Safer:** Operator runs `pnpm run smoke:restormel` manually and checks dashboard.
- **Automated:** Add optional post–health-check step in deploy; inject secrets; run smoke; don’t gate deploys until confident.

### Rotate or replace

- **Gateway Key:** Dashboard → API Keys → revoke old, generate new → update the secret value in GitHub/GCP. No code change.
- **Project / environment / route / blocked model:** Update the corresponding secret with the new value. No code change.

For full detail on each secret (where to get it, what to call it, where to save it, rotate/replace), use the [Staging and CI setup](../archive/walkthrough-source/walkthrough/12-staging-and-ci-setup.md) walkthrough page.
