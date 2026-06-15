---
id: REC-PLAN-011
title: "Verifying Proxy — Phase C Auth Scaffold (Ory Hydra) — Build Spec"
class: planning
owner: founder
status: building
classification: internal
control-tier: 1
created: 2026-06-15
last-reviewed: 2026-06-15
review-interval: P6M
retention: review-only
related: [REC-PLAN-007, REC-PLAN-010, REC-ADR-005]
---

# Verifying Proxy — Phase C Auth Scaffold (Ory Hydra) — Build Spec

**Status: building (overnight 2026-06-15, founder pre-authorized).** REC-PLAN-007 Phase C is the
remote, multi-tenant connect-to-Claude path — **HARD-gated on D1**. D1 is now decided: **Ory Hydra
(self-host)**. This task is the **scaffold + design only**: the OAuth resource-server validation, the
token→`workspace_id` resolver, and the tenant-isolation tests. **It exposes NO live remote endpoint**
(no public `/mcp`, no ingress) — it builds and tests the auth machinery behind a flag so the remote
path is ready, not live. Request-scoped BYO-key entailment (D-e) stays out until R2 (independence) is
separately enforced.

## Decisions carried in (REC-ADR-005)

- **D1 = Ory Hydra.** OAuth 2.1 + PKCE resource server; per-request token validation; CIMD is a
  SHOULD (note it, don't block on it).
- **Tenancy:** the token→`workspace_id` resolver feeds the existing
  `authorizeKnowledgeWorkspaceRequest` chokepoint. Two tenants must be provably isolated — tenant A's
  token can never resolve tenant B's upstream. Mirror the existing `workspace_scope_mismatch` 403
  tests.
- **D-e (BYO-key) is NOT in this task** — only with D-c enforced and R2 resolved. Validator stays
  Restormel-side.

## Mirror these existing patterns (read first)

- `authorizeKnowledgeWorkspaceRequest` + the `workspace_scope_mismatch` 403 path and its tests — the
  chokepoint the resolver feeds and the isolation-test template.
- Phase B's `upstream_mcp_targets` + `buildWorkspaceUpstreamMcp(workspaceId)` (REC-PLAN-010) — the
  resolver target. If Phase B is not yet merged, code against its interface from the spec and keep the
  integration point a thin seam.
- The existing SvelteKit server-route + session/auth helpers (better-auth) for how requests currently
  resolve identity — the OAuth resource-server path is an ALTERNATIVE ingress identity, not a
  replacement for the dashboard session.

## Build (scaffold — behind a flag, no live route)

### C1 — Ory Hydra resource-server validation
- A `verifyAccessToken(token)` module: validate a bearer access token issued by the configured Ory
  Hydra (`ORY_HYDRA_ADMIN_URL` introspection AND/OR JWKS for JWT access tokens — support both, prefer
  JWKS verification for stateless validation, fall back to introspection). Check `active`, `exp`,
  `aud` (the proxy's resource identifier), and `scope`. Reject expired/inactive/wrong-aud. NO network
  in tests — inject the Hydra client / JWKS so tests use fixtures.
- Config: `ORY_HYDRA_*` env (issuer, admin URL, audience, JWKS URI). Documented `.env.example`
  additions. Default OFF.

### C2 — token → workspace_id resolver
- `resolveWorkspaceFromToken(claims)` — map a validated token's subject/claim to a `workspace_id`,
  then hand off to `authorizeKnowledgeWorkspaceRequest`. The mapping model: a token claim
  (e.g. `workspace_id` or a subject→workspace lookup table). **Wrong mapping = expensive re-key
  (R4)** — keep the mapping in ONE place, well-tested, and fail closed (no claim → 401; unknown
  workspace → 403).

### C3 — multi-tenant isolation tests (the proof)
- Two tenants, two tokens, two upstream targets. Assert: tenant A's token resolves only A's
  workspace/target; A's token against B's target → 403 `workspace_scope_mismatch`; missing/expired/
  wrong-aud token → 401; no claim → 401. Mirror the existing chokepoint tests.

## Out of scope (this task)
A LIVE remote `/mcp` route or any public ingress (that is the separate go-live step — needs the
security review + Hydra actually provisioned); request-scoped BYO-key entailment (D-e); the full Ory
Hydra deployment/infra (this is app-side validation, not standing up Hydra); CIMD beyond a noted
SHOULD; gateway routing (Phase D).

## Green bar + gates
- Typecheck + unit tests (hermetic, injected Hydra/JWKS) + OSV gate green.
- **High-risk-security review** (auth chokepoint, token validation, tenant isolation, SvelteKit server
  routes) before PR/merge.
- **Flag-gated**, default OFF. No live remote endpoint. Merging changes no prod runtime behaviour.
