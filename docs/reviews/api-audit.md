---
title: Restormel API Layer & AAIF Audit
class: technical
owner: founder
status: approved
classification: internal
control-tier: 1
created: 2026-06-13
last-reviewed: 2026-06-13
review-interval: P12M
---

# Restormel API Layer & AAIF Audit

**Date:** 2026-06-05  
**Scope:** Read-only diagnosis of the Zuplo gateway, all HTTP API surfaces, and the `@restormel/aaif` package.  
**Audience:** External reviewers producing an implementation plan.  
**Method:** Code and config inspection across `zuplo-gateway/`, `apps/dashboard/src/routes/**`, `packages/aaif/`, `packages/mcp/`, `packages/core/src/server/`, and canonical OpenAPI specs.

---

## Executive summary

Restormel exposes **three distinct HTTP surfaces** that are easy to confuse:

1. **Zuplo Gateway** (`*.zuplo.app`) — consumer keys (`zpka_…`) at the edge; forwards with a single injected Gateway key (`KEYS_BACKEND_API_KEY`).
2. **Suite v1 REST** (`restormel.dev/keys/v1/*`, `/graph/v1/*`, `/connect/v1/*`) — versioned public paths on the site origin; Gateway key (`rk_…`) or session.
3. **Dashboard Control Plane API** (`restormel.dev/keys/dashboard/api/*`) — 124 route handlers; Gateway key, management key, or session; documented in `docs/api/openapi.yaml` (v1.6.0) but only a **subset** is wired through Zuplo.

The **RetrievalOrchestrator** (`@restormel/graphrag-core`) is wired to `POST /connect/v1/graph` (site origin only — **not** on Zuplo) and MCP `connect.graph.*` tools. The legacy **`POST /connect/v1/retrieve`** path is on Zuplo but still uses `retrieveContext` / `retrieveContextFromSeed` and does **not** use workspace domain-pack config resolution.

**AAIF** (`@restormel/aaif` v0.0.18) is a published, CI-tested **foundation** for typed host envelopes and Keys routing/cost helpers. It is **not** connected to retrieval, Connect REST, or MCP execution paths.

---

## Section 1: Endpoint inventory

Endpoints are grouped by domain. **ZUPLO** column lists inbound policies when the route is in `zuplo-gateway/config/routes.oas.json`; `—` means dashboard/site origin only.

Policy stack (when ZUPLO = full): `api-key-inbound` → `rate-limit-inbound` (100/min/user) → `quota-inbound` (10k/month/user) → `inject-backend-auth`.

### Ingestion

```
ENDPOINT: POST /connect/v1/ingest/jobs
PURPOSE:  Create a workspace-scoped Knowledge Ingest job (persisted to Postgres).
AUTH:     Gateway key (rk_…), management key, or session; workspace_id + optional project_id in body.
INPUT:    ConnectIngestJobCreateRequest — workspace_id, sources[], optional label, stop_after_stage, pipeline_profile_id, domain_pack_id, graph_target_id.
OUTPUT:   201 { contract_version, job: ConnectIngestJob }
ZUPLO:    full stack → KEYS_SITE_ORIGIN
STATUS:   partial — persistence works; worker execution depends on hosted worker + BYO graph/routes; Zuplo OAS still documents 501 (stale).
NOTES:    Handler comment: "Stage execution remains in SOPHIA workers until 5d". quality_report stripped by ConnectIngestJobSchema.parse on response.
          File: apps/dashboard/src/routes/(marketing)/connect/v1/ingest/jobs/+server.ts
                apps/dashboard/src/lib/server/connect-v1/ingest-handler.ts

ENDPOINT: GET /connect/v1/ingest/jobs?workspace_id=&project_id=
PURPOSE:  List ingest jobs for a workspace.
AUTH:     Same as create.
INPUT:    Query: workspace_id (required), project_id (optional).
OUTPUT:   200 { contract_version, jobs: ConnectIngestJob[] }
ZUPLO:    full stack
STATUS:   partial
NOTES:    Zuplo OAS documents 501 (stale). quality_report not in public contract schema.

ENDPOINT: GET /connect/v1/ingest/jobs/{jobId}?workspace_id=&project_id=
PURPOSE:  Poll single job status.
AUTH:     Same as create.
INPUT:    Path jobId; query workspace_id, project_id.
OUTPUT:   200 { contract_version, job }; 404 not_found
ZUPLO:    full stack
STATUS:   partial
NOTES:    No live log streaming (?since=) on public v1 — that exists only on dashboard BFF (see below).

ENDPOINT: POST /keys/dashboard/api/connect/ingest/jobs
PURPOSE:  Operator UI — create ingest job (session auth).
AUTH:     Session only (resolveKnowledgeSessionContext).
INPUT:    Dashboard create schema (richer than public v1).
OUTPUT:   Job record with operator fields.
ZUPLO:    —
STATUS:   working (operator path)
NOTES:    Not for external integrators; ~40 routes under /keys/dashboard/api/connect/**.

ENDPOINT: GET /keys/dashboard/api/connect/ingest/jobs/{jobId}/status?since=
PURPOSE:  Incremental live status + log lines for run console.
AUTH:     Session only.
INPUT:    jobId; optional since log cursor.
OUTPUT:   { workspace_id, job, log_lines[], log_line_total, since }
ZUPLO:    —
STATUS:   working (dashboard only)
NOTES:    Includes progress.quality_report when present in DB; public v1 strips it via Zod schema.

ENDPOINT: POST /keys/dashboard/api/connect/ingest/jobs/{jobId}/restart
         POST /keys/dashboard/api/connect/ingest/jobs/{jobId}/cancel
PURPOSE:  Operator job control.
AUTH:     Session.
ZUPLO:    —
STATUS:   working (dashboard only)

MCP: connect.ingest.start
PURPOSE:  Validate ingest create JSON only — does NOT proxy to REST.
AUTH:     N/A (stdio MCP env: RESTORMEL_GATEWAY_KEY for other tools).
STATUS:   partial / stub — description still says "returns 501 upstream until Phase 5b" though REST now persists.
File: packages/mcp/src/register-suite-tools.ts:361-388

MCP: connect.ingest.status
PURPOSE:  Validate jobId + return hint text — does NOT call GET /connect/v1/ingest/jobs/{id}.
STATUS:   partial / stub
```

### Retrieval

```
ENDPOINT: POST /connect/v1/retrieve
PURPOSE:  Return context_block (+ optional context_pack, graph) for a natural-language query against workspace BYO Surreal graph.
AUTH:     Connect v1 auth (gateway / management / session + workspace scoping).
INPUT:    ConnectRetrieveRequest — workspace_id, query, optional depth, domain_hint, max_claims, seed_claim_id.
OUTPUT:   ConnectRetrieveResponse — contract_version, request_id, context_block, metadata (retrieval_degraded, retrieval_degraded_code).
ZUPLO:    full stack
STATUS:   working logic; often degraded without BYO Surreal + embeddings configured.
NOTES:    Uses OLD retrieval: retrieveContext / retrieveContextFromSeed from @restormel/graphrag-core.
          Does NOT call resolveWorkspaceRetrievalConfig — domain_hint passed as PhilosophicalDomain only.
          Returns HTTP 200 with retrieval_degraded: true (not an error status).
          File: apps/dashboard/src/lib/server/connect-v1/retrieve-service.ts:109-118

ENDPOINT: POST /connect/v1/graph
PURPOSE:  Higher-order graph retrieval via RetrievalOrchestrator (retrieve_context, expand_context, find_relevant_subgraph, find_paths, summarise_subgraph).
AUTH:     Connect v1 auth.
INPUT:    ConnectGraphOpRequest — operation + operation-specific fields; optional verification_policy (supported/weak/unsupported, min_trust_score).
OUTPUT:   ConnectGraphOpResponse — context_block, subgraph/paths, trace, metadata.
ZUPLO:    — **not in routes.oas.json** (site origin only; MCP must call restormel.dev directly)
STATUS:   working — integration tests in graph-api.test.ts; uses resolveWorkspaceRetrievalConfig per workspace.
NOTES:    Preferred migration target for retrieval. Absent from Zuplo gateway and developer portal API reference.
          File: apps/dashboard/src/routes/(marketing)/connect/v1/graph/+server.ts
                apps/dashboard/src/lib/server/connect-v1/graph-orchestrator-service.ts

ENDPOINT: POST /connect/v1/verify
PURPOSE:  Run verification pipeline (extraction/reasoning/constitutional) against published dashboard verification route.
AUTH:     Connect v1 auth.
INPUT:    ConnectVerifyRequest — workspace_id, environment_id, verify payload.
OUTPUT:   ConnectVerifyResponse — result object; 503 if no published route.
ZUPLO:    full stack
STATUS:   working when verification route + provider credentials configured.

ENDPOINT: POST /keys/dashboard/api/connect/invoke
PURPOSE:  HTTP mirror for Connect agent tools (session or gateway key).
AUTH:     Session or gateway key + workspace auth.
ZUPLO:    —
STATUS:   working (dashboard BFF)

MCP: connect.search, connect.get_context_for, connect.retrieve (deprecated)
PURPOSE:  Proxy to POST /connect/v1/retrieve (old retrieval).
File: packages/mcp/src/connect-tools-logic.ts

MCP: connect.graph.retrieve_context | expand_context | find_relevant_subgraph | find_paths | summarise_subgraph
PURPOSE:  Proxy to POST /connect/v1/graph (RetrievalOrchestrator).
File: packages/mcp/src/connect-knowledge-tools.ts
```

### Graph management

```
ENDPOINT: POST /graph/v1/layout
PURPOSE:  Compute orbital layout from inline snapshot JSON (no server-side snapshot store).
AUTH:     none on origin handler; Zuplo may require consumer key when called via gateway.
INPUT:    { snapshot: { nodes[], edges[] }, optional dimensions }.
OUTPUT:   { contractVersion, generatedAt, layout: { width, height, positions }, meta }
ZUPLO:    full stack
STATUS:   working
NOTES:    Public unauthenticated on direct origin — abuse/DoS surface. No workspace scoping.
          File: apps/dashboard/src/routes/graph/v1/layout/+server.ts

ENDPOINT: GET /graph/v1/snapshots/{snapshotId}
PURPOSE:  Hosted snapshot read (planned Phase 6).
AUTH:     none.
OUTPUT:   Always 404 { error: snapshot_not_found, message, snapshotId }
ZUPLO:    full stack
STATUS:   stub
          File: apps/dashboard/src/routes/graph/v1/snapshots/[snapshotId]/+server.ts:14-22

ENDPOINT: (dashboard only) /keys/dashboard/api/connect/graph/*
PURPOSE:  Graph CRUD — units, embed, revalidate, link-sources, relations preview (~12 routes).
AUTH:     Session only.
ZUPLO:    —
STATUS:   working for operators; not exposed as /connect/v1 or /graph/v1 public API.

ENDPOINT: (dashboard only) /keys/dashboard/api/connect/domain-packs/*
PURPOSE:  Domain pack selection, design, listing.
AUTH:     Session.
ZUPLO:    —
STATUS:   working (operator); no public v1 domain-pack management API.
```

### Authentication and keys

```
ENDPOINT: GET /api/health
PURPOSE:  Dashboard health check.
AUTH:     none at gateway (security: [] in routes.oas.json); canonical openapi.yaml says auth required — contradiction.
OUTPUT:   { status, service }
ZUPLO:    none (public inbound)
STATUS:   working
NOTES:    launch-checklist.sh expects 401 without key — conflicts with current Zuplo route config.

ENDPOINT: GET/POST /api/projects ; GET/PATCH/DELETE /api/projects/{id}
PURPOSE:  Workspace project CRUD.
AUTH:     Zuplo consumer key → injected rk_… ; dashboard verifies gateway key / session.
ZUPLO:    full stack → KEYS_BACKEND_URL
STATUS:   working

ENDPOINT: GET/POST/DELETE /api/projects/{id}/keys
PURPOSE:  List, create, revoke Gateway keys (rk_…) for a project.
AUTH:     Same; POST also triggers ensureZuploConsumer for portal.
OUTPUT:   POST returns rawKey once; stored as hash+prefix only.
ZUPLO:    full stack
STATUS:   working
          File: apps/dashboard/src/routes/keys/dashboard/api/projects/[id]/keys/+server.ts

ENDPOINT: POST /keys/v1/projects/{projectId}/resolve
PURPOSE:  Resolve provider/model/stepChain for a project route (primary integrator hot path).
AUTH:     Gateway key (project match), management key, or session.
INPUT:    environmentId, routeId, stage, workload, task, attemptNumber, traceId, constraints, …
OUTPUT:   { data: { contractVersion: 2026-04-16, providerType, modelId, stepChain, decisionMetadata, … } }
ZUPLO:    full stack → KEYS_SITE_ORIGIN
STATUS:   working
NOTES:    Delegates to dashboard handler. Errors use { error, message } snake-ish codes.

ENDPOINT: GET /keys/v1/catalog ; GET /keys/v1/models
PURPOSE:  Global model catalog listings.
AUTH:     public (no locals.user check on re-exported handlers).
ZUPLO:    full stack
STATUS:   working
NOTES:    catalog uses contractVersion (camelCase); connect uses contract_version (snake_case).

ENDPOINT: POST /keys/v1/policies/evaluate
PURPOSE:  Evaluate policy violations for a model/route context.
AUTH:     Gateway key or session; management key rejected (403).
ZUPLO:    full stack
STATUS:   working

ENDPOINT: POST /v1/testing/resolve-model
PURPOSE:  Resolve logical ref to provider model + decrypted hosted credential for Testing module.
AUTH:     Gateway key only.
ZUPLO:    —
STATUS:   working (site origin; not in Zuplo routes.oas.json)

ENDPOINT: POST /api/suite/invoke
PURPOSE:  HTTP mirror of read-only suite MCP tools (docs.canonical_resolve, testing.config_validate, etc.).
AUTH:     Zuplo → injected gateway key.
INPUT:    { tool, payload? }
OUTPUT:   Tool structuredContent; may return ok:false in body with HTTP 200.
ZUPLO:    full stack
STATUS:   working
          File: apps/dashboard/src/routes/keys/dashboard/api/suite/invoke/+server.ts

ENDPOINT: GET /keys/dashboard/api/consumer-key
PURPOSE:  Portal "My Keys" — return zpka_… for signed-in user's workspace (OIDC JWT cross-origin).
AUTH:     Bearer OIDC JWT from /keys/auth.
ZUPLO:    —

ENDPOINT: POST /keys/dashboard/api/cli/device/start | authorize | token
PURPOSE:  OAuth2 device flow; issues rk_… gateway key to CLI.
AUTH:     start/token public (rate-limited); authorize requires session.
STATUS:   working

ENDPOINT: GET /keys/auth/userinfo
PURPOSE:  OIDC userinfo for developer portal.
AUTH:     Bearer JWT.
STATUS:   working

ENDPOINT: (dashboard) full control plane — see Appendix A
PURPOSE:  Routes, steps, policies, runtime invoke/jobs, integrations, billing, webhooks CRUD, etc.
AUTH:     Gateway key, management key, or session per route.
ZUPLO:    only subset (projects, keys, suite/invoke) — remainder dashboard-host only.
```

### Webhooks

```
ENDPOINT: GET/POST/DELETE /keys/dashboard/api/webhooks
PURPOSE:  CRUD workspace webhook endpoints (HTTPS URL + event types).
AUTH:     Session / workspace actor.
ZUPLO:    —
STATUS:   working (outbound delivery infrastructure exists)
NOTES:    deliverWorkspaceWebhookEvent fires on policy.published — NOT on connect_ingest_completed.
          Ingest completion only captured to PostHog (connect_ingest_completed). No public webhook receiver for integrators.

ENDPOINT: POST /keys/dashboard/api/billing/webhook
PURPOSE:  Inbound Paddle billing events.
AUTH:     Paddle signature.
ZUPLO:    —
```

### Other

```
ENDPOINT: POST /graph/v1/layout — (listed under Graph)

TESTING RUNS SIDECAR (@restormel/testing-runs-server, separate Node process):
  GET  /health
  POST /v1/runs
  GET  /v1/runs ; GET /v1/runs/:id
AUTH: optional RESTORMEL_RUNS_API_TOKEN Bearer.
STATUS: working — docs/archive/testing/testing/runs-api-v1.md

@restormel/core server library (embedded in consumer apps, not hosted):
  GET/POST/DELETE /keys (configurable) — key wallet via createMiddleware
  createResolveMiddleware — resolve before proxy
  createProxy — forward to provider APIs
AUTH: host-supplied auth.getUserId()
File: packages/core/src/server/middleware.ts, proxy.ts

MCP stdio (@restormel/mcp):
  Keys control plane tools → RESTORMEL_CONTROL_PLANE_URL + /api/... (legacy dashboard paths, not /keys/v1)
  Connect tools → RESTORMEL_CONNECT_API_BASE + /connect/v1/*
  Suite read tools → local validation or suite/invoke mirror
  Env: RESTORMEL_GATEWAY_KEY, RESTORMEL_SERVER_TOKEN, RESTORMEL_WORKSPACE_ID

DOCS / SPEC (read-only HTTP):
  GET /keys/docs/api/openapi.yaml — legacy Keys OpenAPI
  GET /keys/dashboard/api/openapi.yaml — same spec served from dashboard
```

### Appendix A: Dashboard Control Plane API (`/keys/dashboard/api/*`)

**124 route handlers** exist. Canonical path list is in `docs/api/openapi.yaml` (v1.6.0). Zuplo forwards only:

| Zuplo path | Dashboard equivalent |
|------------|---------------------|
| `/api/health` | `/keys/dashboard/api/health` or healthcheck |
| `/api/projects*` | `/keys/dashboard/api/projects*` |
| `/api/suite/invoke` | `/keys/dashboard/api/suite/invoke` |

All other `/api/*` paths in `openapi.yaml` (resolve, routes, steps, policies, catalog, models, runtime invoke/jobs, etc.) are **documented** but require calling **`https://restormel.dev/keys/dashboard/api/...`** directly with `rk_…`, not the Zuplo gateway (unless manually added to `routes.oas.json`).

**Route groups (path suffixes under `/keys/dashboard/api/`):**

| Group | Paths | Typical auth |
|-------|-------|--------------|
| Projects & keys | `/projects`, `/projects/[id]`, `/projects/[id]/keys`, `/projects/[id]/environments`, `/projects/[id]/readiness`, `/projects/[id]/route-coverage`, `/projects/[id]/routing-capabilities`, `/projects/[id]/switch-criteria-enums` | gateway / session / mgmt |
| Resolve & runtime | `/projects/[id]/resolve`, `/projects/[id]/routes/[routeId]/runtime/invoke`, `.../runtime/jobs`, `.../runtime/jobs/[jobId]` | gateway / session |
| Routes & steps | `/projects/[id]/routes`, `.../[routeId]`, `.../steps`, `.../steps/[stepId]`, `.../publish`, `.../rollback`, `.../history`, `.../simulate`, `.../export`, `.../explain-chain`, `.../validate-binding`, `.../recommend`, `.../primary-model`, `.../graph`, `/projects/[id]/routes/import`, `/projects/[id]/route-steps` | gateway / session |
| Models & catalog | `/models`, `/models/[id]`, `/catalog`, `/catalog/observations`, `/projects/[id]/models`, `.../models/[bindingId]`, `/projects/[id]/provider-bindings`, `/projects/[id]/providers/health` | mixed; catalog public on v1 re-export |
| Policies | `/policies`, `/policies/[id]`, `.../bindings`, `.../history`, `.../publish`, `.../rollback`, `.../diff`, `/policies/evaluate` | gateway / session |
| Integrations | `/integrations`, `/integrations/[id]`, `.../bindings`, `.../models`, `.../verify`, `.../import/openrouter-activity` | session only (rejects gateway keys) |
| Connect operator | `/connect/**` (~45 paths: ingest, pipeline, graph, sources, domain-packs, invoke) | session only |
| Auth & CLI | `/auth/*`, `/cli/device/*`, `/consumer-key` | mixed |
| Admin & billing | `/admin/users`, `/billing/checkout`, `/billing/webhook` | session / Paddle |
| Observability | `/audit`, `/request-logs`, `/usage-aggregates`, `/feedback`, `/support-chat` | session |
| System | `/health`, `/healthcheck`, `/embed/healthcheck`, `/openapi`, `/openapi.yaml`, `/suite/invoke`, `/webhooks` | mixed |

**Test coverage:** 27 `*api*.test.ts` files under dashboard routes; Connect v1, Keys v1, resolve, policies, CLI device, bearer parsing covered. Graph v1 layout tests do not assert auth.

---

## Section 2: Zuplo configuration assessment

### Project layout

| File | Role |
|------|------|
| `zuplo-gateway/zuplo.jsonc` | Project metadata: `version: 1`, `compatibilityDate: 2025-02-06`, `managed-edge` |
| `zuplo-gateway/config/policies.json` | Four inbound policies (see below) |
| `zuplo-gateway/config/routes.oas.json` | OpenAPI 3.0.0 + `x-zuplo-route` per path (explicit routes only) |
| `zuplo-gateway/docs/zudoku.config.ts` | Developer portal (Zudoku) config |

### Policies configured

| Policy | Type | Behaviour |
|--------|------|-----------|
| `api-key-inbound` | ApiKeyInboundPolicy | Rejects unauthenticated; 60s cache; bucket `zprj-no1i522htqi4gzoh5uaex0sb-production` (hardcoded) |
| `rate-limit-inbound` | RateLimitInboundPolicy | 100 requests / minute / user (consumer) |
| `quota-inbound` | QuotaInboundPolicy | 10,000 requests / month / user; counts 200–399 |
| `inject-backend-auth` | SetHeadersInboundPolicy | `Authorization: Bearer $env(KEYS_BACKEND_API_KEY)` overwrites client header |

**Not configured:** CORS (`corsPolicy: "none"` on all routes), request transforms, outbound policies, WAF, custom domains, per-route rate tiers, request ID injection at edge.

### Developer portal (Zudoku)

- **API Reference:** generated from `config/routes.oas.json` with playground.
- **Docs pages:** introduction, how-it-fits-together, authentication-guide, integrations-mcp, dashboard-api (resolve, policies-evaluate, routes-steps).
- **My Consumer Key:** `/my-keys` — OIDC sign-in to `https://restormel.dev/keys/auth`; fetches `zpka_…` via dashboard `consumer-key` endpoint.
- **Protected routes:** `/api/*` in portal requires login for try-it.
- **Gap:** Portal documents dashboard-only APIs (resolve, routes) that are **not** served through Zuplo — easy surface confusion.

### OpenAPI accuracy

| Spec | Version | Accuracy |
|------|---------|----------|
| `zuplo-gateway/config/routes.oas.json` | 1.0.0 | **Partial** — 20 operations; ingest jobs still document 501 though implementation persists jobs; health marked public while runbooks expect auth |
| `docs/api/openapi.yaml` | 1.6.0 | **Broader** — full dashboard control plane; auth described as required for all endpoints including health |
| `docs/api/openapi-suite-v1-draft.yaml` | 0.2.0-draft | **Most accurate for suite v1** — marks implemented paths; contract_version 2026-06-01 for Connect |

Repo validators: `scripts/validate-zuplo-keys-v1.mjs`, `validate-zuplo-graph-v1.mjs`, `validate-zuplo-connect-v1.mjs`, `zuplo-gateway/scripts/check-openapi.mjs` (control-plane subset only).

**Connect v1 on Zuplo (actual `routes.oas.json` paths):** `/connect/v1/verify`, `/connect/v1/retrieve`, `/connect/v1/ingest/jobs`, `/connect/v1/ingest/jobs/{jobId}` only. **`POST /connect/v1/graph` is implemented on the site origin but is not registered on the gateway** — Zuplo consumers cannot reach the RetrievalOrchestrator without calling `restormel.dev` directly with a Gateway key.

### API key generation and scoping

| Key type | Format | Scope | Issuance |
|----------|--------|-------|----------|
| Zuplo consumer | `zpka_…` | Per **workspace** (`ws_{workspaceId}`) | Zuplo API / `ensureZuploConsumer` |
| Gateway | `rk_…` | Per **project** | Dashboard `POST .../projects/{id}/keys` or CLI device flow |
| Zuplo backend secret | `rk_…` | Single project bound to `KEYS_BACKEND_API_KEY` | Manual env / setup script |

**Critical:** All Zuplo consumers share **one** backend Gateway key identity after `inject-backend-auth`. Edge consumer identity does not map to per-project backend keys.

### Versioning

- URL paths: `/keys/v1/*`, `/graph/v1/*`, `/connect/v1/*` on site origin.
- Control plane `/api/*` has **no** version prefix.
- Resolve response uses `contractVersion` field (`2026-04-16` in openapi.yaml).
- Connect uses `contract_version` (`2026-06-01` in `@restormel/contracts/connect`).
- No `Accept-Version` header versioning.

### Missing for production gateway

1. Catch-all or codegen sync — new dashboard `/api/*` routes are not forwarded until manually added to `routes.oas.json`.
2. `KEYS_SITE_ORIGIN` not set by `setup-from-cli.sh` (only `KEYS_BACKEND_URL` + `KEYS_BACKEND_API_KEY`).
3. Health auth inconsistency (public route vs launch checklist).
4. Stale Zuplo OAS for ingest (501) and README catch-all `/(.*)` reference.
5. Hardcoded Zuplo bucket name in policies.json.
6. No CORS for browser clients.
7. Fixed rate/quota — no tiering.
8. No CI deploy workflow for Zuplo in repo.
9. Single shared backend key — no per-consumer project mapping at gateway.
10. No `.env.example` in zuplo-gateway tree (README references it).

---

## Section 3: Authentication model

### How developers authenticate today

| Surface | Credential | Header | Where to get it |
|---------|------------|--------|-----------------|
| Zuplo Gateway | Consumer key `zpka_…` | `Authorization: Bearer zpka_…` | Developer portal My Keys (OIDC) or Zuplo API |
| Suite v1 / Connect direct | Gateway key `rk_…` | `Authorization: Bearer rk_…` | Dashboard → Project → API Keys, or CLI `login` |
| Dashboard control plane | `rk_…` or session cookie | Bearer or cookie | Same |
| MCP | `RESTORMEL_GATEWAY_KEY` (= `rk_…`) | N/A (stdio) | Dashboard keys |
| Portal OIDC | JWT | Bearer | `/keys/auth` OAuth flow |

**`zpka_…` sent directly to `restormel.dev` fails** — dashboard only verifies `rk_…` and management keys (`verifyGatewayKey` in `neon.ts`).

### Dashboard session vs API auth

**Disconnected by design** but overlapping:

- **Session:** Neon Auth cookies via `getSession()` → `authType: "session"`. Used for dashboard UI, CLI authorize, portal SSO.
- **Gateway key:** `authType: "gateway_key"`, `projectIdForKey` set. Used for machine clients.
- **Management key:** `authType: "management_key"`, `workspaceId` set. Verify exists; **no issuance UI/API found**.
- **Hooks precedence:** Session is resolved first; Bearer tried when no session (`hooks.server.ts`).

Same physical key format (`rk_…`) for CLI output and manual API keys, but **different from** `zpka_…` and OIDC JWTs.

### API key generation from dashboard

**Yes:** Project settings → API Keys → `POST /keys/dashboard/api/projects/{id}/keys` (or via Zuplo `POST /api/projects/{id}/keys`). Returns `rawKey` once. Side effect: `ensureZuploConsumer` for portal try-it.

**No:** Per-key scopes (read-only vs write), route-level entitlements, or project picker for Zuplo consumer keys (workspace-level only).

### Security concerns

1. **Shared Zuplo backend key** — all consumers impersonate same project on backend.
2. **No scope enforcement** on `api_keys.scope` column (migration 004 groundwork unused).
3. **Graph v1 layout unauthenticated** on origin.
4. **CLI device flow** returns full `rk_…` via poll endpoint.
5. **Management keys** referenced in docs/code but no documented rotation/creation path.
6. **Policy evaluate** rejects management keys while other routes accept them — inconsistent.
7. **Integrations API** rejects gateway keys entirely — integrators must use session.

---

## Section 4: Relationship to the retrieval orchestrator

`RetrievalOrchestrator` (`packages/graphrag-core/src/orchestrator/`) exposes: `retrieveContext`, `expandContext`, `findRelevantSubgraph`, `findPaths`, `summariseSubgraph`.

| Endpoint / tool | Engine | Workspace domain config | Migration path |
|-----------------|--------|-------------------------|----------------|
| `POST /connect/v1/retrieve` | `retrieveContext` / `retrieveContextFromSeed` (legacy) | **No** — optional `domain_hint` as `PhilosophicalDomain` only | Deprecate in favour of `POST /connect/v1/graph` operation `retrieve_context`; align MCP `connect.search` to graph endpoint |
| `POST /connect/v1/graph` (all ops) | `RetrievalOrchestrator` | **Yes** — `resolveWorkspaceRetrievalConfig` (domain pack → `RetrievalConfig`; philosophy fallback) | **Current** |
| MCP `connect.graph.*` | Proxies to `/connect/v1/graph` | Yes (via REST) | **Current** |
| MCP `connect.search` / `connect.get_context_for` | Proxies to `/connect/v1/retrieve` | No | Update to graph op |
| Dashboard `connect/graph/*` BFF | Direct Surreal/graph services | Operator UI | Remains internal |

**Philosophy fallback:** `workspace-retrieval-config.ts:21-27` returns `philosophyRetrievalConfig` when no pack selected or on error — orchestrator path is domain-agnostic in intent but **defaults to philosophy taxonomy**.

**Gaps where endpoints should exist but do not:**

- No public v1 **expand-only** or **path-finding** except via `/connect/v1/graph` (exists — underdocumented).
- No public **domain pack management** API (dashboard session only).
- `POST /connect/v1/retrieve` should be documented as **legacy** in OpenAPI and portal.

---

## Section 5: Relationship to the ingestion pipeline

Pipeline stages (canonical): Extract → Relate → Group → Embed → Validate → (Remediate) → Store.

| Capability | Public v1 API | Dashboard operator API | Status |
|------------|---------------|------------------------|--------|
| Trigger run programmatically | `POST /connect/v1/ingest/jobs` | `POST .../connect/ingest/jobs` | **Yes** — job row created |
| Poll run status | `GET /connect/v1/ingest/jobs/{id}` | `GET .../connect/ingest/jobs/{id}/status?since=` | **Partial** — public lacks log streaming |
| Quality report (trust score, ok/weak/unsupported) | **No** — stripped by `ConnectIngestJobSchema.parse` | **Yes** — in `progress.quality_report` via DB + run console | **Gap on public API** |
| Worker execution | `connect-ingest-worker.ts` (hosted) | same | **Partial** — full mode needs BYO Surreal + Keys routes; stub mode available |
| Webhook on completion | **No** — PostHog event only (`connect_ingest_completed`) | N/A | **Gap** |
| MCP ingest tools | Validate-only stubs | N/A | **Gap** — no proxy to REST |

**Quality report** is built in `buildRunQualityReport` (`run-quality-report.ts`) with `kg_audit.trust_score`, validation counts, `stub_warning`. Persisted on job progress in Postgres (`neon.ts:5171-5180`) but **`ConnectIngestJobProgressSchema` in contracts omits `quality_report`**, so public handlers strip it at `ConnectIngestJobSchema.parse` (`ingest-handler.ts:152`).

**Zuplo OAS drift:** ingest routes still advertise 501 responses though handlers return 201/200.

---

## Section 6: AAIF package assessment

**Location:** `packages/aaif/` (v0.0.18, publish tag `platform-v*` sibling or dedicated `publish-aaif.yml`).

### What AAIF stands for

**Agent-to-Agent Interaction Format** — Restormel-owned typed request/response contract, **not** Google A2A, MCP, or OpenAI Responses API.

### What it implements (actual code)

| Module | Function |
|--------|----------|
| `types.ts` | `AAIFRequest`, `AAIFResponse`, routing hints (`routingContext`, `routingPlan`), `integrationStack` |
| `validate.ts` | `isAAIFRequest`, `isAAIFResponse` structural guards |
| `integration-stack-catalog.ts` | `INTEGRATION_CATALOG`, `INTEGRATION_STACK_TEMPLATES`, component IDs for marketing/stack wizard |
| `suite-tool-names.ts` | `RestormelSuiteToolName` union (duplicate of MCP list — **stale**, missing 5 `connect.graph.*` tools) |
| `runtime.ts` | `executeAAIFRequest` — validates request, calls `@restormel/keys` `resolve` + `estimateCost`, enforces `maxCost`; **does not call LLMs or HTTP resolve** |

### Completeness

**Useful foundation — not skeleton, not full protocol.**

- Published npm package with CI tests (`runtime.test.ts` — 10 tests: cost, maxCost, generate callback, embedding task, integrationStack validation).
- `isAAIFResponse` **untested**; `routingContext` validation shallow; `routingPlan` accepts any object.
- Deliberate non-goals documented: no HTTP resolve, no upstream LLM calls.

### Connection to rest of product

| Consumer | Usage |
|----------|-------|
| `packages/connect-core/ingest/plan.ts` | Builds `AAIFRequest` per ingest stage for routing vocabulary |
| Dashboard `StackSetupWizard.svelte`, `EcosystemStrip.svelte`, integration catalog pages | `INTEGRATION_CATALOG`, stack templates |
| `@restormel/mcp` | **Not imported** — tool names duplicated |
| Connect REST / RetrievalOrchestrator | **Not imported** |
| Zuplo / API routes | **Not referenced** |

### Tests

Vitest in `runtime.test.ts`; CI runs `pnpm --filter @restormel/aaif run test`. High confidence they pass when workspace built (depends on `@restormel/keys`).

### Protocol / spec

Custom Restormel JSON shapes aligned with `docs/architecture/keys-routing-contract.md`. `docs/integrations/INTEGRATIONS-FULL-SPEC.md` §8 **lags** current types (missing `routingPlan`, `integrationStack`, etc.).

### Connection to retrieval orchestrator and MCP

- **No direct coupling.** Retrieval is MCP `connect.graph.*` → `/connect/v1/graph` → `RetrievalOrchestrator`.
- **Indirect:** ingest planning uses `AAIFRequest` as vocabulary parallel to resolve hints; `integrationStack` is host metadata only.
- **MCP parity drift:** AAIF `suite-tool-names.ts` missing graph orchestrator tool names present in `packages/mcp/src/suite-tool-names.ts`.

### What meaningful integration would require

1. Sync or share `RestormelSuiteToolName` with MCP (single source).
2. Document AAIF as host envelope for resolve-then-execute; keep orchestrator on HTTP/MCP.
3. Optionally expose AAIF-validated bodies on `POST /api/suite/invoke` or a dedicated route (not present today).
4. Update stale integration spec §8.

### Honest assessment

**Useful foundation** for Keys-aligned in-app hosts and marketing/integration catalog — **not** a working agent protocol or API layer component. Maintenance overhead is modest (small package) but **no user-facing API capability** depends on it yet.

---

## Section 7: The "bolt-on" diagnosis

### 1. ENDPOINT / PRODUCT MISMATCH

| Issue | Evidence |
|-------|----------|
| Dual retrieval stacks | `retrieve-service.ts:11-14` imports `retrieveContext` (legacy); `graph-orchestrator-service.ts:17-24` imports `RetrievalOrchestrator`. Same product exposes two semantics. |
| Legacy retrieve returns 200 when degraded | `retrieve-service.ts:122-128` sets `preDegraded` true for missing graph, zero claims, etc.; still HTTP 200 with `retrieval_degraded: true`. |
| Philosophy-default config | `workspace-retrieval-config.ts:21-27` falls back to `philosophyRetrievalConfig` — orchestrator path inherits philosophy taxonomy when pack missing. |
| Retrieve ignores domain packs | `retrieve-service.ts` never calls `resolveWorkspaceRetrievalConfig` — domain packs only affect `/connect/v1/graph`. |
| Graph snapshot stub | `snapshots/[snapshotId]/+server.ts:14-22` always 404 — documented in OAS as Phase 2 stub. |
| Ingest public contract lags operator reality | Worker writes `quality_report` (`connect-ingest-worker.ts:268-271`) but public API strips it (`ingest-handler.ts:152` + contracts schema). |
| Zuplo OAS says 501 for ingest | `routes.oas.json:506-543` — implementation returns 201/200. |
| MCP ingest tools validate-only | `register-suite-tools.ts:365` description still references 501 / Phase 5b. |
| `connect.retrieve` deprecated but present | MCP still registers deprecated tool pointing at old endpoint. |
| Control plane vs suite v1 split | Resolve exists at both `/keys/dashboard/api/projects/{id}/resolve` and `/keys/v1/projects/{projectId}/resolve` — same handler, different URL story. |
| Integrations API session-only | `integrations-auth.ts` rejects gateway keys — machine clients cannot manage connections via API. |

### 2. AUTH DISCONNECTION

Developers encounter **four token species**: session cookies, `rk_…`, `zpka_…`, OIDC JWT — each with different validation paths and error shapes.

| Symptom | Evidence |
|---------|----------|
| zpka vs rk | `zuplo-consumer.ts` provisions `zpka_…`; `verifyGatewayKey` only accepts `rk_…` (`neon.ts`). |
| Zuplo strips consumer identity | `inject-backend-auth` in `policies.json` replaces Authorization with single `KEYS_BACKEND_API_KEY`. |
| Error format split | Resolve: `{ error, message }`; suite/invoke: `{ ok: false, code, message }`; Connect v1: `{ error, message }` with snake_case error codes; some dashboard routes: `{ error: "Unauthorized" }` (string only). |
| Management key ambiguity | Code paths accept `management_key` for Connect v1 and resolve; policy evaluate **rejects** it; no creation documented. |
| Public catalog unauthenticated | `keys/v1/catalog` and `keys/v1/models` require no auth on origin — Zuplo still requires consumer key when proxied. |

### 3. DOCUMENTATION GAP

A developer would need to know (not consistently documented in one place):

1. **Two base URLs:** `*.zuplo.app` vs `restormel.dev` vs `restormel.dev/keys/dashboard`.
2. **Never send `zpka_…` to dashboard origin** — only to Zuplo.
3. **`/connect/v1/graph` exists** and supersedes `/connect/v1/retrieve` for orchestrator features — portal emphasises retrieve/verify.
4. **Quality reports are dashboard-only** — not in public Connect contract.
5. **Management keys** — verify exists, issuance does not.
6. **Graph layout is unauthenticated** on direct origin.
7. **Zuplo shared backend key** — workspace_id body fields must align with that key's project workspace.
8. **contractVersion vs contract_version** — Keys vs Connect naming split.
9. **124 dashboard routes** vs **20 Zuplo routes** — openapi.yaml describes more than gateway forwards.
10. **MCP control plane tools** hit legacy `/api/...` not `/keys/v1/...`.

### 4. INCONSISTENCY

| Area | Detail |
|------|--------|
| Contract version field | Keys: `contractVersion` (camelCase); Connect: `contract_version` (snake_case) |
| Error envelopes | Mix of `{ error }`, `{ error, message }`, `{ ok: false, code, message }` |
| HTTP 200 with errors | `POST /connect/v1/retrieve` degraded success; `POST /api/suite/invoke` may return tool-level `ok: false` with HTTP 200 |
| Auth error text | `"Unauthorized"` vs `"unauthorized"` vs `{ error: "unauthorized", message: "…" }` |
| Health auth | Public in Zuplo OAS vs auth-required in `docs/api/openapi.yaml` vs launch checklist expecting 401 |
| OpenAPI versions | Gateway 1.0.0 vs canonical 1.6.0 vs suite draft 0.2.0-draft |

### 5. MISSING STANDARD BEHAVIOURS

| Expected behaviour | Status |
|--------------------|--------|
| Pagination (cursor/limit) on list endpoints | Partial — catalog has offset/limit; ingest job list returns full workspace list |
| Filtering / sorting on jobs | Not on public v1 |
| Idempotency keys on job create | Absent |
| Request ID in all responses | Retrieve/graph set `X-Request-Id`; not universal |
| Webhooks for ingest completion | Absent (PostHog only) |
| Per-consumer backend identity at Zuplo | Absent |
| API key scopes | Schema only; not enforced |
| Rate limit headers | Zuplo internal; not documented for clients |
| CORS | Disabled (`corsPolicy: none`) |
| Consistent versioning header | Absent |
| OpenAPI accuracy for all implemented routes | Drift (ingest 501, health auth) |
| quality_report in public contract | Absent |

---

## Section 8: Gap summary

### CRITICAL

| # | Gap | Area | Section |
|---|-----|------|---------|
| C1 | Zuplo forwards all consumers with one `KEYS_BACKEND_API_KEY` — no per-consumer/project backend identity | Zuplo auth | §2, §3, §7 |
| C2 | Public ingest API omits quality_report (trust score, validation counts) despite worker producing it | Ingestion | §5, §7 |
| C3 | Dual retrieval (`/connect/v1/retrieve` legacy vs `/connect/v1/graph` orchestrator) — MCP and docs still steer to legacy | Retrieval | §4, §7 |
| C4 | Zuplo OAS documents ingest as 501 — inaccurate for adoption | Documentation | §2, §5 |
| C5 | Only 20 routes on Zuplo — openapi.yaml implies gateway access to resolve/routes/etc.; **`POST /connect/v1/graph` (orchestrator) not on gateway at all** | Gateway coverage | §1, §2, §4 |

### IMPORTANT

| # | Gap | Area | Section |
|---|-----|------|---------|
| I1 | No webhook for ingest job completion | Ingestion | §5 |
| I2 | MCP `connect.ingest.*` validate-only — no REST proxy | MCP | §1, §5 |
| I3 | `POST /connect/v1/retrieve` does not use domain pack config resolution | Retrieval | §4, §7 |
| I4 | Graph v1 layout unauthenticated on origin | Graph | §3, §7 |
| I5 | Management keys verifiable but not issuable via documented API | Auth | §3 |
| I6 | Health endpoint auth contradiction (public vs checklist vs canonical OAS) | Zuplo | §2, §7 |
| I7 | `KEYS_SITE_ORIGIN` not provisioned by default setup script | Zuplo deploy | §2 |
| I8 | No CORS at gateway — blocks browser-based third-party clients | Zuplo | §2 |
| I9 | Integrations API rejects gateway keys — no machine access to connections | Auth | §7 |
| I10 | AAIF `suite-tool-names` stale vs MCP (missing connect.graph.*) | AAIF | §6 |
| I11 | Public ingest lacks live log streaming (`?since=`) available on dashboard BFF | Ingestion | §1, §5 |
| I12 | Philosophy fallback when domain pack unset affects orchestrator path | Retrieval | §4, §7 |

### COSMETIC

| # | Gap | Area | Section |
|---|-----|------|---------|
| O1 | `contractVersion` vs `contract_version` naming split | Consistency | §7 |
| O2 | Mixed error envelope shapes across surfaces | Consistency | §7 |
| O3 | Zuplo OAS version 1.0.0 vs canonical 1.6.0 | Documentation | §2 |
| O4 | README references catch-all route and missing `.env.example` | Zuplo repo hygiene | §2 |
| O5 | Hardcoded Zuplo bucket name in policies.json | Config | §2 |
| O6 | `INTEGRATIONS-FULL-SPEC.md` §8 lags AAIF types | AAIF docs | §6 |
| O7 | Graph snapshots always 404 — expected stub but surprises integrators | Graph | §1 |

---

## Section 9: AAIF recommendation

**B. AAIF is a useful foundation that needs targeted contract-hygiene and parity work before it is production-ready as an API-layer component. Recommended timeline: after Connect v1 retrieval/ingest GA and MCP parity are stable (same programme milestone as `openapi-suite-v1-draft` promotion), not the next sprint.**

**Rationale:**

- AAIF is **not** a working API capability today — nothing in Zuplo, Connect REST, or MCP invokes `executeAAIFRequest` or validates AAIF on the wire.
- It **is** actively used for integration catalog UI and connect-core ingest **planning vocabulary** — deleting or parking it would break dashboard marketing/stack flows and ingest stage planning types.
- Integrating AAIF into the API layer **next sprint** would distract from critical gaps (C1–C5): shared Zuplo backend identity, retrieval path unification, ingest quality on public API, and gateway/OAS accuracy.
- **Specific work before API-layer integration:** (1) single-source `RestormelSuiteToolName` with MCP, (2) update integration spec §8, (3) tests for `isAAIFResponse`, (4) explicit decision on whether AAIF envelopes belong on `suite/invoke` or a new route — only after retrieval and ingest public contracts are honest.

**Not A** — no production API path depends on AAIF execution today.  
**Not C** — package is published, tested, and consumed; parking would create needless churn in dashboard and connect-core.

---

## Source file index

| Topic | Primary paths |
|-------|---------------|
| Zuplo routes | `zuplo-gateway/config/routes.oas.json` |
| Zuplo policies | `zuplo-gateway/config/policies.json` |
| Developer portal | `zuplo-gateway/docs/zudoku.config.ts` |
| Zuplo consumer provisioning | `apps/dashboard/src/lib/server/zuplo-consumer.ts` |
| Auth hooks | `apps/dashboard/src/hooks.server.ts` |
| Gateway key verify | `apps/dashboard/src/lib/server/neon.ts` (`verifyGatewayKey`) |
| Connect v1 auth | `apps/dashboard/src/lib/server/connect-v1/auth.ts` |
| Legacy retrieve | `apps/dashboard/src/lib/server/connect-v1/retrieve-service.ts` |
| Orchestrator | `apps/dashboard/src/lib/server/connect-v1/graph-orchestrator-service.ts` |
| Ingest public handler | `apps/dashboard/src/lib/server/connect-v1/ingest-handler.ts` |
| Ingest worker + quality | `apps/dashboard/src/lib/server/connect-ingest-worker.ts`, `run-quality-report.ts` |
| Connect contracts | `packages/contracts/src/connect.ts` |
| AAIF package | `packages/aaif/src/*` |
| MCP Connect tools | `packages/mcp/src/connect-knowledge-tools.ts`, `register-suite-tools.ts` |
| Canonical OpenAPI | `docs/api/openapi.yaml`, `docs/api/openapi-suite-v1-draft.yaml` |
| Runbooks | `docs/runbooks/zuplo-setup.md`, `docs/archive/zuplo-portal/zuplo-developer-portal-go-live.md` |

---

*End of audit. No code changes were made.*
