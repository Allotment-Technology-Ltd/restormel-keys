# Security Baseline

Canonical security baseline. BYOK-safe defaults. **Single source** for security rules; trust boundaries and risks in [threat-model-starter.md](threat-model-starter.md).

**Before product coding:** Define trust boundaries and sensitive data classes; no raw-key logging; no committed secrets or live credentials; redaction rules for docs/logs/tests/screenshots; secret-location and authn/authz expectations; least-retention and data-minimisation; vulnerability and dependency hygiene.

**BYOK risks:** Key exposure via logs/analytics; insecure examples in production; over-trusting provider calls; central proxy as default; cross-project/cross-user scoping mistakes.

**Banned:** Plaintext keys in localStorage as normal; realistic secrets in docs/screenshots; “temporary” secret logging; broad admin without project scoping.

**Rules (enforced):** No committed secrets; no raw key logging; no unsafe placeholders; redaction and data minimisation; trust-boundary thinking for sensitive changes.

**MCP / local tooling:** `@restormel/mcp` reads provider and server credentials only from the **process environment** of the stdio server. **Canonical env names and URL roles** (do not invent synonyms): [guides/restormel-environment-vocabulary.md](guides/restormel-environment-vocabulary.md). In short: `RESTORMEL_GATEWAY_KEY` and `RESTORMEL_SERVER_TOKEN` are the **same secret** unless you issue a separate management token; `RESTORMEL_KEYS_BASE`, `RESTORMEL_CONTROL_PLANE_URL`, and `RESTORMEL_EVALUATE_URL` are **three different strings**. Do not log those values; treat MCP host logs as untrusted. Operational checklist: [runbooks/mcp-implementation-workflow.md](runbooks/mcp-implementation-workflow.md). Prefer `RESTORMEL_MCP_<PROVIDER>_KEY` overrides only when conventional env names are insufficient.
**CLI device linking:** OAuth-style device flow uses short-lived `cli_device_sessions` rows. A new Gateway key may sit in `pending_raw_key` only between browser authorization and the first successful CLI poll, then the column is cleared. Do not log device codes, user codes, or raw keys; rate limits apply to session start per client IP.

**Service operators:** `isServiceAdmin` bypasses subscription-style project/request caps and env-gated Pro dashboard features. Grant only to Allotment operators via Neon Auth **admin** role (when exposed on `get-session`), `RESTORMEL_SERVICE_ADMIN_USER_IDS`, or `service_admins` (migration `023`). This is **not** multi-tenant customer RBAC; do not use it to implement “admin users” for external workspaces.

