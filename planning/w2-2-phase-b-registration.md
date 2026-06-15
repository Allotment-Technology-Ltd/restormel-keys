---
id: REC-PLAN-010
title: "Verifying Proxy — Phase B Registration + Read-only Profile + Proxy Policy — Build Spec"
class: planning
owner: founder
status: building
classification: internal
control-tier: 1
created: 2026-06-15
last-reviewed: 2026-06-15
review-interval: P6M
retention: review-only
related: [REC-PLAN-007, REC-PLAN-009, REC-ADR-005]
---

# Verifying Proxy — Phase B: Registration + Read-only Profile + Proxy Policy — Build Spec

**Status: building (overnight 2026-06-15, founder pre-authorized).** REC-PLAN-007 Phase B —
local→staging, needs **neither D1 nor D2**. This is the **control plane** for registering a user's
own upstream MCP server, the read-only tool profile, and the per-tenant proxy policy. It is on the
**credential / DB / SSRF security surface** — it MUST pass the high-risk-security review before merge,
ships **flag-gated**, and exposes **no remote endpoint** (remote serving is Phase C / D1-gated).

## Decisions carried in (REC-ADR-005)

- **D-d (tenancy):** model the upstream like `knowledge_graph_targets` (per-workspace, encrypted
  secret, connection-as-boundary). Concrete control beyond the chokepoint = a **cross-row uniqueness
  guard on `(endpoint, namespace, database)`** so two workspaces can't resolve the same physical
  upstream. Honest limit: a BYO upstream has no independent tenant-tag.
- **D-h / R8 (SSRF):** the proxy dials a **user-supplied URL** → SSRF risk. Require URL
  allow-listing / egress restrictions before any non-local upstream. **Generalise the existing
  `validateOutboundSurrealEndpoint` SSRF guard** (`apps/dashboard/src/lib/server/connect/outbound-surreal-endpoint.ts`,
  added in the surreal-wss work) — do not write a weaker second validator.

## Mirror these existing patterns (read them first — do not reinvent)

- `knowledge_graph_targets` table + migration + `buildWorkspaceGraphStore` + `upsertGraphTarget`
  (per-workspace, `UNIQUE(workspace_id)`, encrypted secret) — the registration template.
- `credential-crypto.ts` — the encrypt/decrypt-at-rest pattern for the upstream secret. Reuse as-is.
- `authorizeKnowledgeWorkspaceRequest` — the single resolver chokepoint; the new resolver feeds it.
- The `policies` table + `rule_definition` + bindings + audit — extend, don't fork, for proxy policy.
- The migration system the repo already uses (the CI step "Apply dashboard migrations (Forgejo DB)")
  — add the new migration in that system's format; it must apply from scratch.

## Build

### B1 — `upstream_mcp_targets` table + resolver
- Migration: per-workspace table modelled on `knowledge_graph_targets`. Columns (adapt to the repo's
  schema conventions): `id`, `workspace_id` (FK), `label`, `transport` (`streamable-http`|`stdio`),
  `endpoint` (URL or command), `namespace` (nullable), `database` (nullable), `encrypted_secret`
  (nullable, via `credential-crypto`), `allowed_tools` (json, nullable), `created_at`, `updated_at`.
- **Cross-row uniqueness guard (D-d):** a DB-level unique constraint on `(endpoint, namespace,
  database)` (normalised) so two workspaces cannot register the same physical upstream. Enforce in
  code too with a clear error (mirror `workspace_scope_mismatch` style).
- `buildWorkspaceUpstreamMcp(workspaceId)` resolver — decrypts the secret, returns a ready upstream
  descriptor; feeds the existing authorize chokepoint. Encrypted secret never logged.
- Connection-test: reach the upstream + `listTools` (reuse the Phase A MCP client). Abstain/error on
  failure; never store an unreachable target as "verified".

### B2 — SSRF / egress allow-list (D-h, R8) — THE safety control
- Generalise `validateOutboundSurrealEndpoint` into a shared outbound-URL guard used for ALL
  user-supplied upstream URLs: reject `localhost`/loopback, RFC-1918 private ranges, link-local
  (169.254.0.0/16 incl. cloud IMDS 169.254.169.254), ULA/`::1`, and non-`https`/`wss` in production
  (allow `http`/`ws` to localhost in dev only). Run the guard at **write-time** (register) AND
  **dial-time** (resolve), exactly like the surreal pattern. DNS-rebinding note carried forward
  (hostname-string check is not full mitigation — document the limit).
- Optional per-deployment allow-list env (`RESTORMEL_UPSTREAM_ALLOWLIST`) — if set, only listed
  hosts/suffixes may be registered. Default closed in production for non-allowlisted public hosts is
  out of scope here (Phase A/B are local); document the toggle.

### B3 — `connect-readonly` tool profile
- A profile that gates write/admin tools OFF the public connector — only read/query/verify-class
  tools are exposed through the proxy. Deny-by-default; the allow-set is explicit. Apply when listing
  and when dispatching tool calls (defence at both points).

### B4 — Per-tenant proxy policy
- Extend the `policies` `rule_definition` (reuse the table + bindings + audit) with: allowed
  upstreams, allowed tools, and abstention thresholds (a `minTrustScore`/`include`-style threshold
  half already exists in verification policy — extend, don't duplicate).

## Tests (hermetic; no live network)
- Migration applies from scratch; `(endpoint,namespace,database)` uniqueness rejects a cross-workspace
  duplicate.
- Encrypted-secret round-trip via `credential-crypto`; secret absent from any log/serialised output.
- SSRF guard: blocks localhost, 10.x/172.16.x/192.168.x, 169.254.169.254, `::1`, `http://` public in
  prod; allows a public `https`/`wss` host; same verdict at write-time and dial-time.
- `connect-readonly`: a write/admin tool is hidden from `listTools` AND rejected on dispatch.
- Resolver isolation: workspace A's id never resolves workspace B's target.

## Green bar + gates
- Typecheck + unit tests + OSV gate green.
- **High-risk-security review (the `restormel-high-risk-security` checklist) before PR/merge** —
  BYOK/credential handling, SSRF, auth chokepoint, SvelteKit server routes, Postgres.
- **Flag-gated** (`RESTORMEL_VERIFYING_PROXY=1` or similar); default off. **No remote/unauth route.**

## Out of scope (Phase B)
Remote/multi-tenant serving + OAuth (Phase C / D1); request-scoped BYO-key entailment (D-e); the
verification logic itself (Phase A); any production exposure of a public upstream; gateway routing
(Phase D / D2).
