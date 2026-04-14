# Threat Model Starter

Trust boundaries and initial risks. **Single source** for boundaries and risk list; security rules in [security-baseline.md](security-baseline.md).

**Trust boundaries (refine as needed):** User/builder (holds keys); Restormel Keys core (routing; optional **hosted provider credentials** for Connections); provider APIs (external; scope and minimise); hosted components (clear authn/authz and scoping).

**Sensitive data:** API keys, **third-party LLM provider credentials** when stored for hosted resolve (distinct from Gateway key hashes), user/builder identifiers and tokens, billing/usage (when applicable).

**Provider credentials (Connections):** At-rest **ciphertext** (envelope-style AES-256-GCM with a server key from `RESTORMEL_CREDENTIALS_ENCRYPTION_KEY`); **never** plaintext in Postgres for new writes. List/get APIs return **masked** labels only (prefix + last4). Decrypt only inside server handlers that enforce workspace/project scope (e.g. `POST /v1/testing/resolve-model` with Gateway key). Rotation: replace ciphertext; audit via `audit_events`.

**Initial risks:** Key leakage (logs, docs, fixtures, examples); over-trusting provider APIs; cross-project/cross-user scope confusion; insecure example defaults; **credential store** becoming a high-value target (mitigate with encryption, least privilege, no secret echo on list endpoints).

**Mitigations:** No raw keys in logs/docs; redaction; no committed secrets; examples use placeholders; boundaries and data classes kept in this doc and security-baseline.

**Autonomous browser / agent loop (Restormel Testing):** LLM-driven Playwright paths (`ac_sequence`, rubrics) add DOM-injection and cost risks. See [testing/testing-autonomous-browsing-threat-addendum.md](testing/testing-autonomous-browsing-threat-addendum.md).

**Outbound workspace webhooks:** Signing secrets use the same AES-256-GCM envelope as hosted provider credentials (`RESTORMEL_CREDENTIALS_ENCRYPTION_KEY`). Verify HMAC on the **raw** POST body at the receiver; treat failed deliveries as observable reliability, not as secret leakage. Webhook URLs are attacker-controlled SSRF targets—restrict to HTTPS in production dashboards where possible, apply timeouts, and avoid following redirects that exfiltrate headers. Payloads must **not** include raw provider keys or user prompts.

**Catalog observations → routing automation (future):** Aggregated model health or crowd reports (for example via `POST /api/catalog/observations` or `explain-chain?includeCatalogHints=true`) must **not** drive **automatic** step reorder, cooldown, or policy changes unless explicitly enabled by an operator with a clear UX affordance and audit trail. **Risks:** poisoned or Sybil telemetry shifting production traffic; mistaken deprecation reports blocking valid models; cross-tenant leakage if aggregation ever mis-scopes. **Mitigations:** keep read paths default-off or clearly labeled; rate-limit and anomaly-check writes; require human confirmation or workspace-scoped policy objects before any mutation; never turn automation on by default. Design note: [guides/routing-catalog-signals.md](guides/routing-catalog-signals.md).
