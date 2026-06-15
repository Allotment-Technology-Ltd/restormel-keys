---
id: REC-PLAN-007
title: "Verifying Proxy (W2-0) — Phased Implementation Plan"
class: planning
owner: founder
status: draft
classification: internal
control-tier: 1
created: 2026-06-15
last-reviewed: 2026-06-15
review-interval: P6M
retention: review-only
related: [REC-ADR-005]
---

# Verifying Proxy (W2-0) — Phased Implementation Plan

**Status: draft for founder review.** Plan only — no implementation until sign-off
(`00-bootstrap-gate`). Decision record: **REC-ADR-005**
(`docs/decisions/verifying-proxy-over-user-mcp.md`). Grounded in the W2-0 gap analysis
(`restormel-ops`: `gtm/W2-0-gap-analysis.md`) and **revised after an Opus red-team** — note D-0
(faithfulness, not misattribution) and the SSRF/non-text scope below.

## Goal

Restormel becomes the **verifying proxy** between a user's own MCP server and their MCP client,
returning **grounding/faithfulness-verified envelopes** (span + hash + cross-model entailment +
abstention) over the upstream's responses — without hosting the graph. **It does not do
misattribution detection** (a multi-source ingestion property; see REC-ADR-005 D-0).

## Architecture (target)

```
MCP client (Claude)  ──►  Restormel proxy  ──►  user's own MCP server (their graph)
   (verified envelope) ◄──  [verify EBV]   ◄──   (answer + supporting sources)
```

The proxy is simultaneously an MCP **server** (to the client) and an MCP **client** (to the upstream).
**v1 verifies Mode-1 upstreams** — tools that return an answer/claims *with* their supporting sources
(REC-ADR-005 D-0). Raw passage/vector stores (Mode 0) get integrity-stamping only.

## Phases

### Phase A — Reference integration (local, single-tenant, no auth) · **needs neither D1 nor D2**

Prove **one real faithfulness-verification slice** end-to-end against one Mode-1 upstream, workspace
hardcoded (`RESTORMEL_WORKSPACE_ID`), no auth on ingress (local spike only). This is the W2-1
reference integration: **the first real verification slice + the latency/plumbing proof — not yet a
multi-tenant or secured product.**

Build (repo-grounded; net-new unless noted):
- **`verifyEnvelope()` façade** — reuse `connect-core/ingest/{evidence-binding,entailment}.ts`
  as-is; assemble bind→hash→entail over the upstream's returned (answer, sources). Reference loop:
  `scripts/reviews/verifier-efficacy.ts`.
- **Claim/source extraction from the upstream result** — parse the Mode-1 tool result into
  (claim/answer, supporting-source spans). *This is the real new verification work, not the façade.*
- **Validator-independence control** (REC-ADR-005 D-c) — validator is Restormel-selected, independent
  of the answer's author; fail closed to a Restormel-side validator. Tested.
- **MCP client + dispatch** — `Client` + `StreamableHTTPClientTransport`/`StdioClientTransport`
  (`@modelcontextprotocol/sdk@1.29.0`); connect to one upstream, `callTool`, capture `CallToolResult`.
- **Abstention/error semantics** — uncertainty, upstream timeout, quote-retrieval failure, or
  validator-unreachable all resolve to `unverified`/abstain (review), **never silent pass** (inherit
  EBV fail-safe, `entailment.ts`). Specify timeouts + a circuit-break on the egress leg.
- **Source provenance** per D-g (reference-by-hash for v1; embed-bytes deferred to R5).
- **Server shell** — reuse the stateless `StreamableHTTPServerTransport` (`apps/mcp-server/src/index.ts`)
  + `McpServer` pattern (note: unauthenticated — local only).

**Upstream pick — must be Mode 1.** Prefer an upstream MCP tool that returns an answer/claims with
citations (GraphRAG-style). Bare retrieval tools from Neo4j / Weaviate v1.37 / Pinecone are **Mode 0**
unless they return claim+source structure; if one is chosen, scope it to a tool that returns text +
provenance. Justify the pick (Mode-1 fit, public sample dataset, supported validator) in the Phase-A PR.

**Acceptance — a real verification test, not self-consistency:**
- A **grounded** claim (entailed by a returned source span) → `supported`, with the span + source hash
  + verdict shown.
- A planted **unsupported** claim (no entailing span) → `unverified`/abstain → review (not passed).
- Runs against the real upstream, reproducibly, via `git clone` → point at the upstream → envelopes.
- Latency (per leg) **and** Restormel-side per-verification cost captured (below).
- Text-returning tools only (see R-nontext).

### Phase B — Registration + read-only profile + proxy policy (local→staging) · no D1/D2

- **`upstream_mcp_targets`** table modelled on `knowledge_graph_targets` (per-workspace, encrypted
  secret via `credential-crypto.ts`) + `buildWorkspaceUpstreamMcp(workspaceId)` resolver + a
  **cross-row uniqueness guard on `(endpoint, namespace, database)`** (REC-ADR-005 D-d) + a
  connection-test (reach + list tools). Reuse the `knowledge_sources`/`ConnectSourceConnection`
  encryption pattern.
- **URL allow-list / egress restrictions** (REC-ADR-005 D-h, R8) on the registered upstream.
- **`connect-readonly` tool profile** — gate write/admin tools off the public connector.
- **Per-tenant proxy policy** — extend the `policies` `rule_definition` (reuse table + bindings +
  audit) to allowed upstreams / tools / abstention thresholds (threshold half exists in verification
  policy `minTrustScore`/`include`).

### Phase C — Remote, multi-tenant connect-to-Claude (Stage 3) · **HARD-gated on D1**

- OAuth 2.1/PKCE resource server + CIMD; per-request token validation.
- **token → `workspace_id` resolver** feeding the existing `authorizeKnowledgeWorkspaceRequest`
  chokepoint.
- **Request-scoped BYO-key validator** (REC-ADR-005 D-e) — net-new; only with D-c enforced.
- Multi-tenant proxy: two tenants provably isolated (tenant A's token can never resolve tenant B's
  upstream) — mirror the `workspace_scope_mismatch` 403 tests.

### Phase D — Gateway endgame (sovereignty) · influenced by D2

OSS-gateway routing per D2's ADR; keep Zuplo off the verification path. Not a blocker for A–C logic.

## Latency budget (and cost measurement)

- **Budget the added overhead as ABSOLUTE time, not a multiple of the upstream.** The verify path is
  **two LLM round-trips** — (1) quote/claim retrieval and (2) entailment — which dominate and are
  roughly upstream-independent, so a multiplicative target is misleading (a 5 ms vector lookup can
  never meet 1.5×). Propose a target like **added p50 ≤ ~1.5 s / p95 ≤ ~4 s** over a bare passthrough,
  to be **ratified against the first real measurement** (placeholder, not a claim).
- **Measure** four legs separately: (a) proxy→upstream `callTool`, (b) claim/quote retrieval [LLM],
  (c) `judgeEntailment` [LLM], (d) Layer-1 bind/hash (~free, pure string ops). Report p50/p95 on a
  fixed sample.
- **Cost: Restormel-side only in Phase A**, measured not optimised (NFD-1). Customer-key cost is not
  measurable until D-e/D1. Mitigations without rebuild: cache on `(claim, span, source_hash,
  validator)`; abstention thresholds; k-sample only for high-stakes.

## MCP spec baseline the build targets

- **Transport:** Streamable HTTP (ratified `2025-11-25`); design stateless. (Statelessness of the
  existing server transport ≠ client-leg conformance — the client leg is net-new and unproven.)
- **Auth (remote, Phase C):** OAuth 2.1 + PKCE (ratified, MUST); CIMD (ratified, SHOULD).
- **Do not depend on:** Server Cards `.well-known` (draft **SEP-2127**); the **`2026-07-28` RC** stateless
  core (target ship, **not ratified** — baseline `2025-11-25`). **Re-check all spec dates at build
  time** (several are future-dated relative to current tracking).
- **Multi-tenancy:** unspecified by MCP — the proxy owns it (Phase C).

## Risks + open questions

| # | Risk / question | Owner | Blocks |
|---|---|---|---|
| R1 | **Verification semantic (D-0):** v1 = faithfulness/grounding, not misattribution. Confirm this narrowing is acceptable to the founder + reflect in the moat copy. | Founder | Positioning |
| R2 | **Validator-independence collapse** if a BYO-key customer supplies one family. Enforce + test before BYO-key entailment. | Eng | BYO-key (D-e) |
| R3 | **Tenancy: no defence in depth** beyond the chokepoint + the `(endpoint,namespace,database)` collision guard. State the limit; security review before remote. | Eng + security | Phase C |
| R4 | **D1 (auth provider) undecided** — no token→tenant path until chosen; wrong mapping = expensive re-key. | Founder | Phase C |
| R5 | **Source-byte re-checkability** — reference-by-hash vs embed-bytes (new envelope field; PII/DPIA). Decide before the "re-checkable by anyone" claim. | Eng + founder | Honest claim |
| R6 | **D2 (Zuplo endgame) ADR** outstanding. | Founder | Phase D routing |
| R7 | **Latency** — two LLM calls on the hop may exceed budget on fast upstreams. | Eng | UX / go-no-go |
| R8 | **SSRF / egress** — user-supplied upstream URL dialled by the server. Allow-list + egress controls + the upstream-credential handling. | Eng + security | Any non-local upstream |
| R-nontext | **Non-text / structured upstream results** — EBV binding is string-based; Neo4j rows / Pinecone vectors / images have nothing to bind. Scope v1 to text-returning Mode-1 tools. | Eng | Phase A scope |
| R-prov | **Provider coverage** — request-scoped validator supports OpenAI-compatible + Anthropic + Google + Together today; beyond these is net-new. | Eng | BYO-key breadth |

## Out of scope for v1

- Misattribution detection (Door-1/multi-source property — D-0).
- Mode 2 (verifying the agent's *answer* against retrieved context — needs the answer leg).
- Mode 0 raw-store verification beyond Layer-1 integrity stamping.
- Non-textual / structured upstream results.
- Multi-tenant remote serving (Phase C) — until D1.
- Request-scoped customer-key entailment — until R2 (independence) is enforced.
- OSS-gateway migration (Phase D) — until D2.
- Door 3 (non-MCP AAIF envelope) — hedge, not v1.
- Hosting the user's graph, ingesting upstream content, or reusing `ingest-full-runner.ts`.
- Any public marketing before the reference integration is live (publish-when-live).

## Next step

Founder review — especially R1 (the D-0 narrowing). On sign-off, **Prompt 3** scopes the first build
slice (Phase A / W2-1) only, then stops for go-ahead before any code.
