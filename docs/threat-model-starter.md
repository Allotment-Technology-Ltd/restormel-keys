# Threat Model Starter

Trust boundaries and initial risks. **Single source** for boundaries and risk list; security rules in [security-baseline.md](security-baseline.md).

**Trust boundaries (refine as needed):** User/builder (holds keys); Restormel Keys core (routing, no key storage by default); provider APIs (external; scope and minimise); hosted components (future; clear authn/authz and scoping).

**Sensitive data:** API keys, user/builder identifiers and tokens, billing/usage (when applicable).

**Initial risks:** Key leakage (logs, docs, fixtures, examples); over-trusting provider APIs; cross-project/cross-user scope confusion; insecure example defaults.

**Mitigations:** No raw keys in logs/docs; redaction; no committed secrets; examples use placeholders; boundaries and data classes kept in this doc and security-baseline.
