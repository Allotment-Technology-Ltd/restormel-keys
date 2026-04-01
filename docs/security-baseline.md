# Security Baseline

Canonical security baseline. BYOK-safe defaults. **Single source** for security rules; trust boundaries and risks in [threat-model-starter.md](threat-model-starter.md).

**Before product coding:** Define trust boundaries and sensitive data classes; no raw-key logging; no committed secrets or live credentials; redaction rules for docs/logs/tests/screenshots; secret-location and authn/authz expectations; least-retention and data-minimisation; vulnerability and dependency hygiene.

**BYOK risks:** Key exposure via logs/analytics; insecure examples in production; over-trusting provider calls; central proxy as default; cross-project/cross-user scoping mistakes.

**Banned:** Plaintext keys in localStorage as normal; realistic secrets in docs/screenshots; “temporary” secret logging; broad admin without project scoping.

**Rules (enforced):** No committed secrets; no raw key logging; no unsafe placeholders; redaction and data minimisation; trust-boundary thinking for sensitive changes.

**MCP / local tooling:** `@restormel/mcp` reads provider and server credentials only from the **process environment** of the stdio server (e.g. `OPENAI_API_KEY`, `RESTORMEL_GATEWAY_KEY`, optional `RESTORMEL_SERVER_TOKEN`, optional `RESTORMEL_EVALUATE_URL` / `RESTORMEL_CONTROL_PLANE_URL`). Do not log those values; treat MCP host logs as untrusted. Policy evaluate uses the **Dashboard API** full URL; control-plane MCP tools use a **dashboard app base** URL (see [runbooks/mcp-implementation-workflow.md](runbooks/mcp-implementation-workflow.md)). Prefer `RESTORMEL_MCP_<PROVIDER>_KEY` overrides only when conventional env names are insufficient.
