# Security Baseline

Canonical security baseline. BYOK-safe defaults. **Single source** for security rules; trust boundaries and risks in [threat-model-starter.md](threat-model-starter.md).

**Before product coding:** Define trust boundaries and sensitive data classes; no raw-key logging; no committed secrets or live credentials; redaction rules for docs/logs/tests/screenshots; secret-location and authn/authz expectations; least-retention and data-minimisation; vulnerability and dependency hygiene.

**BYOK risks:** Key exposure via logs/analytics; insecure examples in production; over-trusting provider calls; central proxy as default; cross-project/cross-user scoping mistakes.

**Banned:** Plaintext keys in localStorage as normal; realistic secrets in docs/screenshots; “temporary” secret logging; broad admin without project scoping.

**Rules (enforced):** No committed secrets; no raw key logging; no unsafe placeholders; redaction and data minimisation; trust-boundary thinking for sensitive changes.

**MCP / local tooling:** `@restormel/mcp` reads provider and server credentials only from the **process environment** of the stdio server. **Canonical env names and URL roles** (do not invent synonyms): [guides/restormel-environment-vocabulary.md](guides/restormel-environment-vocabulary.md). In short: `RESTORMEL_GATEWAY_KEY` and `RESTORMEL_SERVER_TOKEN` are the **same secret** unless you issue a separate management token; `RESTORMEL_KEYS_BASE`, `RESTORMEL_CONTROL_PLANE_URL`, and `RESTORMEL_EVALUATE_URL` are **three different strings**. Do not log those values; treat MCP host logs as untrusted. Operational checklist: [runbooks/mcp-implementation-workflow.md](runbooks/mcp-implementation-workflow.md). Prefer `RESTORMEL_MCP_<PROVIDER>_KEY` overrides only when conventional env names are insufficient.
**CLI device linking:** OAuth-style device flow uses short-lived `cli_device_sessions` rows. A new Gateway key may sit in `pending_raw_key` only between browser authorization and the first successful CLI poll, then the column is cleared. Do not log device codes, user codes, or raw keys; rate limits apply to session start per client IP.

**Service operators:** `isServiceAdmin` bypasses subscription-style project/request caps and env-gated Pro dashboard features. Grant only to Allotment operators via Neon Auth **admin** role (when exposed on `get-session`), `RESTORMEL_SERVICE_ADMIN_USER_IDS`, **`RESTORMEL_SERVICE_OWNER_EMAILS`** (comma-separated sign-in emails; built-in defaults apply only when this env is **unset**), or `service_admins` (migration `023`). **User management** (`/keys/dashboard/admin/users`, `GET/PATCH …/api/admin/users`) is **session-only** and **service-owner-gated**; list and role changes must not leak in logs. This is **not** multi-tenant customer RBAC; do not use it to implement “admin users” for external workspaces.

**Hosted provider credentials (Connections / BYOK in dashboard):** Store **AES-256-GCM** ciphertext in Postgres (`provider_integrations`); master key material from **`RESTORMEL_CREDENTIALS_ENCRYPTION_KEY`** (32-byte key, base64-encoded — generate with `openssl rand -base64 32`). **Do not** log plaintext, ciphertext, IV, or tags. API responses and UI show **masked** identifiers only unless a dedicated, authenticated resolve endpoint returns an **inline** key for machine clients over TLS (never log response bodies). Prefer KMS envelope encryption in high-compliance deployments; the app-level key is the minimum bar for self-hosted. See [threat-model-starter.md](threat-model-starter.md).

**Workspace webhooks:** Outbound webhook signing secrets are stored with the **same** encryption helper as Connections. **Do not** log signing secrets, HMAC values, or full webhook response bodies. Receivers should use constant-time comparison for signatures. See [integrations/webhooks-audit-mvp.md](integrations/webhooks-audit-mvp.md).

**Restormel Support (in-product assistant):** Session-only **`POST /keys/dashboard/api/support-chat`**; no Gateway-key or management-key access. **Do not** log user message bodies or `OPENAI_API_KEY` in application logs. UI copy must discourage pasting secrets; treat chat content as **user-provided** and minimise retention (v1: no server-side conversation store). Product narrative: [docs/restormel/RESTORMEL-SUPPORT.md](restormel/RESTORMEL-SUPPORT.md). Production env: [docs/runbooks/restormel-support-production.md](runbooks/restormel-support-production.md).

