# Security Baseline

Canonical security baseline. BYOK-safe defaults. **Single source** for security rules; trust boundaries and risks in [threat-model-starter.md](threat-model-starter.md).

**Before product coding:** Define trust boundaries and sensitive data classes; no raw-key logging; no committed secrets or live credentials; redaction rules for docs/logs/tests/screenshots; secret-location and authn/authz expectations; least-retention and data-minimisation; vulnerability and dependency hygiene.

**BYOK risks:** Key exposure via logs/analytics; insecure examples in production; over-trusting provider calls; central proxy as default; cross-project/cross-user scoping mistakes.

**Banned:** Plaintext keys in localStorage as normal; realistic secrets in docs/screenshots; “temporary” secret logging; broad admin without project scoping.

**Rules (enforced):** No committed secrets; no raw key logging; no unsafe placeholders; redaction and data minimisation; trust-boundary thinking for sensitive changes.
