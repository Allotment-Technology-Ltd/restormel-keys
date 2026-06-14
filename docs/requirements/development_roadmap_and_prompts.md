---
title: Restormel — Development Roadmap & Cursor Prompts
class: technical
owner: founder
status: approved
classification: internal
control-tier: 1
created: 2026-06-07
last-reviewed: 2026-06-07
review-interval: P12M
---

# Restormel — Development Roadmap & Cursor Prompts

---

## This week (in progress)

**API functionality** — run api_implementation_plan.md Phases 1–5 + Zuplo
portal design prompt in sequence. Opus 4.8 for Phases 1–3, Sonnet 4.6
for Phases 4–5 and portal design.

**Multi-DB Sprint 1** — SurrealDB adapter extraction + Neo4j adapter.
Run from graph_store_adapter_architecture.md Sprint 1 sequence. Opus 4.8.

---

## Build 1 — Production MCP Knowledge Server

**What:** A production-grade, standalone MCP server that wraps a Restormel
knowledge graph and returns verified context to any MCP-compatible agent.
The retrieval orchestrator exists and knowledgeMcp.ts may exist from Phase 5
of the retrieval work. This build makes it deployable, configurable, and
developer-ready. This is the beachhead product.

**Why now:** Phase 1 of the roadmap. Everything else is infrastructure.
This is the thing developers actually run.

**Model:** Opus 4.8

---

### Prompt — Production MCP Knowledge Server

```
Read packages/mcp/src/connect-knowledge-tools.ts and any existing
knowledgeMcp.ts in src/lib/server/mcp/ to understand the current state
of the Restormel MCP server. The retrieval orchestrator is complete and
lives in @restormel/graphrag-core. The goal of this build is to make
the MCP knowledge server production-grade, standalone-deployable, and
developer-ready.

The server must do exactly one thing excellently: given a query from an
MCP-compatible agent, return verified context from the connected knowledge
graph with a provenance record attached to every retrieved claim.

1. PRODUCTION MCP SERVER — apps/mcp-server/

   If a standalone MCP server application does not already exist, create one
   at apps/mcp-server/. If it does exist, audit it against these requirements
   and bring it up to spec.

   The server exposes these tools, each returning context with provenance:

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
   This is the transparency tool — shows exactly what the agent would get
   and what was excluded, without actually injecting context. This is the
   foundation for the restormel inspect CLI.

   ClaimWithProvenance must carry:
   {
     claimId: string
     claimText: string
     sourceRef: string           // document URI or source identifier
     verificationState: 'supported' | 'weak' | 'unsupported' | 'unverified'
     confidenceScore: number     // 0–1
     trustScore: number          // 0–100
     retrievedAt: string         // ISO 8601
     hopDepth: number            // traversal depth from seed
     policyApplied: string       // which verification policy filtered/included
     auditTrace: AuditHop[]      // full hop-by-hop traversal record
   }

2. CONFIGURATION

   The server must be configurable via environment variables with no code
   changes required between environments:

   RESTORMEL_GRAPH_STORE_TYPE      surrealdb | neo4j | weaviate
   RESTORMEL_GRAPH_STORE_URL       connection string or endpoint
   RESTORMEL_GRAPH_STORE_CREDS     JSON string of credentials
   RESTORMEL_WORKSPACE_ID          which workspace to serve
   RESTORMEL_DEFAULT_VERIFICATION  supported | supported,weak (comma-separated)
   RESTORMEL_MAX_TOKENS            default token budget for context (default 2000)
   RESTORMEL_LOG_LEVEL             debug | info | warn | error

   Add a .env.example file documenting every variable with an explanation
   of what it does.

3. TRANSPORT

   Support both stdio (for local agent use) and HTTP/SSE (for remote
   deployment). The transport is determined by the RESTORMEL_TRANSPORT
   environment variable: stdio | http (default: stdio).

   For HTTP transport, listen on RESTORMEL_PORT (default 3000).

4. ERROR HANDLING

   Every tool call must return a structured error rather than throwing:
   { error: string, code: string, recoverable: boolean, suggestion: string }

   The suggestion field is important — if the error is "no domain pack
   configured", the suggestion should be "Complete pipeline setup at
   restormel.dev/dashboard" not a generic error string.

5. STARTUP VALIDATION

   On startup, run a health check sequence:
   - Verify graph store connection
   - Verify at least one domain pack is configured for the workspace
   - Verify the retrieval orchestrator can resolve config for this workspace
   - Log the result of each check clearly
   If any check fails, log a human-readable explanation and exit with a
   non-zero code. Do not silently start in a degraded state.

6. README

   Write apps/mcp-server/README.md covering:
   - What this server does (one paragraph, engineer-facing)
   - Prerequisites (Restormel account, API key, graph with at least one
     completed ingest run)
   - Quick start (five commands from clone to running server)
   - All environment variables
   - The five tools with example inputs and outputs
   - What verification filtering means and how to configure it
   - Troubleshooting: the three most common failure modes and how to fix them

Run pnpm check and pnpm test. Report every file created or changed.
```

---

## Build 2 — `restormel inspect` CLI

**What:** A CLI tool that shows exactly what an MCP-connected agent would
receive from a Restormel knowledge graph for a given query. Which claims,
what verification state, what was filtered out and why. The demo tool.
The debuggability surface. `curl -v` for agent context.

**Why now:** Phase 1 of the roadmap. This is how developers understand
the product in the first five minutes. It should exist before the HN launch.

**Model:** Opus 4.8

---

### Prompt — `restormel inspect` CLI

```
Build the restormel CLI with an inspect command. The CLI is the primary
developer surface for interacting with a Restormel knowledge graph outside
the dashboard. Start with inspect — other commands (replay, trace) follow
in later builds.

Create apps/cli/ (or packages/cli/ if the monorepo conventions prefer it).
Use a lightweight CLI framework appropriate for the TypeScript stack
(commander or similar — check what is already in package.json before
choosing).

1. CLI ENTRY POINT

   Package name: restormel (or @restormel/cli)
   Binary: restormel
   Install: npx restormel or global npm install -g restormel

   Global options:
   --workspace <id>    Restormel workspace ID
   --api-key <key>     Restormel API key (or RESTORMEL_API_KEY env var)
   --graph-store <url> Direct graph store URL (bypasses API, for local use)
   --output <format>   json | pretty (default: pretty)
   --quiet             Suppress explanatory text, output data only

   Config file: ~/.restormel/config.json storing workspace and key so
   the user does not need to pass flags every time. Commands:
   restormel auth login  — interactive prompt to set workspace + API key
   restormel auth status — show current auth config

2. `restormel inspect` COMMAND

   Usage: restormel inspect [query] [options]

   Options:
   --include-weak       Include weak claims (default: supported only)
   --include-unsupported Include unsupported claims
   --depth <n>          Traversal depth (default: 3)
   --max-tokens <n>     Token budget for context (default: 2000)
   --show-filtered      Show what was filtered out and why (default: true)
   --seed <nodeId>      Start traversal from a specific node
   --format <fmt>       pretty | json | markdown (default: pretty)

   Behaviour: calls the MCP server's inspect_query tool (or the API
   /inspect endpoint if running against the API rather than a local server)
   and renders the result.

   PRETTY OUTPUT FORMAT:

   Render to the terminal in this structure. Use chalk or equivalent for
   colour — the output should be legible on a dark terminal:

   ────────────────────────────────────────────────────────
   RESTORMEL INSPECT
   Query: "what are the main arguments for utilitarianism?"
   Workspace: my-workspace · Domain: ethics
   ────────────────────────────────────────────────────────

   WOULD RETRIEVE (12 claims · 2,847 tokens)

   ✓ SUPPORTED [0.91]  Utilitarianism holds that the right action is the
                        one that maximises overall happiness.
                        Source: stanford-plato/utilitarianism
                        Depth: 1 · Hops: seed

   ✓ SUPPORTED [0.84]  Mill distinguished between higher and lower
                        pleasures, arguing quality matters as much as
                        quantity.
                        Source: mill-utilitarianism-ch2
                        Depth: 2 · Via: [supports] from claim 1

   ~ WEAK      [0.61]  Bentham's felicific calculus can measure the
                        intensity and duration of pleasure objectively.
                        Source: bentham-introduction-ch4
                        Note: included because --include-weak is set

   [... remaining claims ...]

   FILTERED OUT (8 claims)

   ✗ UNSUPPORTED       Utilitarianism was invented by Plato.
                        Reason: verification_state = unsupported
                        Source: unknown-blog-post

   ✗ BELOW THRESHOLD   [0.54] Utility can be calculated precisely for
                        any action.
                        Reason: trust_score below workspace minimum (60)

   ────────────────────────────────────────────────────────
   TRAVERSAL SUMMARY
   Seeds: 3 · Hops: 3 · Candidates evaluated: 47
   Retrieved: 12 · Filtered: 8 · Tokens: 2,847 / 2,000 budget
   Note: result truncated to token budget. Use --max-tokens to adjust.
   ────────────────────────────────────────────────────────

   JSON OUTPUT FORMAT (--output json):
   Emit the raw ClaimWithProvenance[] array plus a trace_summary object.
   Structured, machine-readable, pipe-friendly. No colour codes.

   MARKDOWN FORMAT (--output markdown):
   Emit a markdown document suitable for pasting into a README or issue.
   Claim list as a table. Filtered claims in a collapsed details block.

3. FAILURE MODES

   These are the most common failures — handle each with a specific,
   actionable message:

   No claims retrieved:
   "No supported claims matched your query. Your graph may not contain
   relevant content, or the trust score threshold may be too high.
   Try: restormel inspect --include-weak to see weak claims.
   Try: restormel inspect --depth 5 to traverse deeper."

   Graph store unreachable:
   "Cannot reach graph store at [url]. Check your connection and the
   RESTORMEL_GRAPH_STORE_URL configuration."

   No domain pack configured:
   "This workspace has no domain pack configured. Complete pipeline
   setup at restormel.dev/dashboard before inspecting."

   Token budget exceeded before all claims returned:
   "Result truncated: [N] additional claims available beyond the token
   budget. Use --max-tokens [larger value] to retrieve more."

4. `restormel inspect --watch` MODE

   An optional continuous mode: after showing the initial result, watch
   for changes to the graph (new ingest runs completing) and re-run the
   inspect automatically. Output a diff of what changed: new claims added,
   claims that changed verification state, claims removed.

   Use polling with a configurable interval (--watch-interval, default 60s).
   This makes the tool useful during active ingestion sessions.

5. DOCUMENTATION

   Write apps/cli/README.md covering:
   - Install and auth setup (five commands)
   - inspect command with all options
   - The three output formats with examples
   - Common failure modes and how to fix them

Run pnpm check and pnpm test. Report every file created or changed.
```

---

## Build 3 — Graph comparison panel

**What:** The side-by-side dashboard comparison showing a query answered
with and without the knowledge graph. Already fully specified.

**Why now:** Phase 1/2 bridge. The in-dashboard version of inspect.
Makes the product's value immediately visible to new users.

**Model:** Opus 4.8

**Prompt:** Use cursor_graph_comparison_prompt.md (already created).

---

## Build 4 — Aesthetic deepening

**What:** Complete the neo-brutalist design implementation across the
full product. Already fully specified.

**Why now:** Before the HN launch. The product must feel as good as
it works.

**Model:** Sonnet 4.6 for audit and most phases, Opus 4.8 for typography.

**Prompts:** Use restormel_aesthetic_deepening.md (already created).
Run in sequence: audit → typography → yellow discipline → space →
interactions → coherence review.

---

## Build 5 — Provenance audit trace export

**What:** A structured, versioned JSON export of a full query audit
trace. The retrieval orchestrator already produces trace data. This
build exposes it as a clean, developer-readable format with a stable
schema. The foundation for `restormel replay` and eventually for
verification certificates.

**Why now:** Phase 2 of the roadmap. The data exists — exposing it
cleanly is the work.

**Model:** Sonnet 4.6

---

### Prompt — Provenance audit trace export

```
The retrieval orchestrator produces a full audit trace on every query
(RetrievalResult.trace). This build exposes that trace as a structured,
versioned JSON export format and adds an API endpoint to retrieve it.

Read packages/graphrag-core/src/orchestrator/ and the RetrievalResult
type to understand the current trace structure before implementing.

1. TRACE EXPORT FORMAT

   Define a versioned schema at packages/contracts/src/provenance-trace.ts:

   interface ProvenanceTrace {
     schema_version: '1.0'
     trace_id: string           // unique ID, stored with the query record
     query: string              // the original query text
     workspace_id: string
     domain_pack: string        // which domain pack was active
     graph_store_type: string   // surrealdb | neo4j | weaviate
     queried_at: string         // ISO 8601
     verification_policy: {
       included_states: string[]
       min_trust_score: number
       excluded_flagged: boolean
     }
     seeds: SeedRecord[]        // initial vector/text search results
     expansion: ExpansionHop[]  // each traversal hop with scoring
     result: {
       claims_retrieved: number
       claims_filtered: number
       tokens_used: number
       token_budget: number
       truncated: boolean
     }
     claims: ClaimTrace[]       // per-claim record
     timing: {
       seed_ms: number
       expansion_ms: number
       ranking_ms: number
       total_ms: number
     }
   }

   interface ClaimTrace {
     claim_id: string
     claim_text: string         // truncated to 200 chars
     source_ref: string
     verification_state: string
     trust_score: number
     confidence_score: number
     included: boolean          // was it in the final result?
     exclusion_reason?: string  // if not included, why
     hop_depth: number
     edge_path: string[]        // relation types traversed to reach this claim
   }

   Map the existing RetrievalResult.trace fields to this schema.
   Fields in the existing trace that do not have a clean mapping:
   document them in a comment rather than dropping them.

2. API ENDPOINT

   Add to the Connect v1 API:
   GET /connect/v1/traces/{traceId}
   Returns: ProvenanceTrace
   Auth: standard Connect v1 gateway key

   POST /connect/v1/retrieve and POST /connect/v1/graph must store a
   trace record and return its trace_id in the response:
   { ...existing response, trace_id: string }

   Store trace records in Postgres with a 90-day retention window.
   Add Postgres migration for the traces table.
   Add the endpoint to Zuplo with full policy stack.

3. EXPORT ENDPOINT

   GET /connect/v1/traces/{traceId}/export?format=json
   Returns: ProvenanceTrace as a downloadable JSON file
   Content-Disposition: attachment; filename="trace-{traceId}.json"

   The format parameter is a hook for future formats (csv, json-ld).
   For now, json is the only supported value.

4. DASHBOARD INTEGRATION

   On the Runs screen, after a run completes, add a small "Export trace"
   link next to the most recent query result (if the user has run a query
   via the comparison panel or inspect tool). Clicking downloads the trace
   JSON. This is a link, not a button — one line of code in the Svelte
   component.

5. DOCUMENTATION

   Add a section to the API reference (in the Zuplo OAS and README):
   "Provenance traces" — what they contain, how long they are retained,
   how to use them for debugging agent failures.

Run pnpm check. Report every file changed.
```

---

## Build 6 — `restormel replay` CLI

**What:** Given a trace ID or a saved trace file, replay a past query
exactly as it ran — same graph state, same verification policy, same
traversal. Reproduces agent failures deterministically.

**Why now:** Phase 2 of the roadmap. Depends on Build 5 (trace export).
Do not build until Build 5 is merged.

**Model:** Sonnet 4.6

---

### Prompt — `restormel replay` CLI

```
Add the replay command to the restormel CLI (built in Build 2).

Usage: restormel replay [traceId | traceFile] [options]

Where traceId is a UUID retrieved from the API, or traceFile is a path
to a locally saved ProvenanceTrace JSON file.

Options:
--diff        Show what has changed since the trace was recorded
              (new claims, changed verification states, removed claims)
--output      json | pretty | markdown (default: pretty)
--compare     Run both the original trace and a fresh query side by side

REPLAY BEHAVIOUR:

Given a trace ID, fetch the ProvenanceTrace from the API. Then re-run
the same query against the current graph with the same parameters
(same verification policy, same depth, same token budget) and compare:

1. Claims that were in the original trace and are still there: ✓ STABLE
2. Claims that were in the original trace but are now filtered/missing:
   ~ CHANGED (show new verification state if changed, or REMOVED if gone)
3. Claims that are new in the current result: + NEW

Output for --diff mode:

─────────────────────────────────────────────────
RESTORMEL REPLAY
Original query: "what are the arguments for utilitarianism?"
Traced: 2026-06-01T14:23:11Z · 12 claims
Replayed: 2026-06-06T09:11:42Z · 11 claims
─────────────────────────────────────────────────

STABLE (9 claims — unchanged since trace)
✓ [0.91] Utilitarianism holds that the right action...

CHANGED (2 claims)
~ [was SUPPORTED 0.84] Mill distinguished between higher and lower...
  Now: WEAK [0.61] — verification re-run after new document added

~ [was SUPPORTED 0.79] Bentham's hedonic calculus...
  Now: REMOVED — source document was removed from the graph

NEW (1 claim)
+ [SUPPORTED 0.88] Preference utilitarianism extends the classical...
  Added: after ingest run on 2026-06-03

─────────────────────────────────────────────────
SUMMARY: 9 stable · 2 changed · 1 new
If this replay differs from expected: check recent ingest runs and
graph changes with: restormel inspect --watch
─────────────────────────────────────────────────

FAILURE MODE — trace not found:
"Trace [id] not found. Traces are retained for 90 days. If this trace
is older, use a locally saved trace file: restormel replay ./trace.json"

FAILURE MODE — graph state has changed significantly (>50% claims changed):
Emit a warning: "Significant drift detected: [N]% of original claims
changed since this trace was recorded. The graph may have been re-ingested
or substantially modified."

Run pnpm check and pnpm test. Report every file changed.
```

---

## Build 7 — Weaviate adapter (multi-DB Sprint 2)

**What:** Second storage backend alongside SurrealDB and Neo4j.
Already architected in graph_store_adapter_architecture.md.

**Why now:** Phase 2 of the roadmap. Do not build until Neo4j adapter
(Sprint 1, this week) is merged and tested.

**Model:** Opus 4.8

**Prompt:** Use Sprint 2 section of graph_store_adapter_architecture.md.
The key constraint: `nativeGraphTraversal: false` for Weaviate means
application-layer expansion. Enforce `maxTraversalDepth: 2` and document
it clearly in the adapter and the Connect dashboard selector.

---

## Build 8 — Verification rule set v1

**What:** The verification rules (6-dimension scoring logic) documented,
published as explicit config, and made inspectable and overridable.
The beginning of the community logic layer.

**Why now:** Phase 2 of the roadmap. Required before the verification
rule set registry (Phase 4).

**Model:** Sonnet 4.6

---

### Prompt — Verification rule set v1

```
The verification pipeline scores every extracted claim across six
dimensions: logical structure, evidence grounding, counterargument
coverage, scope calibration, assumption transparency, internal
consistency. These rules are currently implicit in the pipeline code.

This build makes them explicit, documented, inspectable, and overridable.

Read the verification-related code in the ingestion pipeline and the
retrieval orchestrator's verification policy handling to understand the
current implementation before writing anything.

1. RULE SET SCHEMA

   Define at packages/contracts/src/verification-rules.ts:

   interface VerificationRuleSet {
     id: string
     name: string
     version: string            // semver
     description: string
     dimensions: VerificationDimension[]
     policies: VerificationPolicy[]
     domain_hints?: string[]    // which domains this rule set is designed for
   }

   interface VerificationDimension {
     id: string                 // 'logical_structure' | 'evidence_grounding' | etc.
     name: string
     description: string        // plain English explanation of what this checks
     weight: number             // 0–1, must sum to 1.0 across all dimensions
     prompt_template: string    // the LLM prompt fragment used for this dimension
     passing_threshold: number  // score above which this dimension passes
   }

   interface VerificationPolicy {
     id: string
     name: string               // 'strict' | 'balanced' | 'lenient'
     min_overall_score: number  // 0–100 for a claim to be 'supported'
     weak_threshold: number     // below this = unsupported
     dimension_overrides?: Partial<Record<string, number>>  // weight overrides
   }

2. BUILT-IN RULE SET

   Encode the current verification logic as a built-in rule set at
   packages/graphrag-core/src/verification/rules/core.ts.
   Name: "Restormel Core v1"
   Version: "1.0.0"

   Document each dimension's weight and passing threshold with a comment
   explaining why that weight was chosen. These comments are the beginning
   of the public documentation.

   Include three built-in policies: strict (higher thresholds, better for
   regulated use cases), balanced (current default), lenient (for exploratory
   ingestion of lower-quality sources).

3. DOMAIN PACK OVERRIDE

   Domain packs can include a verification_rules field referencing a rule
   set ID or providing inline dimension weight overrides. Add this field
   to the DomainPackSchema in packages/contracts/src/domain-pack.ts.

   The verification pipeline must resolve rule sets in this order:
   1. Inline overrides in the domain pack
   2. A referenced rule set ID
   3. The built-in core rule set (default)

4. API ENDPOINT

   GET /connect/v1/verification-rules
   Returns: the active rule set for the workspace
   GET /connect/v1/verification-rules/built-in
   Returns: the built-in core rule set definition

5. CLI COMMAND

   Add to the restormel CLI:
   restormel rules show — display the active rule set for the workspace
   restormel rules list — list all available rule sets

6. DOCUMENTATION

   Write packages/graphrag-core/src/verification/rules/README.md:
   - What each of the six dimensions checks and why
   - How weights affect the overall score
   - When to use strict vs balanced vs lenient policy
   - How to override dimensions in a domain pack
   - The scoring formula (overall score = weighted sum of dimension scores)

   This document should be written for a developer who has not used
   Restormel before. It becomes a public reference.

Run pnpm check and pnpm test. Report every file changed.
```

---

## Build 9 — AAIF hygiene milestone

**What:** Prepare the AAIF package for Phase 3 (A2A Trust Adapter).
Contract hygiene only — no new A2A functionality yet.

**Why now:** After Build 7. Do this before the A2A work starts so the
foundation is clean.

**Model:** Sonnet 4.6

**Prompt:** Use the AAIF milestone section of api_implementation_plan.md.

---

## Roadmap summary

| Build | What | When | Model |
|-------|------|------|-------|
| This week | API Phases 1–5 + multi-DB Sprint 1 | Now | Opus/Sonnet |
| 1 | MCP Knowledge Server | Next | Opus 4.8 |
| 2 | restormel inspect CLI | Next | Opus 4.8 |
| 3 | Graph comparison panel | After 1+2 | Opus 4.8 |
| 4 | Aesthetic deepening | Before launch | Sonnet 4.6 |
| 5 | Provenance trace export | Month 2 | Sonnet 4.6 |
| 6 | restormel replay CLI | After 5 | Sonnet 4.6 |
| 7 | Weaviate adapter | Month 2 | Opus 4.8 |
| 8 | Verification rule set v1 | Month 2 | Sonnet 4.6 |
| 9 | AAIF hygiene | Month 3 | Sonnet 4.6 |

**Phase 3 (months 7–9) prerequisite check:**
Before starting the A2A Trust Adapter work, confirm that A2A adoption
is visibly growing in the communities you are in. If not, extend MCP
depth instead. The AAIF hygiene work (Build 9) prepares the foundation
regardless of which direction Phase 3 takes.

---

## Hard stops before the HN launch

These must be complete before posting Show HN:

- Build 1 (MCP Knowledge Server) — runnable by a developer who clones the repo
- Build 2 (restormel inspect CLI) — the demo tool
- Build 4 (aesthetic deepening) — the product must look as good as it works
- The five developer conversations the roadmap recommends — talk to engineers
  hitting MCP agent failures before the post goes up
