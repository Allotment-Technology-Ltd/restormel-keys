# Restormel Connect — product brief (Phase 0)

**Status:** Canonical product definition (draft)  
**Owner:** Allotment Technology Ltd  
**Programme:** [SUITE-ARCHITECTURE-MIGRATION.md](./SUITE-ARCHITECTURE-MIGRATION.md)  
**Last reviewed:** 2026-06-01  

Restormel Connect is the **fourth suite product**: connect structured corpora via **Ingest**, **Retrieve**, and **Verify**, with **BYOK** on every LLM stage through Restormel Keys.

---

## Sub-products

| Sub-product | Consumer | Hot path | Primary interface (target) |
| --- | --- | --- | --- |
| **Connect Ingest** | Pipelines, operators | Async jobs | `POST /connect/v1/ingest/jobs` |
| **Connect Retrieve** | RAG, agents, apps | Sync | `POST /connect/v1/retrieve` (structured `graph` + `context_pack`), MCP `connect.search`, `connect.get_context_for` (BYO Surreal) |
| **Connect Graph orchestrator** | Agents, copilots | Sync | `POST /connect/v1/graph` (retrieve / expand / subgraph / paths / summarise), MCP `connect.graph.*` — curated, ranked, token-budgeted context with per-query verification policy |
| **Connect Verify** | QA, governance, agents | Sync | `POST /connect/v1/verify`, MCP `connect.verify` |

### Graph orchestrator (higher-order retrieval)

`POST /connect/v1/graph` / MCP `connect.graph.*` wrap `@restormel/graphrag-core`'s `RetrievalOrchestrator`:

- **retrieve_context** — vector-seeded, graph-expanded context (primary entry point).
- **expand_context** — graph expansion from explicit seed node ids.
- **find_relevant_subgraph** — `semantic` | `causal` | `temporal` reasoning modes (re-weight edge priors).
- **find_paths** — ranked reasoning paths between two nodes.
- **summarise_subgraph** — condense a subgraph under a token budget (seeds preserved).

**Trust promise:** all operations default to **supported-only** retrieval (flagged excluded); callers opt into weak/unsupported via `verification_policy`. Every response carries an audit `trace` (seed count, hops, `tokens_used`, `nodes_dropped`, verification counts). The active `RetrievalConfig` (domain pack) is resolved per workspace, so one surface serves any domain.

---

## BYOK and routing

- Every LLM ingest stage resolves independently via Keys (`workload: ingestion`, stage keys such as `ingestion_extraction`).
- Embeddings may use dedicated provider env (Voyage/Vertex) — documented in operator runbooks; not proxied as LLM chat.
- Workspace isolation: all graph data scoped by Keys **`workspace_id`**.

---

## Improvement telemetry (hosted dashboard)

Graph review actions emit **redacted** signals to improve default ingest prompts for all tenants:

- **Why flagged** — AI `validation_status` and validator note (before human triage)
- **What the operator did** — human verdict and optional note (max 500 chars, redacted)
- **Never stored** — unit bodies, source URLs, or raw API keys

Signals land in Postgres (`knowledge_review_signals`) and PostHog (`connect_review_completed`). Aggregates drive archetype prompt template bumps gated by golden eval. See [CONNECT-INGEST-QUALITY-BAR.md](./CONNECT-INGEST-QUALITY-BAR.md).

Workspaces may disable this via `settings.ingest_quality_telemetry: false` (default on).

---

## Operator experience

Configured in **Restormel Dashboard** (not a separate app):

| Surface | Path |
| --- | --- |
| **Get started** — guided, stateful setup journey (progress, next-step CTA, graph stats, latest-run monitor) | `/keys/dashboard/connect` |
| Models & keys — provider keys + **Keys visual routes per ingestion stage** | `/keys/dashboard/connect/models` |
| Graph explorer — groups, ideas, validation | `/keys/dashboard/connect/graph` |
| Runs (ingest jobs: list / create / preview / monitor) | `/keys/dashboard/connect/ingest` |
| Pipeline & graph store (graph store, AI keys, domain packs + Graph Designer, profiles, connectors, routing) | `/keys/dashboard/connect/pipeline` |
| Keys route bindings for ingest stages | Connections + Routes (`workload: ingestion`) |

The hub is designed for a complete novice: the **Get started** page computes which steps are done (graph store, AI keys, domain pack, documents, run, monitor) from live state and always points to the next action; each step deep-links to the relevant surface.

**Domain-agnostic ingestion:** the pipeline is generalised from SOPHIA's philosophy-only build via **domain packs** (ontology + prompts + graph schema) and a **Bring-Your-Own graph store**. See [CONNECT-DOMAIN-PACKS.md](./CONNECT-DOMAIN-PACKS.md).

---

## Implementation source

Reference implementation extracted from [SOPHIA](https://github.com/Allotment-Technology-Ltd/sophia). Extraction map: [CONNECT-EXTRACTION-MAP.md](./CONNECT-EXTRACTION-MAP.md).

**Contracts:** `@restormel/contracts/connect` (`CONNECT_API_CONTRACT_VERSION`).

**OpenAPI (planned):** [openapi-suite-v1-draft.yaml](../api/openapi-suite-v1-draft.yaml).

---

## Out of scope (Knowledge product)

- Philosophy showcase UX (Stoa, Learn) — stays in SOPHIA
- Restormel Testing delivery-model changes — post-MVP programme
- Self-hosted enterprise packaging — Year 1

---

## Related

- [connect-byo-graph-agent.md](../guides/connect-byo-graph-agent.md) — BYO Surreal + MCP agent wiring (MVP)
- [CONNECT-DOMAIN-PACKS.md](./CONNECT-DOMAIN-PACKS.md) — domain-agnostic ingestion config (packs, BYO store, profiles)
- [keys-routing-contract.md](../keys-routing-contract.md) — ingestion workload stages
- [database-neon-for-self-hosters.md](../guides/database-neon-for-self-hosters.md) — Neon + graph store pattern
- [THEME-L-IA-MATRIX.md](./THEME-L-IA-MATRIX.md) — marketing + dashboard IA
