# Threat Model Starter

Trust boundaries and initial risks. **Single source** for boundaries and risk list; security rules in [security-baseline.md](security-baseline.md).

**Trust boundaries (refine as needed):** User/builder (holds keys); Restormel Keys core (routing; optional **hosted provider credentials** for Connections); provider APIs (external; scope and minimise); hosted components (clear authn/authz and scoping).

**Sensitive data:** API keys, **third-party LLM provider credentials** when stored for hosted resolve (distinct from Gateway key hashes), user/builder identifiers and tokens, billing/usage (when applicable).

**Provider credentials (Connections):** At-rest **ciphertext** (envelope-style AES-256-GCM with a server key from `RESTORMEL_CREDENTIALS_ENCRYPTION_KEY`); **never** plaintext in Postgres for new writes. List/get APIs return **masked** labels only (prefix + last4). Decrypt only inside server handlers that enforce workspace/project scope (e.g. `POST /v1/testing/resolve-model` with Gateway key). Rotation: replace ciphertext; audit via `audit_events`.

**Initial risks:** Key leakage (logs, docs, fixtures, examples); over-trusting provider APIs; cross-project/cross-user scope confusion; insecure example defaults; **credential store** becoming a high-value target (mitigate with encryption, least privilege, no secret echo on list endpoints).

**Mitigations:** No raw keys in logs/docs; redaction; no committed secrets; examples use placeholders; boundaries and data classes kept in this doc and security-baseline.
