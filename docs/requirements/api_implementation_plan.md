# Restormel API Layer — Implementation Plan & Cursor Prompts

Based on audit dated 2026-06-05. Addresses gaps C1–C5 and I1–I12 in priority order.
AAIF deferred to a separate milestone after Phase 3 completes.

---

## Sequencing rationale

Phase 1 unblocks developer adoption immediately — nothing else matters if the
best endpoint isn't on the gateway and the docs say 501.

Phase 2 eliminates the dual-retrieval confusion — after Phase 1 a developer can
reach the orchestrator, but the legacy path still exists and misleads. Phase 2
removes the ambiguity.

Phase 3 completes the ingest public contract — quality reports, webhooks, live
logs, and real MCP tools. This is where the API starts delivering the product's
core promise to external consumers.

Phase 4 standardises auth and contract shape — the polish that makes the API
feel like a coherent product, not assembled parts.

Phase 5 adds standard API behaviours — pagination, idempotency, request IDs.
These are expected by any developer building on a production API.

---

## Phase 1 — Unblock the gateway (Opus 4.8)

Addresses: C3, C4, C5, I6, I7, I8

The four changes a developer needs before they can use the API productively.
No business logic changes. All changes are in Zuplo config and the gateway layer.

```
Using the API audit at docs/audit/api-audit.md and the source file index at
the bottom of that document, make the following changes to the Zuplo gateway
and related configuration. No changes to dashboard route handlers or service
logic in this phase.

1. ADD /connect/v1/graph TO THE ZUPLO GATEWAY (C5)
   This is the most important change in this phase. The RetrievalOrchestrator
   endpoint at POST /connect/v1/graph is the correct, production retrieval path
   and is currently absent from zuplo-gateway/config/routes.oas.json.

   Add a route entry for POST /connect/v1/graph with the full policy stack:
   api-key-inbound → rate-limit-inbound (100/min/user) → quota-inbound
   (10k/month/user) → inject-backend-auth → forward to KEYS_SITE_ORIGIN.

   Copy the route structure from POST /connect/v1/retrieve as the template.
   The operation description should be:
   "Higher-order graph retrieval via the RetrievalOrchestrator. Supports
   retrieve_context, expand_context, find_relevant_subgraph, find_paths, and
   summarise_subgraph operations. Preferred over /connect/v1/retrieve for all
   new integrations."

   Add a deprecation notice to the existing POST /connect/v1/retrieve entry:
   "Deprecated: use POST /connect/v1/graph for full orchestrator support and
   domain-pack-aware retrieval. This endpoint will be removed in v2."

2. FIX THE INGEST 501 STATUS IN ZUPLO OAS (C4)
   The Zuplo OAS documents POST /connect/v1/ingest/jobs, GET
   /connect/v1/ingest/jobs, and GET /connect/v1/ingest/jobs/{jobId} as
   returning 501. These endpoints are implemented and working. Remove the
   501 response from each. Add correct 201 (for POST) and 200 (for GETs)
   responses matching the actual ConnectIngestJob shape.

   Also update GET /connect/v1/ingest/jobs/{jobId} to document the
   quality_report field — even if it is currently null in the schema,
   documenting it as nullable prepares consumers for Phase 3 when it becomes
   populated.

3. FIX HEALTH ENDPOINT AUTH (I6)
   There is a contradiction: the Zuplo OAS marks the health endpoint as
   public, the canonical openapi.yaml marks it as auth-required, and the
   launch checklist expects a 401 on unauthenticated calls.

   The correct behaviour: the health endpoint is PUBLIC and returns 200
   with { status: "ok", version: string } for any caller. Authentication
   is not appropriate for health checks — load balancers and uptime monitors
   must reach it unauthenticated. Update Zuplo OAS to mark it public.
   Update the canonical openapi.yaml to match. Update the launch checklist
   to expect 200, not 401.

4. ENABLE CORS AT THE GATEWAY (I8)
   CORS is currently disabled (corsPolicy: none) in routes.oas.json.
   Enable CORS with these settings:
   - allowedOrigins: ["https://restormel.dev", "https://*.restormel.dev"]
     plus any configured ALLOWED_CORS_ORIGINS env var for developer portal
     and third-party clients
   - allowedMethods: ["GET", "POST", "DELETE", "OPTIONS"]
   - allowedHeaders: ["Authorization", "Content-Type", "X-Workspace-Id",
     "X-Request-Id"]
   - exposedHeaders: ["X-Request-Id", "X-RateLimit-Limit",
     "X-RateLimit-Remaining", "X-RateLimit-Reset"]
   - maxAge: 86400

5. PROVISION KEYS_SITE_ORIGIN IN SETUP SCRIPT (I7)
   The KEYS_SITE_ORIGIN environment variable is not provisioned by the
   default Zuplo setup script at docs/runbooks/zuplo-setup.md. Add it.
   KEYS_SITE_ORIGIN should be set to the dashboard origin URL
   (https://restormel.dev by default, or the value of DASHBOARD_ORIGIN).
   Update the runbook to include this step and explain what it is used for.

After making all changes: verify the Zuplo OAS is valid JSON and matches
the declared openapi version. Run any existing gateway tests. Report every
file changed.
```

---

## Phase 2 — Retrieval unification (Opus 4.8)

Addresses: C3, I2 (partial), I3, I12

Migrate the legacy retrieve path to the orchestrator. After this phase there
is one retrieval path, not two.

```
Using the API audit at docs/audit/api-audit.md, unify the retrieval layer so
that all retrieval calls — REST, MCP, and internal — use the RetrievalOrchestrator
via graph-orchestrator-service.ts. The legacy retrieve-service.ts must be
deprecated, not deleted (delete in a later cleanup pass).

Read these files before starting:
- apps/dashboard/src/lib/server/connect-v1/retrieve-service.ts (legacy)
- apps/dashboard/src/lib/server/connect-v1/graph-orchestrator-service.ts (orchestrator)
- apps/dashboard/src/routes/(marketing)/connect/v1/retrieve/+server.ts
- packages/mcp/src/connect-knowledge-tools.ts
- packages/contracts/src/connect.ts

1. WIRE /connect/v1/retrieve TO THE ORCHESTRATOR (I3)
   The POST /connect/v1/retrieve handler currently calls
   retrieveContext / retrieveContextFromSeed from the legacy service and
   passes domain_hint as a PhilosophicalDomain. It does not call
   resolveWorkspaceRetrievalConfig.

   Update retrieve-service.ts to delegate to graph-orchestrator-service.ts
   under the hood. Map the existing ConnectRetrieveRequest fields to the
   orchestrator's retrieve_context operation:
   - query → operation.query
   - depth → operation.maxDepth
   - domain_hint → pass to resolveWorkspaceRetrievalConfig as a hint
     (not as PhilosophicalDomain)
   - max_claims → operation.topK
   - seed_claim_id → operation.seedNodeIds (as single-element array)

   The response shape of /connect/v1/retrieve must not change — this is a
   public contract. Map the orchestrator result back to
   ConnectRetrieveResponse. The retrieval_degraded / retrieval_degraded_code
   fields should be derived from the orchestrator trace
   (trace.retrieval_degraded if present, or false if orchestrator succeeded).

2. REMOVE PHILOSOPHY FALLBACK (I12)
   In graph-orchestrator-service.ts, find the fallback that uses
   PhilosophicalDomain or philosophy-specific config when no domain pack
   is configured for the workspace. Replace it with a domain-neutral fallback:
   if resolveWorkspaceRetrievalConfig returns null, return HTTP 422 with
   { error: "domain_pack_required", message: "This workspace has no domain
   pack configured. Complete pipeline setup before querying the knowledge
   graph." }
   Do not silently degrade to philosophy domain for a workspace that has
   never configured one.

3. ADD DEPRECATION HEADER TO LEGACY RETRIEVE (C3)
   In the /connect/v1/retrieve route handler, add a response header:
   Deprecation: true
   Sunset: [date 6 months from today]
   Link: </connect/v1/graph>; rel="successor-version"
   This is a standard deprecation signalling pattern — API clients that
   check headers will see the migration path automatically.

4. WIRE MCP connect.ingest.* TOOLS TO REST (I2, partial)
   In packages/mcp/src/register-suite-tools.ts, the connect.ingest.start
   and connect.ingest.status tools currently validate input and return hint
   text only — they do not call the REST API.

   Wire them to call the actual REST endpoints:
   - connect.ingest.start → POST /connect/v1/ingest/jobs via the configured
     RESTORMEL_GATEWAY_KEY. Return the job ID and initial status.
   - connect.ingest.status → GET /connect/v1/ingest/jobs/{jobId}. Return
     the job status and quality_report if present.

   The tools must handle the case where RESTORMEL_GATEWAY_KEY is not
   configured and return a clear error: "Configure a Restormel gateway key
   in your MCP environment to use ingest tools."

   Update the tool descriptions to remove any "returns 501 upstream" or
   "validates only" language.

5. UPDATE MCP tool names to include connect.graph.* (I10)
   In packages/aaif/src/ find suite-tool-names and add the connect.graph.*
   tool names that exist in packages/mcp/src/connect-knowledge-tools.ts.
   This is a pure vocabulary sync — no logic changes.

Run pnpm check and pnpm test across packages/mcp and packages/aaif.
Report every file changed.
```

---

## Phase 3 — Complete the ingest public contract (Opus 4.8)

Addresses: C2, I1, I11

The ingest API needs to deliver what makes Restormel valuable: quality reports
and production workflow integration via webhooks.

```
Using the API audit at docs/audit/api-audit.md, complete the public ingest API
contract so developers building production workflows get the data and events
they need.

Read these files before starting:
- apps/dashboard/src/lib/server/connect-v1/ingest-handler.ts
- apps/dashboard/src/lib/server/run-quality-report.ts
- apps/dashboard/src/routes/(marketing)/connect/v1/ingest/jobs/+server.ts
- packages/contracts/src/connect.ts (ConnectIngestJobSchema)
- apps/dashboard/src/routes/(marketing)/connect/v1/ingest/jobs/[jobId]/+server.ts

1. ADD quality_report TO PUBLIC CONTRACT (C2)
   The ingest worker produces a quality report (trust score, supported count,
   weak count, unsupported count, remediation applied) and stores it in the
   DB. The ConnectIngestJobSchema.parse call in the API handler strips it.

   Update ConnectIngestJobSchema in packages/contracts/src/connect.ts to
   include quality_report as a nullable field:
   quality_report: z.object({
     trust_score: z.number().min(0).max(100),
     supported_count: z.number().int(),
     weak_count: z.number().int(),
     unsupported_count: z.number().int(),
     total_count: z.number().int(),
     remediation_applied: z.boolean(),
     assessed_at: z.string().datetime()
   }).nullable()

   Update the ingest handler to include quality_report in the response when
   present. Update the Zuplo OAS to document this field on the job object.
   Update the canonical openapi.yaml to match.

2. ADD LIVE LOG STREAMING TO PUBLIC API (I11)
   The dashboard BFF at GET /keys/dashboard/api/connect/ingest/jobs/{jobId}/
   status?since= supports incremental log streaming. This is absent from
   the public v1 API.

   Add a new public endpoint:
   GET /connect/v1/ingest/jobs/{jobId}/logs?since=&limit=
   - since: optional cursor (log line index or timestamp) — return lines
     after this point
   - limit: optional max lines to return (default 100, max 500)
   - Response: { job_id, log_lines: [{ index, timestamp, stage, level,
     message }], next_since, total }
   - Auth: same as other connect v1 endpoints
   - Add to Zuplo with full policy stack

   This enables developers to poll for live run progress from their own
   systems without a dashboard session.

3. IMPLEMENT WEBHOOKS FOR JOB COMPLETION (I1)
   Add a webhook registration and delivery system for ingest job events.
   This is the most important developer workflow feature — it enables
   "process new documents automatically, get notified when the graph updates."

   3a. Webhook registration endpoint:
   POST /connect/v1/webhooks
   Body: { workspace_id, url, events: Array<'job.completed'|'job.failed'|
   'job.quality_below_threshold'>, quality_threshold?: number, secret?: string }
   Response: { webhook_id, workspace_id, url, events, active: true,
   created_at, signing_secret }

   GET /connect/v1/webhooks?workspace_id=
   GET /connect/v1/webhooks/{webhookId}
   DELETE /connect/v1/webhooks/{webhookId}

   Store webhook registrations in Postgres (new table: connect_webhooks).

   3b. Webhook delivery:
   In the ingest worker (connect-ingest-worker.ts), after a job transitions
   to completed or failed, look up webhooks registered for that workspace
   and event. Fire a POST to each registered URL with:
   {
     webhook_id, event, timestamp,
     data: { job_id, workspace_id, status, quality_report }
   }
   Sign the payload with HMAC-SHA256 using the stored signing_secret.
   Include the signature as X-Restormel-Signature: sha256={hex_signature}.

   Delivery: attempt immediately, retry with exponential backoff (3 attempts:
   5s, 30s, 5m). Store delivery attempt records in Postgres.
   Do not block the worker thread waiting for webhook responses — fire and
   forget with async retry queue.

   3c. Dashboard registration UI (note only — do not implement in this phase):
   Add webhook registration to the Connect settings section of the dashboard.
   This is a UI task for a separate sprint.

   3d. Add all webhook endpoints to Zuplo with full policy stack.
   Add to Zuplo OAS and canonical openapi.yaml.

Run pnpm check and pnpm test. Report every file changed.
```

---

## Phase 4 — Auth and contract consistency (Sonnet 4.6)

Addresses: C1, I4, I5, I9, O1, O2

Make the API feel like a coherent product, not assembled parts.

```
Using the API audit at docs/audit/api-audit.md, fix the auth and contract
consistency issues. These are targeted, surgical changes — do not refactor
auth architecture, only fix the specific gaps listed.

1. PER-CONSUMER BACKEND IDENTITY (C1)
   Currently all Zuplo consumers share one KEYS_BACKEND_API_KEY, so the
   dashboard cannot identify which API consumer made a request.

   Implement per-consumer forwarding identity:
   In zuplo-consumer.ts, when a Zuplo consumer is provisioned for a user,
   generate a consumer-specific backend token and store it alongside the
   consumer record. When Zuplo's inject-backend-auth policy fires, it should
   forward this consumer-specific token rather than the global KEYS_BACKEND_API_KEY.

   In the Connect v1 auth handler, extract and validate the forwarded consumer
   token. This enables per-consumer audit logging, usage tracking, and eventual
   per-consumer rate limit customisation.

   If the Zuplo consumer provisioning flow does not support per-consumer header
   injection today, implement it as a request-id-style trace header
   (X-Consumer-Id: {consumer_id}) that the backend can read and log even if
   auth remains shared for now. Document which approach was taken and why.

2. AUTHENTICATE GRAPH LAYOUT ENDPOINT (I4)
   POST /connect/v1/graph/layout is currently unauthenticated on the site
   origin. Add Connect v1 auth (gateway key / management key / session) to
   this endpoint. Add it to the Zuplo gateway with the standard policy stack.
   This endpoint processes graph data that belongs to a workspace — it should
   not be callable without credentials.

3. MANAGEMENT KEY ISSUANCE (I5)
   Management keys can be verified but not issued via any documented API path.
   Add:
   POST /keys/v1/management-keys — issue a management key scoped to a project
   GET /keys/v1/management-keys — list management keys for the authenticated user
   DELETE /keys/v1/management-keys/{keyId} — revoke a management key

   These endpoints use session auth (dashboard user must be authenticated).
   Store management keys in the existing keys infrastructure.
   Add to Zuplo with api-key-inbound (consumer key required to call issuance —
   management keys are issued by users who already have a consumer key).
   Document the scoping model: management keys have project-level scope,
   consumer keys have user-level scope.

4. ALLOW GATEWAY KEYS ON INTEGRATIONS API (I9)
   The Integrations API currently rejects gateway keys — there is no machine
   access to connection configuration. A developer building an automated
   pipeline needs to be able to read which integrations are configured for
   their workspace.

   Add gateway key support to the read-only integrations endpoints:
   GET /keys/v1/connections and GET /keys/v1/connections/{connectionId}
   (read-only). Write operations (create, update, delete connections) remain
   session-only — OAuth flows cannot be initiated by machine tokens.

5. STANDARDISE contractVersion FIELD NAME (O1)
   Keys endpoints return contractVersion (camelCase).
   Connect endpoints return contract_version (snake_case).
   This split is confusing for developers building multi-surface integrations.

   Standardise to contract_version (snake_case) across all surfaces.
   Update ConnectIngestJobSchema, ConnectRetrieveResponse, ConnectGraphOpResponse,
   and any Keys response schemas.
   Add a migration note in the Zuplo OAS and openapi.yaml changelog section.

6. STANDARDISE ERROR ENVELOPES (O2)
   The current mix ({ error }, { error, message }, { ok: false, code, message })
   creates parsing burden for API consumers.

   Adopt a single error envelope across all Connect v1 and Keys v1 endpoints:
   {
     error: string,           // machine-readable code: "unauthorized",
                              // "not_found", "domain_pack_required", etc.
     message: string,         // human-readable explanation
     request_id?: string      // X-Request-Id echo, when available
   }

   Update every route handler that returns a non-standard error shape.
   Update Zuplo OAS to document this envelope on all error responses.

   For /connect/v1/retrieve: change HTTP 200 with retrieval_degraded: true
   to HTTP 206 (Partial Content) with the normal response body plus a
   degradation reason in the error field. This removes the HTTP 200 with
   implied failure anti-pattern. This is a breaking change — document it in
   the API changelog and add it to the Zuplo OAS deprecation notice on the
   retrieve endpoint.

Run pnpm check. Report every file changed.
```

---

## Phase 5 — Standard API behaviours (Sonnet 4.6)

Addresses: remaining Important and Cosmetic gaps, missing standard behaviours

```
Using the API audit at docs/audit/api-audit.md (Section 5: Missing standard
behaviours and Section 8 Cosmetic items), implement the standard API
behaviours that a developer expects from a production API.

1. PAGINATION ON JOB LIST (Important)
   GET /connect/v1/ingest/jobs currently returns the full workspace list.
   Add cursor-based pagination:
   - Query params: limit (default 20, max 100), cursor (opaque string)
   - Response: { jobs, next_cursor (null if no more), total_count }
   - Cursor encodes the last job's created_at + id for stable ordering
   This is a non-breaking addition — existing consumers get paginated results
   but the field structure is unchanged.

2. IDEMPOTENCY KEYS ON JOB CREATE (Important)
   Add Idempotency-Key header support to POST /connect/v1/ingest/jobs.
   If a request with the same Idempotency-Key arrives within 24 hours, return
   the original response (202 with the existing job) rather than creating a
   duplicate. Store idempotency keys in Postgres with a 24-hour TTL.
   Document in the Zuplo OAS that this header is supported.

3. UNIVERSAL X-Request-Id (Important)
   X-Request-Id is set on retrieve and graph responses but not universally.
   Add X-Request-Id to every response from every Connect v1 and Keys v1
   endpoint. Generate as crypto.randomUUID() if not already present.
   Echo the value in the error envelope response body (request_id field,
   from Phase 4 error standardisation).

4. DOCUMENT RATE LIMIT HEADERS (Cosmetic)
   Zuplo provides rate limit headers internally but they are not documented
   for clients. Add to the Zuplo OAS headers section for every rate-limited
   endpoint:
   X-RateLimit-Limit: 100
   X-RateLimit-Remaining: {remaining}
   X-RateLimit-Reset: {unix timestamp}
   These are already exposed by Zuplo — this is a documentation task only.

5. GRAPH SNAPSHOT 404 (Cosmetic)
   Graph snapshot endpoints always return 404 — this is a known stub that
   surprises integrators. Add a clear response body:
   { error: "not_implemented", message: "Graph snapshots are not yet
   available. Subscribe to the changelog at restormel.dev/changelog for
   availability updates." }
   and set HTTP 501 (Not Implemented) rather than 404. Update OAS to document
   501 for this endpoint explicitly.

6. UPDATE ZUPLO OAS VERSION (Cosmetic)
   The Zuplo OAS version is 1.0.0. The canonical openapi.yaml is 1.6.0.
   Update Zuplo OAS to 1.6.0. Add a changelog comment block at the top of
   routes.oas.json documenting the changes made in Phases 1-5.

Run pnpm check. Report every file changed.
```

---

## AAIF milestone (after Phase 3 completes)

Do not run this until Phases 1-3 are merged and the Connect v1 ingest
and retrieval contracts are stable.

```
Using the API audit Section 6 and Section 9 recommendation, complete the
AAIF contract hygiene work needed before the package can participate in the
API layer.

1. SINGLE-SOURCE RestormelSuiteToolName (I10)
   packages/aaif/src/suite-tool-names.ts contains tool name constants.
   packages/mcp/src/connect-knowledge-tools.ts defines connect.graph.* tools
   that are not in the AAIF source.
   Make packages/aaif the single source of truth: move all tool name constants
   to packages/aaif and have packages/mcp import from there.
   Run pnpm check across both packages to confirm no circular dependencies.

2. UPDATE INTEGRATION SPEC (O6)
   docs/integrations/INTEGRATIONS-FULL-SPEC.md Section 8 lags the current
   AAIF types. Update Section 8 to reflect the current package state.

3. ADD TESTS FOR isAAIFResponse (AAIF §6)
   packages/aaif has no tests for isAAIFResponse. Add unit tests covering:
   valid AAIF response envelopes, invalid envelopes, edge cases (null, empty
   object, wrong version). Run pnpm test for the package.

4. DECISION POINT — AAIF ENVELOPE PLACEMENT
   The audit notes an open question: do AAIF envelopes belong on
   /api/suite/invoke or a new route?
   Before implementing, produce a one-paragraph ADR (Architecture Decision
   Record) at docs/decisions/aaif-envelope-placement.md that states the
   decision and rationale. This is a product decision, not an implementation
   task — write it, then stop and seek review before proceeding.

Run pnpm check and pnpm test across affected packages.
```

---

## Model guide

| Phase | Model | Rationale |
|-------|-------|-----------|
| Phase 1 — Gateway | Opus 4.8 | Coordinated changes across Zuplo config, OAS files, and runbooks |
| Phase 2 — Retrieval unification | Opus 4.8 | Multi-file refactor touching MCP, contracts, and service layer |
| Phase 3 — Ingest contract | Opus 4.8 | New webhook system, schema changes, worker modification |
| Phase 4 — Auth and consistency | Sonnet 4.6 | Targeted surgical changes, mostly additive |
| Phase 5 — Standard behaviours | Sonnet 4.6 | Mostly additive, well-scoped |
| AAIF milestone | Sonnet 4.6 | Contract hygiene and documentation |

---

## Cross-cutting rules for every phase

- Do not change dashboard UI components or route handlers beyond what is
  explicitly listed in each phase
- Do not change the AAIF package until the AAIF milestone prompt
- Every schema change must update both the Zod schema in packages/contracts
  and the Zuplo OAS and canonical openapi.yaml — all three must stay in sync
- Every new endpoint must be added to Zuplo with the full policy stack
  unless explicitly noted otherwise
- Run pnpm check and pnpm test after every phase before committing
- One phase per PR
