# Threat Model Starter

Trust boundaries and initial risks. **Single source** for boundaries and risk list; security rules in [security-baseline.md](security-baseline.md).

---

## Trust boundaries

### Application layer

- **User/builder** (holds BYOK API keys, OAuth session): highest external trust.
- **Restormel Keys core** (routing; optional hosted provider credentials for Connections): trusted internal service.
- **Provider APIs** (external LLM providers): external, scope and minimise data sent.
- **Hosted components** (dashboard, worker, site containers): clear authn/authz required; each component has explicit scoping.

### Infrastructure layer (self-hosted, Coolify/Hetzner)

- **Prod box (`77.42.125.150`)** runs Coolify, Traefik reverse-proxy, and the dashboard/worker/site containers. SSH access is the highest-privilege boundary; Traefik is the only public ingress.
- **`surreal-box` (`77.42.124.167`)** runs SurrealDB (data store for graph/routing), the monitoring control plane (Beszel hub, Uptime-Kuma), and is adopted as a second Coolify server. Treated as semi-trusted infra; not public-facing for application traffic.
- **Coolify control plane** (running on `surreal-box`): manages deployments and environment secrets across both boxes. Compromise of the Coolify API token grants full deployment control.
- **Forgejo (`git.allotmentology.tech`)** is the **primary** git host and CI runner. A compromised Forgejo token or poisoned workflow can alter CI outputs, inject malicious code, or expose secrets passed as CI environment variables. GitHub is a push-mirror and fallback — it has lower trust because it is external and outside the network perimeter.
- **Operational Postgres** runs on the prod box. DB credentials in the Coolify environment are the trust boundary for data access; they must never appear in logs, responses, or CI output.
- **SurrealDB** (on `surreal-box`): connection credentials held in Coolify env; the DB is not public-facing but is reachable from the prod box over the private network.
- **Hetzner network**: both boxes are on the same Hetzner private network (VLAN). Internal traffic between boxes is trusted at the network layer, but credentials are still passed explicitly.
- **Storage Box (Hetzner Robot)**: off-box backup target for `surreal-backup` cron and planned `forgejo dump` cron. Compromise exposes backup archives including DB dumps.

---

## Sensitive data

- BYOK API keys and **third-party LLM provider credentials** stored for Connections (encrypted at rest, never plaintext in Postgres).
- User and builder identifiers, OAuth session tokens.
- Coolify API token, Hetzner API token, SSH private keys (`~/.config/restormel/`).
- Operational Postgres credentials.
- SurrealDB root credentials.
- Storage Box credentials (backup access).
- Billing and usage data (when applicable).

---

## Initial risks

**Key and credential leakage** — logs, docs, test fixtures, chat history, CI output. Mitigation: no raw keys in logs; redaction; no committed secrets; examples use placeholders; CI runs gitleaks + TruffleHog.

**Over-trusting provider APIs** — sending more data than necessary, or assuming providers are honest with routing/timing signals. Mitigation: scope requests; see routing-catalog-signals.md.

**Cross-project/cross-user scope confusion** — workspace RBAC bypass via IDs in query/body. Mitigation: server-side scope enforcement; parameterised queries.

**Credential store as high-value target** — `provider_integrations` table holds AES-256-GCM ciphertext for hosted Connections. Mitigation: encryption at rest, least-privilege DB role, no secret echo on list endpoints, masked identifiers only in API responses.

---

## Infrastructure-specific risks (self-hosted)

### Self-hosted boxes — SSH and host hardening

SSH access to either box is the root trust boundary. Key risks: weak or exposed SSH keys, no fail2ban (brute-force), default root login, open admin ports (Coolify UI, SurrealDB HTTP). Mitigations: fail2ban on both boxes (Phase 1); SSH key rotation after the migration; no public exposure of Coolify admin port (tunnel-only); SurrealDB not public-facing.

A live rehearsal during migration showed that a Coolify build burst can exhaust the prod box's disk, crash Forgejo's Postgres, and cut off SSH-based recovery. Disk-guard cron (`/opt/maintenance/disk-guard.sh`) backstops at 80%. Beszel disk alerts should fire at ~75%.

### Forgejo as primary CI — supply chain

Forgejo is now the first line for code and CI. Risks: a poisoned workflow file (`.forgejo/workflows/`) can run arbitrary code on the act-runner with access to CI secrets; a compromised maintainer token can push to `main` directly. Mitigations: branch protection with required PR checks (Agent D flips this after the security gate is proven); pinned binary tools in `run:` steps rather than third-party marketplace actions; `FORGEJO_TOKEN` scoped to minimum required permissions.

**No Forgejo backup exists.** The P3 Postgres outage cut off Forgejo access entirely. A `forgejo dump` cron to the Hetzner Storage Box is a Phase 1 owner item (model on `surreal-backup`).

### Coolify control plane

The Coolify API token grants full deployment control over both boxes, including the ability to set environment variables that contain application secrets. Mitigations: token rotation after migration; tunnel-only access (no public Coolify URL); treat the token like a root credential.

### SurrealDB self-host

SurrealDB root credentials are held in Coolify environment variables. The DB is on `surreal-box`'s internal network and not publicly reachable. Risk: if `surreal-box` is compromised, the SurrealDB root credential is accessible from the Coolify environment store. Mitigation: restrict network exposure; rotate credentials after migration; least-privilege namespaces for application users.

### Operational Postgres on-box

Postgres runs on the prod box. Credentials flow through Coolify env. Risk: if Coolify env is dumped or the Postgres port is accidentally exposed, application data is reachable. Mitigation: Postgres bound to localhost or private network; credentials rotated after P3 migration; no Postgres credentials in app logs.

---

## Provider credentials (Connections)

At-rest **ciphertext** (AES-256-GCM envelope with a server key from `RESTORMEL_CREDENTIALS_ENCRYPTION_KEY`). Never plaintext in Postgres for new writes. List/get APIs return **masked** labels only (prefix + last4). Decrypt only inside server handlers that enforce workspace/project scope (e.g. `POST /v1/testing/resolve-model` with Gateway key). Rotation: replace ciphertext; audit via `audit_events`.

---

## Autonomous browser / agent loop (Restormel Testing)

LLM-driven Playwright paths (`ac_sequence`, rubrics) add DOM-injection and cost risks. See [testing/testing-autonomous-browsing-threat-addendum.md](../archive/testing/testing/testing-autonomous-browsing-threat-addendum.md).

---

## Outbound workspace webhooks

Signing secrets use the same AES-256-GCM envelope as hosted provider credentials (`RESTORMEL_CREDENTIALS_ENCRYPTION_KEY`). Verify HMAC on the **raw** POST body at the receiver; treat failed deliveries as observable reliability, not secret leakage. Webhook URLs are attacker-controlled SSRF targets — restrict to HTTPS in production dashboards, apply timeouts, and avoid following redirects that exfiltrate headers. Payloads must not include raw provider keys or user prompts.

---

## Catalog observations → routing automation (future)

Aggregated model health or crowd reports must **not** drive automatic step reorder, cooldown, or policy changes unless explicitly enabled by an operator with a clear UX affordance and audit trail. Risks: poisoned or Sybil telemetry shifting production traffic; cross-tenant leakage if aggregation mis-scopes. Mitigations: keep read paths default-off; rate-limit and anomaly-check writes; require human confirmation before any mutation; never turn automation on by default. Design note: [guides/routing-catalog-signals.md](../guides/routing-catalog-signals.md).

---

## Hosted runtime switch evaluation (Phase 3)

`POST …/runtime/invoke` may advance to the next route step after an upstream failure using only allowlisted `advanceOn` tokens and column `fallbackOn`. Do **not** add arbitrary code execution, regex on model output, or LLM-evaluated criteria in this path; new predicates require review and contract versioning ([rfc/keys-no-code-route-runtime.md](../archive/deferred-products/hosted-runtime/keys-no-code-route-runtime.md)).

---

## Mitigations summary

| Risk area | Primary mitigation |
|-----------|-------------------|
| Key leakage | No raw keys in logs/docs; gitleaks + TruffleHog in CI; redaction rules in security-baseline |
| Credential store | AES-256-GCM at rest; masked API responses; least-privilege DB role |
| SSH / host access | fail2ban (Phase 1); SSH key rotation; no exposed admin ports |
| CI supply chain | Pinned binary tools; branch protection + required checks; scoped `FORGEJO_TOKEN` |
| Coolify control plane | Token rotation; tunnel-only access; treat as root credential |
| Disk exhaustion | disk-guard cron at 80%; Beszel disk alert at 75%; Coolify cleanup hourly |
| Forgejo availability | `forgejo dump` cron to Storage Box (Phase 1 owner item) |
| No alarm on runaway | Beszel + Uptime-Kuma + PostHog alerts + external dead-man's-switch |
| Webhook SSRF | HTTPS-only URLs; timeouts; no redirect follow; no secrets in payload |
