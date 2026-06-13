# Restormel — Complete Build Sequence
# All remaining prompts, dependency-resolved and priority-ordered
# One document to run from, start to finish

---

## How to use this document

Work top to bottom. Each build depends on the ones before it — do not
skip ahead. Commit after every build before starting the next. The
sequence is grouped into five stages with a clear gate between each.

---

## STAGE 1 — Unblock the API (this week) ████████████████████████

These four run sequentially. Complete all four before moving to Stage 2.
Phases 1A and 1B run in parallel if you have capacity; both must be done
before Phase 1C.

---

### 1A — API Gateway (Opus 4.8)
**Dependency:** None. Run first.
**Value:** Unblocks every developer trying to use the API today.

```
Using the API audit at docs/reviews/api-audit.md and the source file index at
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
   Operation description: "Higher-order graph retrieval via the
   RetrievalOrchestrator. Supports retrieve_context, expand_context,
   find_relevant_subgraph, find_paths, and summarise_subgraph operations.
   Preferred over /connect/v1/retrieve for all new integrations."

   Add a deprecation notice to POST /connect/v1/retrieve:
   "Deprecated: use POST /connect/v1/graph for full orchestrator support
   and domain-pack-aware retrieval. This endpoint will be removed in v2."

2. FIX THE INGEST 501 STATUS IN ZUPLO OAS (C4)
   POST /connect/v1/ingest/jobs, GET /connect/v1/ingest/jobs, and GET
   /connect/v1/ingest/jobs/{jobId} are documented as returning 501.
   They are implemented and working. Remove the 501. Add correct 201
   (for POST) and 200 (for GETs) responses matching ConnectIngestJob shape.
   Document quality_report as nullable on the job object.

3. FIX HEALTH ENDPOINT AUTH (I6)
   Make the health endpoint PUBLIC. Returns 200 { status: "ok", version }
   for any caller. Update Zuplo OAS, canonical openapi.yaml, and the
   launch checklist to expect 200, not 401.

4. ENABLE CORS AT THE GATEWAY (I8)
   allowedOrigins: ["https://restormel.dev", "https://*.restormel.dev"]
   plus ALLOWED_CORS_ORIGINS env var.
   allowedMethods: ["GET", "POST", "DELETE", "OPTIONS"]
   allowedHeaders: ["Authorization", "Content-Type", "X-Workspace-Id",
   "X-Request-Id"]
   exposedHeaders: ["X-Request-Id", "X-RateLimit-Limit",
   "X-RateLimit-Remaining", "X-RateLimit-Reset"]
   maxAge: 86400

5. PROVISION KEYS_SITE_ORIGIN IN SETUP SCRIPT (I7)
   Add KEYS_SITE_ORIGIN to docs/runbooks/zuplo-setup.md.
   Set to the dashboard origin URL (https://restormel.dev by default).

Verify Zuplo OAS is valid JSON. Run gateway tests. Report every file changed.
```

---

### 1B — Zuplo portal design (Sonnet 4.6)
**Dependency:** None. Runs in parallel with 1A.
**Value:** Portal matches the product before any developer lands on it.

Full prompt in: cursor_zuplo_portal_design_prompt.md
(Steps 1–7 covering theme tokens, CSS injection, branding, landing page
content, navigation groups, and code sample language defaults.)

---

### 1C — Retrieval unification + GraphStoreAdapter foundation (Opus 4.8)
**Dependency:** 1A must be complete and merged.
**Value:** Eliminates dual retrieval paths; introduces the adapter interface
that all multi-DB work depends on.

```
Using the API audit at docs/reviews/api-audit.md, unify the retrieval layer
so all retrieval calls use the RetrievalOrchestrator. Also introduce the
GraphStoreAdapter interface as the foundation for multi-database support.

Read these files before starting:
- apps/dashboard/src/lib/server/connect-v1/retrieve-service.ts (legacy)
- apps/dashboard/src/lib/server/connect-v1/graph-orchestrator-service.ts
- apps/dashboard/src/routes/(marketing)/connect/v1/retrieve/+server.ts
- packages/mcp/src/connect-knowledge-tools.ts
- packages/contracts/src/connect.ts
- docs/architecture/graph-store-adapter-architecture.md

PART A — RETRIEVAL UNIFICATION

1. WIRE /connect/v1/retrieve TO THE ORCHESTRATOR (I3)
   Update retrieve-service.ts to delegate to graph-orchestrator-service.ts.
   Map existing ConnectRetrieveRequest fields:
   query → operation.query | depth → operation.maxDepth
   domain_hint → resolveWorkspaceRetrievalConfig hint (not PhilosophicalDomain)
   max_claims → operation.topK | seed_claim_id → operation.seedNodeIds
   Response shape must not change — map orchestrator result back to
   ConnectRetrieveResponse. retrieval_degraded derives from orchestrator trace.

2. REMOVE PHILOSOPHY FALLBACK (I12)
   In graph-orchestrator-service.ts, replace the PhilosophicalDomain fallback
   with: if resolveWorkspaceRetrievalConfig returns null, return HTTP 422
   { error: "domain_pack_required", message: "This workspace has no domain
   pack configured. Complete pipeline setup before querying the knowledge graph." }

3. ADD DEPRECATION HEADER TO LEGACY RETRIEVE (C3)
   On /connect/v1/retrieve responses add:
   Deprecation: true
   Sunset: [6 months from today]
   Link: </connect/v1/graph>; rel="successor-version"

4. WIRE MCP connect.ingest.* TOOLS TO REST (I2)
   In packages/mcp/src/register-suite-tools.ts:
   connect.ingest.start → POST /connect/v1/ingest/jobs via RESTORMEL_GATEWAY_KEY
   connect.ingest.status → GET /connect/v1/ingest/jobs/{jobId}
   Handle missing RESTORMEL_GATEWAY_KEY with actionable error message.

5. SYNC AAIF TOOL NAMES (I10)
   Add connect.graph.* tool names from packages/mcp/src/connect-knowledge-tools.ts
   into packages/aaif/src/suite-tool-names.ts. Vocabulary sync only, no logic.

PART B — GRAPHSTOREADAPTER FOUNDATION

6. INTRODUCE GraphStoreAdapter INTERFACE
   Create packages/graphrag-core/src/adapters/GraphStoreAdapter.ts
   with the full interface as specified in docs/architecture/
   graph-store-adapter-architecture.md (see Core abstraction section).
   Include: connect, disconnect, healthCheck, ensureSchema, discoverSchema,
   writeNodes, writeEdges, updateVerificationState, deleteNodes, deleteEdges,
   upsertNodes, searchByVector, searchByText, expandFromSeeds, traversePaths,
   getNodesByIds, getEdgesBetween, getNeighbours, getWorkspaceStats,
   getVerificationBreakdown.

7. WRAP EXISTING SURREAL CALLS IN SurrealDBAdapter
   Create packages/graphrag-core/src/adapters/surrealdb/SurrealDBAdapter.ts
   implementing GraphStoreAdapter. Extract all direct SurrealDB calls from
   graph-orchestrator-service.ts and connect-ingest-worker.ts into this class.
   This is a structural refactor only — no behaviour changes.
   SOPHIA must work identically after. Run its existing tests to verify.

8. CREATE AdapterFactory
   packages/graphrag-core/src/adapters/AdapterFactory.ts
   Resolves the correct adapter from workspace config, defaulting to
   SurrealDB if no config is present.

9. ADD graph_store_config TO WORKSPACE POSTGRES TABLE
   Add a nullable JSONB column graph_store_config to the workspace table.
   Migration only — no UI yet (that comes with multi-DB Sprint 1).

Run pnpm check and pnpm test. SOPHIA's existing tests must pass unchanged.
Report every file changed.
```

---

### 1D — Ingest contract completion (Opus 4.8)
**Dependency:** 1C must be complete and merged.
**Value:** Quality reports, webhooks, and live logs — the API delivers
the product's core promise to external consumers.

```
Using the API audit at docs/reviews/api-audit.md, complete the public ingest
API contract.

Read before starting:
- apps/dashboard/src/lib/server/connect-v1/ingest-handler.ts
- apps/dashboard/src/lib/server/run-quality-report.ts
- apps/dashboard/src/routes/(marketing)/connect/v1/ingest/jobs/+server.ts
- packages/contracts/src/connect.ts (ConnectIngestJobSchema)

1. ADD quality_report TO PUBLIC CONTRACT (C2)
   Update ConnectIngestJobSchema in packages/contracts/src/connect.ts:
   quality_report: z.object({
     trust_score: z.number().min(0).max(100),
     supported_count: z.number().int(),
     weak_count: z.number().int(),
     unsupported_count: z.number().int(),
     total_count: z.number().int(),
     remediation_applied: z.boolean(),
     assessed_at: z.string().datetime()
   }).nullable()
   Include in response when present. Update Zuplo OAS and openapi.yaml.

2. ADD LIVE LOG STREAMING (I11)
   New public endpoint: GET /connect/v1/ingest/jobs/{jobId}/logs?since=&limit=
   since: cursor (log line index) — return lines after this point
   limit: default 100, max 500
   Response: { job_id, log_lines: [{ index, timestamp, stage, level,
   message }], next_since, total }
   Add to Zuplo with full policy stack.

3. IMPLEMENT WEBHOOKS (I1)
   3a. Registration endpoints:
   POST /connect/v1/webhooks
   Body: { workspace_id, url, events: Array<'job.completed'|'job.failed'|
   'job.quality_below_threshold'>, quality_threshold?: number, secret?: string }
   Response: { webhook_id, workspace_id, url, events, active: true,
   created_at, signing_secret }
   GET /connect/v1/webhooks?workspace_id=
   GET /connect/v1/webhooks/{webhookId}
   DELETE /connect/v1/webhooks/{webhookId}
   Store in Postgres (new table: connect_webhooks).

   3b. Delivery in ingest worker:
   After job completes or fails, look up registered webhooks for that
   workspace and event. POST to each URL:
   { webhook_id, event, timestamp, data: { job_id, workspace_id, status,
   quality_report } }
   Sign with HMAC-SHA256. Header: X-Restormel-Signature: sha256={hex}.
   Retry: 3 attempts with exponential backoff (5s, 30s, 5m).
   Store delivery attempts in Postgres. Fire-and-forget — do not block worker.

   3c. Add all webhook endpoints to Zuplo. Update OAS and openapi.yaml.

Run pnpm check and pnpm test. Report every file changed.
```

---

## STAGE 2 — Multi-DB + API polish (days 3–5) ████████████████████

Stages 2A and 2B can run in parallel.

---

### 2A — Multi-DB Sprint 1: SurrealDB + Neo4j (Opus 4.8)
**Dependency:** 1C must be complete (GraphStoreAdapter interface exists).
**Value:** Enterprise teams with existing Neo4j graphs can connect Restormel.
Opens the enterprise conversation.

```
Using docs/architecture/graph-store-adapter-architecture.md and the
GraphStoreAdapter interface introduced in build 1C, complete the first
multi-database sprint.

The SurrealDBAdapter.ts was created in 1C as a structural refactor.
This sprint tests it thoroughly and builds Neo4jAdapter.ts.

Read before starting:
- packages/graphrag-core/src/adapters/GraphStoreAdapter.ts (from 1C)
- packages/graphrag-core/src/adapters/surrealdb/SurrealDBAdapter.ts (from 1C)
- packages/graphrag-core/src/adapters/AdapterFactory.ts (from 1C)
- docs/architecture/graph-store-adapter-architecture.md (full doc)

1. VERIFY SurrealDBAdapter PASSES ALL EXISTING TESTS
   Run the full test suite. If any test fails due to the 1C refactor, fix it
   before proceeding. The SurrealDB behaviour must be byte-for-byte identical
   to pre-1C. Do not proceed to step 2 until all tests pass.

2. BUILD Neo4jAdapter.ts
   Create packages/graphrag-core/src/adapters/neo4j/Neo4jAdapter.ts
   implementing the full GraphStoreAdapter interface using neo4j-driver.

   Capabilities declaration:
   nativeVectorSearch: true (Neo4j 5.x vector indexes)
   nativeGraphTraversal: true (Cypher MATCH path expressions)
   hybridSearch: false (separate queries, merge at application layer)
   transactionalWrites: true
   streamingResults: true
   maxTraversalDepth: null

   Key technical implementations:
   a. Schema creation (ensureSchema): Cypher DDL creating node labels,
      relationship types, and HNSW vector index matching the domain pack.
      CREATE VECTOR INDEX syntax for Neo4j 5.x.
   b. Vector search (searchByVector): Neo4j vector index KNN query.
   c. Text search (searchByText): separate fulltext index query — create
      fulltext index in ensureSchema if not present.
   d. Graph expansion (expandFromSeeds): Cypher MATCH with variable-length
      path patterns. Implement beam search at the application layer using
      multiple targeted Cypher queries per hop.
   e. Hybrid merge: run searchByVector and searchByText separately, merge
      and re-rank results using reciprocal rank fusion before returning.
   f. Verification filtering: WHERE n.verification_state IN $states AND
      n.trust_score >= $min in every read query.

3. WRITE Neo4j SCHEMA DDL
   Create packages/graphrag-core/src/adapters/neo4j/neo4j-schema.ts
   containing the Cypher DDL for Restormel's schema in Neo4j.

4. INTEGRATION TESTS
   Add tests at packages/graphrag-core/src/adapters/neo4j/Neo4jAdapter.test.ts
   covering all interface methods against a test Neo4j Aura instance.
   Use RESTORMEL_TEST_NEO4J_URL and RESTORMEL_TEST_NEO4J_CREDS env vars.
   Mock if live credentials not available in CI; document how to run live.

5. REGISTER NEO4J IN AdapterFactory
   Update AdapterFactory to handle type: 'neo4j'. Test that the factory
   resolves the correct adapter from workspace config.

6. DASHBOARD — DATABASE TYPE SELECTOR
   Update pipeline wizard Step 1 (Graph store) to show a database selector
   before the connection form:
   [ SurrealDB ] [ Neo4j ] (Weaviate and Neptune shown as coming soon)

   When Neo4j is selected, show:
   - Bolt/Neo4j URI field (bolt:// or neo4j+s://)
   - Username field
   - Password field
   - Database name field (default: neo4j)
   - Test connection button calling adapter.healthCheck()

   On successful test, save the config to workspace.graph_store_config
   (the column added in 1C). Persist type, connection details, credentials
   (encrypted at rest using existing credential encryption pattern).

Run pnpm check and pnpm test. Report every file changed.
```

---

### 2B — API auth and consistency (Sonnet 4.6)
**Dependency:** 1D must be complete and merged.
**Value:** Makes the API feel like a coherent product, not assembled parts.

```
Using the API audit at docs/reviews/api-audit.md, fix auth and contract
consistency. Targeted, surgical changes only.

1. PER-CONSUMER BACKEND IDENTITY (C1)
   Implement X-Consumer-Id: {consumer_id} forwarding header at the Zuplo
   layer. When a Zuplo consumer is provisioned, generate a consumer-specific
   ID and store alongside the consumer record. Inject as a forwarded header
   on every request so the backend can log and audit per-consumer.
   If the Zuplo consumer provisioning flow does not support this natively,
   document the approach taken and the limitation.

2. AUTHENTICATE GRAPH LAYOUT ENDPOINT (I4)
   POST /connect/v1/graph/layout is unauthenticated. Add Connect v1 auth
   (gateway key / management key / session). Add to Zuplo with standard
   policy stack.

3. MANAGEMENT KEY ISSUANCE (I5)
   POST /keys/v1/management-keys — issue a management key scoped to a project
   GET /keys/v1/management-keys — list management keys for the authenticated user
   DELETE /keys/v1/management-keys/{keyId} — revoke
   Session auth required. Add to Zuplo. Document scoping model:
   management keys have project-level scope, consumer keys have user-level scope.

4. GATEWAY KEYS ON INTEGRATIONS API (I9)
   Add gateway key support to read-only integrations endpoints:
   GET /keys/v1/connections and GET /keys/v1/connections/{connectionId}.
   Write operations remain session-only.

5. STANDARDISE contract_version FIELD NAME (O1)
   Standardise to contract_version (snake_case) across all surfaces.
   Update ConnectIngestJobSchema, ConnectRetrieveResponse,
   ConnectGraphOpResponse, and any Keys response schemas.
   Add migration note in Zuplo OAS and openapi.yaml changelog.

6. STANDARDISE ERROR ENVELOPES (O2)
   Single error envelope: { error: string, message: string, request_id?: string }
   Update every route handler that returns a non-standard shape.
   Change /connect/v1/retrieve HTTP 200 with retrieval_degraded to HTTP 206.
   Document as breaking change with Zuplo OAS deprecation notice.

Run pnpm check. Report every file changed.
```

---

### 2C — API standard behaviours (Sonnet 4.6)
**Dependency:** 2B must be complete and merged.
**Value:** Production polish. Makes the API feel trusted.

```
Using docs/reviews/api-audit.md (Section 5 and Section 8), implement
standard API behaviours.

1. PAGINATION ON JOB LIST
   GET /connect/v1/ingest/jobs: add cursor-based pagination.
   Query params: limit (default 20, max 100), cursor (opaque string).
   Response: { jobs, next_cursor (null if no more), total_count }
   Cursor encodes last job created_at + id for stable ordering.

2. IDEMPOTENCY KEYS ON JOB CREATE
   POST /connect/v1/ingest/jobs: support Idempotency-Key header.
   If same key arrives within 24 hours, return original response.
   Store in Postgres with 24-hour TTL. Document in Zuplo OAS.

3. UNIVERSAL X-Request-Id
   Add X-Request-Id to every response from every Connect v1 and Keys v1
   endpoint. Generate as crypto.randomUUID() if not already present.
   Echo in error envelope body (request_id field).

4. DOCUMENT RATE LIMIT HEADERS
   Add to Zuplo OAS headers section for every rate-limited endpoint:
   X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset.
   Documentation task only — Zuplo already exposes these.

5. GRAPH SNAPSHOT 501
   Graph snapshot endpoints return 404. Change to 501 with body:
   { error: "not_implemented", message: "Graph snapshots are not yet
   available. See restormel.dev/changelog for updates." }
   Update OAS to document 501 explicitly.

6. UPDATE ZUPLO OAS VERSION
   Update from 1.0.0 to 1.6.0. Add changelog comment block at top of
   routes.oas.json documenting all changes made in Phases 1A–2C.

Run pnpm check. Report every file changed.
```

---

## STAGE 3 — Core product surface ████████████████████████████████

The beachhead product. Must be complete before HN launch.
3A and 3C can run in parallel after 2A is merged.

---

### 3A — Production MCP Knowledge Server (Opus 4.8)
**Dependency:** 1C (orchestrator wired through adapter) + 2A (Neo4j adapter)
**Value:** The thing developers actually run. The beachhead product.

```
Read packages/mcp/src/connect-knowledge-tools.ts and any existing
knowledgeMcp.ts in src/lib/server/mcp/ to understand the current state.
The retrieval orchestrator is complete in @restormel/graphrag-core.
The GraphStoreAdapter pattern is established from builds 1C and 2A.
Make the MCP knowledge server production-grade and standalone-deployable.

1. PRODUCTION MCP SERVER — apps/mcp-server/
   If not already standalone, create apps/mcp-server/.
   If it exists, audit and bring to spec.

   Tools exposed, each returning context with provenance:

   retrieve_context({ query, maxDepth?, verificationPolicy?, maxTokens? })
   Returns: { context_block, claims: ClaimWithProvenance[], trace_summary }

   expand_context({ seedNodeIds, depth?, edgeTypes? })
   Returns: { context_block, claims: ClaimWithProvenance[], trace_summary }

   find_relevant_subgraph({ topic, reasoningMode? })
   Returns: { context_block, claims: ClaimWithProvenance[], trace_summary }

   find_paths({ sourceNodeId, targetNodeId, maxHops? })
   Returns: { paths: GraphPath[], trace_summary }

   inspect_query({ query, verificationPolicy? })
   Returns: { would_retrieve: ClaimWithProvenance[], filtered_out:
   ClaimWithProvenance[], reason_filtered: string[], trace: AuditTrace }
   This is the transparency tool — foundation for the inspect CLI.

   ClaimWithProvenance: { claimId, claimText, sourceRef,
   verificationState, confidenceScore, trustScore, retrievedAt,
   hopDepth, policyApplied, auditTrace: AuditHop[] }

2. CONFIGURATION — env vars only, no code changes between environments:
   RESTORMEL_GRAPH_STORE_TYPE      surrealdb | neo4j | weaviate
   RESTORMEL_GRAPH_STORE_URL       connection string or endpoint
   RESTORMEL_GRAPH_STORE_CREDS     JSON string of credentials
   RESTORMEL_WORKSPACE_ID          which workspace to serve
   RESTORMEL_DEFAULT_VERIFICATION  supported | supported,weak
   RESTORMEL_MAX_TOKENS            default token budget (default 2000)
   RESTORMEL_LOG_LEVEL             debug | info | warn | error
   RESTORMEL_TRANSPORT             stdio | http (default: stdio)
   RESTORMEL_PORT                  port for http transport (default 3000)
   Add .env.example with explanation of every variable.

3. ERROR HANDLING
   Every tool returns structured error, never throws:
   { error: string, code: string, recoverable: boolean, suggestion: string }
   suggestion must be actionable ("Complete pipeline setup at
   restormel.dev/dashboard" not a generic string).

4. STARTUP VALIDATION
   Health check sequence on startup: graph store connection, domain pack
   configured, retrieval orchestrator resolves. If any fails: log
   human-readable explanation and exit non-zero. No silent degraded starts.

5. README — apps/mcp-server/README.md:
   What it does (one paragraph, engineer-facing)
   Prerequisites + quick start (five commands)
   All environment variables
   Five tools with example inputs/outputs
   Verification filtering explanation
   Three most common failure modes and fixes

Run pnpm check and pnpm test. Report every file created or changed.
```

---

### 3B — Aesthetic deepening (Sonnet 4.6 + Opus 4.8 for typography)
**Dependency:** None. Independent. Must be done before HN launch.
**Value:** The product must look as good as it works before new people see it.

Full prompts in: restormel_aesthetic_deepening.md
Run in this sequence:
1. Prompt 1 — Audit (Sonnet 4.6) → review output before proceeding
2. Prompt 2 — Typography system (Opus 4.8)
3. Prompt 3 — Yellow discipline (Sonnet 4.6)
4. Prompt 4 — Space and compression (Sonnet 4.6)
5. Prompt 5 — Physical interactions (Sonnet 4.6)
6. Prompt 6 — Coherence review (Sonnet 4.6)

---

### 3C — `restormel inspect` CLI (Opus 4.8)
**Dependency:** 3A must be complete (inspect_query tool exists on MCP server).
**Value:** The demo tool. How developers understand the product in five minutes.

Full prompt in: development_roadmap_and_prompts.md — Build 2 section.
(Covers: CLI entry point, inspect command, pretty/json/markdown output,
watch mode, auth config, failure modes, README.)

---

## STAGE 4 — Post-launch depth ██████████████████████████████████

Ship HN launch after Stage 3 is complete. Then continue with Stage 4.

---

### 4A — Graph comparison panel (Opus 4.8)
**Dependency:** 3A must be complete.
**Value:** Makes the retrieval value immediately visible inside the dashboard.

Full prompt in: cursor_graph_comparison_prompt.md
(Covers: question suggestion algorithm, parallel request orchestration,
quality delta analysis, all Svelte components, neo-brutalist design tokens,
acceptance criteria.)

---

### 4B — Provenance audit trace export (Sonnet 4.6)
**Dependency:** 1D must be complete (ingest contract with quality_report).
**Value:** Foundation for replay CLI and future verification certificates.

```
The retrieval orchestrator produces a full audit trace on every query
(RetrievalResult.trace). Expose it as a structured, versioned JSON export.

Read packages/graphrag-core/src/orchestrator/ and RetrievalResult type first.

1. TRACE EXPORT SCHEMA — packages/contracts/src/provenance-trace.ts:
   interface ProvenanceTrace {
     schema_version: '1.0'
     trace_id: string
     query: string
     workspace_id: string
     domain_pack: string
     graph_store_type: string
     queried_at: string           // ISO 8601
     verification_policy: {
       included_states: string[]
       min_trust_score: number
       excluded_flagged: boolean
     }
     seeds: SeedRecord[]
     expansion: ExpansionHop[]
     result: {
       claims_retrieved: number
       claims_filtered: number
       tokens_used: number
       token_budget: number
       truncated: boolean
     }
     claims: ClaimTrace[]
     timing: { seed_ms, expansion_ms, ranking_ms, total_ms }
   }
   interface ClaimTrace {
     claim_id, claim_text (truncated 200 chars), source_ref,
     verification_state, trust_score, confidence_score,
     included: boolean, exclusion_reason?: string,
     hop_depth, edge_path: string[]
   }

2. STORE TRACES AND RETURN trace_id
   POST /connect/v1/retrieve and POST /connect/v1/graph must store a
   trace record and return trace_id in the response.
   Store in Postgres, 90-day retention window.
   Add Postgres migration for the traces table.

3. API ENDPOINTS
   GET /connect/v1/traces/{traceId} → ProvenanceTrace
   GET /connect/v1/traces/{traceId}/export?format=json → downloadable JSON
   Add to Zuplo with full policy stack.

4. DASHBOARD INTEGRATION
   On Runs screen: add "Export trace" link next to most recent query result.
   One Svelte link component, no UI refactor.

5. DOCUMENTATION
   Add "Provenance traces" section to API reference: what they contain,
   retention period, debugging use cases.

Run pnpm check. Report every file changed.
```

---

### 4C — Verification rule set v1 (Sonnet 4.6)
**Dependency:** 1C must be complete (orchestrator wired through adapter).
**Value:** Makes verification inspectable and overridable; foundation for
the community rule set registry.

Full prompt in: development_roadmap_and_prompts.md — Build 8 section.
(Covers: VerificationRuleSet schema, built-in core rules, domain pack
override, API endpoints, CLI commands, documentation.)

---

### 4D — `restormel replay` CLI (Sonnet 4.6)
**Dependency:** 4B must be complete (provenance trace export exists).
**Value:** Deterministic reproduction of agent failures.

Full prompt in: development_roadmap_and_prompts.md — Build 6 section.
(Covers: replay command, diff mode, stable/changed/new output format,
drift warning, failure modes.)

---

## STAGE 5 — Platform expansion ███████████████████████████████████

Run after Stage 4 is stable and HN has launched.

---

### 5A — Weaviate adapter / Multi-DB Sprint 2 (Opus 4.8)
**Dependency:** 2A (Neo4j adapter, proving the pattern works).
**Value:** RAG developer community adoption; teams already using Weaviate
can add Restormel's verification layer without switching databases.

```
Using docs/architecture/graph-store-adapter-architecture.md Sprint 2
section, and with the GraphStoreAdapter pattern proven by Neo4jAdapter,
build WeaviateAdapter.ts and the schema mapping UI.

1. BUILD WeaviateAdapter.ts
   Create packages/graphrag-core/src/adapters/weaviate/WeaviateAdapter.ts.

   Capabilities:
   nativeVectorSearch: true      (best-in-class)
   nativeGraphTraversal: false   (application-layer only)
   hybridSearch: true            (native BM25 + vector)
   transactionalWrites: false    (eventual consistency — batch with retry)
   streamingResults: true
   maxTraversalDepth: 2          (enforce hard limit — document clearly)

   Key challenge: expandFromSeeds with nativeGraphTraversal: false.
   Implement application-layer expansion: call getNeighbours() iteratively
   per hop. Enforce maxTraversalDepth: 2 and return a clear warning in the
   trace summary if the user requests deeper traversal:
   "Weaviate adapter limits traversal to depth 2. Use SurrealDB or Neo4j
   for deeper graph reasoning."

2. SCHEMA DISCOVERY — discoverSchema() for all three adapters
   Implement discoverSchema() on SurrealDBAdapter, Neo4jAdapter, and
   WeaviateAdapter. Returns DiscoveredSchema with:
   nodeTypes: [{ nativeLabel, propertyKeys, estimatedCount, hasEmbeddings,
   embeddingProperty? }]
   edgeTypes: [{ nativeLabel, propertyKeys, estimatedCount }]
   sampleData: GraphSubgraph (small sample)
   estimatedNodeCount, estimatedEdgeCount

3. SCHEMA MAPPING UI
   When a user connects an existing database (schemaMode: 'existing'),
   show the discovered schema in a mapping table:

   Your database          →  Restormel domain pack
   :Article (12k nodes)  →  [ Claim type ▼ ]
   :Person (4k nodes)    →  [ Entity type ▼ ]
   :CITES (89k edges)    →  [ Relation type ▼ ]
   embedding_vector      →  [ Use as embeddings ✓ ]
   trust_score           →  [ Map to trust score ✓ ]

   Domain pack dropdowns populated from existing workspace packs.
   Option to generate a new pack from discovered schema using Design with AI.

4. REGISTER WEAVIATE IN AdapterFactory
   Update AdapterFactory to handle type: 'weaviate'.

5. DASHBOARD — ADD WEAVIATE TO SELECTOR
   Update pipeline wizard Step 1 to show Weaviate as a full option
   (currently shown as "coming soon"). Show Weaviate connection form:
   REST endpoint, API key, collection prefix.

6. INTEGRATION TESTS
   Tests against a test Weaviate instance for all interface methods.

Run pnpm check and pnpm test. Report every file changed.
```

---

### 5B — AAIF hygiene milestone (Sonnet 4.6)
**Dependency:** 1D must be complete (API contracts stable).
**Value:** Prepares AAIF for Phase 3 A2A work without building A2A yet.

```
Using the AAIF section of the API audit and the milestone spec, complete
AAIF contract hygiene. No new A2A functionality.

1. SINGLE-SOURCE RestormelSuiteToolName (I10)
   packages/aaif/src/suite-tool-names.ts contains tool name constants.
   packages/mcp/src/connect-knowledge-tools.ts defines connect.graph.*
   tools not yet in the AAIF source.
   Make packages/aaif the single source of truth: move all tool name
   constants there, have packages/mcp import from there.
   Run pnpm check across both packages — no circular dependencies.

2. UPDATE INTEGRATION SPEC (O6)
   docs/integrations/INTEGRATIONS-FULL-SPEC.md Section 8 lags current
   AAIF types. Update Section 8 to reflect current package state.

3. ADD TESTS FOR isAAIFResponse
   Add unit tests covering: valid AAIF response envelopes, invalid
   envelopes, edge cases (null, empty object, wrong version).
   Run pnpm test for the package.

4. AAIF ENVELOPE PLACEMENT ADR
   Produce one-paragraph ADR at docs/decisions/aaif-envelope-placement.md
   stating whether AAIF envelopes belong on /api/suite/invoke or a new
   route, with rationale. This is a decision document — write it, then
   STOP and seek review before implementing anything.

Run pnpm check and pnpm test.
```

---

## Complete sequence at a glance

| # | Build | Model | Depends on | HN gate |
|---|-------|-------|-----------|---------|
| 1A | API Gateway | Opus 4.8 | — | — |
| 1B | Zuplo portal design | Sonnet 4.6 | — (parallel) | — |
| 1C | Retrieval unification + adapter foundation | Opus 4.8 | 1A | — |
| 1D | Ingest contract (quality_report + webhooks) | Opus 4.8 | 1C | — |
| 2A | Multi-DB Sprint 1: SurrealDB + Neo4j | Opus 4.8 | 1C | — |
| 2B | API auth and consistency | Sonnet 4.6 | 1D | — |
| 2C | API standard behaviours | Sonnet 4.6 | 2B | — |
| 3A | MCP Knowledge Server | Opus 4.8 | 1C + 2A | ✓ required |
| 3B | Aesthetic deepening | Sonnet/Opus | — (independent) | ✓ required |
| 3C | restormel inspect CLI | Opus 4.8 | 3A | ✓ required |
| 4A | Graph comparison panel | Opus 4.8 | 3A | — |
| 4B | Provenance audit trace export | Sonnet 4.6 | 1D | — |
| 4C | Verification rule set v1 | Sonnet 4.6 | 1C | — |
| 4D | restormel replay CLI | Sonnet 4.6 | 4B | — |
| 5A | Weaviate adapter + schema mapping | Opus 4.8 | 2A | — |
| 5B | AAIF hygiene milestone | Sonnet 4.6 | 1D | — |

---

## Cross-cutting rules for every build

- One build per PR. Commit after each before starting the next.
- Run pnpm check and pnpm test at the end of every build.
- Every schema change must update the Zod schema in packages/contracts,
  the Zuplo OAS, and canonical openapi.yaml — all three must stay in sync.
- Every new endpoint goes on Zuplo with full policy stack unless explicitly
  stated otherwise.
- The SurrealDB adapter must behave identically to pre-1C at every stage.
  Run SOPHIA's existing tests as the verification gate.
- Do not touch the AAIF package until 5B.

---

## HN launch gate

Do not post Show HN until:
- ✓ 3A (MCP Knowledge Server) — runnable by a developer who clones the repo
- ✓ 3B (Aesthetic deepening) — all six prompts complete
- ✓ 3C (restormel inspect CLI) — the demo tool works end-to-end
- ✓ Five developer conversations completed (engineers hitting MCP agent
  failures, at least two in financial services)
