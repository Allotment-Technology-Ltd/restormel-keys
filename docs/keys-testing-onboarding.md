# Keys + Restormel Testing onboarding (canonical)

Single operational path: store provider material securely in Restormel Keys, bind models for the **Restormel Testing** project, then run the Testing CLI with Gateway auth.

## 1. Account and dashboard

Sign in to the Keys dashboard (`/keys/dashboard`). Your default workspace is created automatically.

## 2. Provider connection (encrypted or reference)

Open **Connections** (`/keys/dashboard/integrations`).

- **Hosted API key (recommended for judge / resolve):** paste the provider API key once. It is encrypted at rest (requires `RESTORMEL_CREDENTIALS_ENCRYPTION_KEY` on the server). The UI never shows the full key again; only a masked label (e.g. suffix) is shown.
- **Credential reference:** use a non-secret label from your vault (e.g. `sm://…`) if you are not storing a hosted key in Restormel.

Saving a connection triggers provisioning of the **Restormel Testing** project, environments, and model bindings when the server can run bootstrap logic.

## 3. Gateway key

Create a **Gateway key** (`rk_…`) under **Gateway keys** for the Restormel Testing project (or reuse an existing key scoped to that project). The CLI and `POST /v1/testing/resolve-model` use this token, not the raw provider key.

## 4. Restormel Testing hub

Open **Restormel Testing** (`/keys/dashboard/testing`) for:

- **Project ID** and **environment IDs** for your CI and local `.env`.
- Copy-ready `RESTORMEL_*` names consistent with [restormel-environment-vocabulary.md](guides/restormel-environment-vocabulary.md).

Set at minimum:

- `RESTORMEL_KEYS_API_BASE_URL` — site origin that serves the Keys API (same host as the dashboard deployment unless documented otherwise).
- `RESTORMEL_KEYS_API_TOKEN` — your Gateway key.
- `RESTORMEL_PROJECT_ID` — from the Testing hub.

## 5. CLI verification

Install `@restormel/testing-cli` (see [testing/oss-consumption.md](testing/oss-consumption.md)), then:

```bash
pnpm exec testing doctor
```

With Keys URL and token set, `doctor` performs a single resolve probe (HTTP status only). It also reminds you to set `RESTORMEL_PROJECT_ID` when the Keys base URL is configured.

## 6. Security notes

- Never commit real keys. Use CI secrets for `RESTORMEL_KEYS_API_TOKEN` and provider material.
- Hosted provider keys are a high-trust data class; see [security-baseline.md](security-baseline.md) and [threat-model-starter.md](threat-model-starter.md).

## Related

- Environment variable names: [restormel-environment-vocabulary.md](guides/restormel-environment-vocabulary.md).
- Consuming Testing packages outside the monorepo: [testing/oss-consumption.md](testing/oss-consumption.md).
- In-product (Keys docs): **[/keys/docs/guides/keys-testing-onboarding](https://restormel.dev/keys/docs/guides/keys-testing-onboarding)** — same journey in the dashboard docs shell.
