---
title: Knowledge domain packs — domain-agnostic ingestion
class: technical
owner: founder
status: approved
classification: internal
control-tier: 1
created: 2026-06-13
last-reviewed: 2026-06-13
review-interval: P12M
---

# Knowledge domain packs — domain-agnostic ingestion

**Status:** Canonical (Knowledge ingestion configuration)
**Related:** [CONNECT-PRODUCT.md](./CONNECT-PRODUCT.md), [CONNECT-EXTRACTION-MAP.md](./CONNECT-EXTRACTION-MAP.md), [SUITE-ARCHITECTURE-MIGRATION.md](../architecture/SUITE-ARCHITECTURE-MIGRATION.md), [Connect first graph onboarding](../guides/connect-first-graph-onboarding.md)
**Contracts:** `@restormel/contracts/connect` (`KnowledgeDomainPackSchema`, `KnowledgeGraphTargetSchema`, `KnowledgePipelineProfileSchema`)

---

## Why this exists

SOPHIA's ingestion pipeline is excellent but hardwired to the **philosophy** domain: the extraction prompt mines *philosophical claims*, the taxonomy is 21 philosophy domains, relations are argument-discourse edges (`supports`, `contradicts`, `responds_to`, …), groups are *arguments*, and the graph schema names tables `claim` / `argument` / `thinker` (with Wikidata linking).

Restormel Connect generalises this so **any** corpus can be ingested, provided the operator supplies the relevant configuration. The customisable layer is the **Domain Pack**. The pipeline mechanics (job/run orchestration, stage machine, checkpoints, BYOK routing, store writes) stay generic and consume a pack as data.

## The three configuration objects

| Object | Contract | What it customises | Dashboard surface |
|--------|----------|--------------------|-------------------|
| **Domain pack** | `KnowledgeDomainPackSchema` | Ontology (unit/group nouns, taxonomy, unit/relation/role types), per-stage prompt overrides, graph schema (table/edge names), passage segmentation, optional entity linking, embedding contract | `/keys/dashboard/connect/pipeline` → Domain packs |
| **Graph target** | `KnowledgeGraphTargetSchema` | Bring-Your-Own graph store: SurrealDB endpoint, namespace, database, credentials (encrypted) | `/keys/dashboard/connect/pipeline` → Graph store |
| **Pipeline profile** | `KnowledgePipelineProfileSchema` | Saved (domain pack + graph target + default stop stage) so operators "configure once, run many times" | `/keys/dashboard/connect/pipeline` → Profiles; selectable on new job |

Built-in packs seeded per workspace on first use: **`generic`** (domain-neutral) and **`philosophy`** (SOPHIA parity, as an example of a fully-specified domain).

## What was hardcoded → what is now configurable

Mapped from the SOPHIA inventory ([CONNECT-EXTRACTION-MAP.md](./CONNECT-EXTRACTION-MAP.md)):

| SOPHIA (philosophy-specific) | Domain pack field |
|------------------------------|-------------------|
| Extraction prompt "philosophical text analyst", claim_type enum | `prompts.extraction` (override) + `ontology.unit_types` |
| `DOMAIN_VALUES` (21 philosophy domains) | `ontology.domains` |
| Relation prompt + `supports/contradicts/depends_on/responds_to/defines/qualifies` | `prompts.relations` + `ontology.relation_types` |
| Grouping into named *arguments*; roles `conclusion/key_premise/objection` | `ontology.group_noun`, `ontology.group_roles`, `prompts.grouping` |
| Validation "fact-checker specialising in philosophy" | `prompts.validation` |
| Remediation "philosophical claim" repair | `prompts.remediation` |
| Surreal tables `claim` / `argument` / edges | `graph_schema.unit_table` / `group_table` / `relation_edges` / `part_of_edge` |
| Argumentative passage lexicon | `passage_profile.marker_lexicon` |
| Voyage 1024-dim embeddings | `embedding.model` / `embedding.dimensions` |
| `runThinkerIdentityLinking` (Wikidata) | `entity_linking` (optional: `entity_table`, `source_edge`, `external_id_provider`) |
| SEP / Gutenberg source catalogs | Out of pack — optional source-discovery plugins (not implemented; operators paste URLs/text) |
| Constitution rules | Out of scope — reasoning product, not ingest |

When `prompts.*` are omitted, the pipeline composes a generic prompt from the ontology nouns and vocabulary (placeholders: `{unit_noun}`, `{group_noun}`, `{domains}`, `{unit_types}`, `{relation_types}`, `{group_roles}`).

## Reusable vs domain-specific (extraction boundary)

**Domain-agnostic core (generic, reused as-is):** job/run orchestration, stage ordering + checkpoints, BYOK per-stage routing, Neon staging, embedding stage (provider/dim from pack), validation/remediation control flow, store write mechanics, admin monitoring/triage patterns.

**Per-pack (data, not code):** ontology, prompts, graph schema names, passage profile, entity linking, embedding contract.

## Connecting a graph store (fewest clicks)

SurrealDB has **no public third-party OAuth flow** for a SaaS to enumerate a user's cloud instances, and MCP servers (e.g. SurrealMCP) are **agent/IDE-side** tools — neither can power an end-user "connect" button inside the deployed dashboard. The dashboard offers:

- **Bring-your-own SurrealDB (MVP default):** paste a connection string (e.g. `wss://user:pass@host/namespace/database`) → `POST …/graph-target/connect` parses it, saves the encrypted target, and tests connectivity in one call. Surreal Cloud strings without ns/db prompt for just those two values. A four-field manual form remains behind "Enter fields manually".
- **Host Neon one-click (flag-gated, default off):** when `restormel-module-connect-neon-graph-store` is enabled, **Use Neon** → `POST /keys/dashboard/api/connect/pipeline/graph-target/neon` creates a `postgres` target with `use_dashboard_database = true`, reusing the dashboard's existing `DATABASE_URL`. Graph spine rows live in workspace-scoped Postgres tables (migration 038). **Not recommended for multi-tenant SaaS** — customer graph data should not live in the operator's Neon without explicit consent; a future one-click path should OAuth/link the **customer's own Neon account**, not reuse host `DATABASE_URL`.

| Provider | Connect effort | Retrieve (graphrag-core) | Ingest source write |
|----------|----------------|--------------------------|---------------------|
| **Postgres / Neon** (`use_dashboard_database`, flag on) | One click | Follow-on (graphrag-core speaks SurrealQL) | Yes — Postgres spine tables |
| **SurrealDB** (BYO) | One paste | Yes (degraded until indexed) | Yes — HTTP `/sql` |

Future one-click options (not yet built): Neon OAuth to the **operator's** Neon org/project, JWT trust via Surreal `DEFINE ACCESS ... TYPE JWT` (no stored password, but requires the operator to run one setup statement first), and a dedicated external Postgres connection string.

## Sources, parsing, and chunking (any-document ingestion)

Ingestion is layered so any source/format works and complete units are preserved:

- **Source connectors** (`SourceConnector` port in `@restormel/connect-core`):
  - **Upload** and **URL** — on the New job page.
  - **S3 (+ S3-compatible: Cloudflare R2, MinIO, Backblaze)** — credential-based (`@aws-sdk/client-s3`); add a bucket on the Pipeline → Sources card, browse objects, and import. Secret access key encrypted at rest.
  - **Google Drive** and **SharePoint/OneDrive** — OAuth2 (`/api/connect/sources/connectors/{google,microsoft}/authorize` → callback stores an encrypted refresh token). **Env-gated**: set `GOOGLE_OAUTH_CLIENT_ID/SECRET` or `MS_OAUTH_CLIENT_ID/SECRET` (+ optional `MS_OAUTH_TENANT`) and register the dashboard callback URL with the OAuth app. Until configured, the UI shows "not configured".
  - **Website/sitemap crawl** — discover pages from `sitemap.xml` or in-page links (bounded by `max_pages`), fetch + parse each. Pure link discovery lives in `@restormel/connect-core` (`extractLinks`, `parseSitemapUrls`).
  - Connections persist (encrypted) in `knowledge_sources`; imported documents land in `knowledge_source_documents` and are selectable when creating a job.
- **Document parsing** (`DocumentParser` port): pluggable. The built-in OSS parser handles text/markdown/HTML/JSON/CSV with no dependency; binary formats (PDF, DOCX) return a clear "configure a managed parser" message. Managed providers (LlamaParse, Unstructured) are env-gated opt-ins (`LLAMAPARSE_API_KEY` / `UNSTRUCTURED_API_KEY`) selectable via the pack's `parser` profile.
- **Structure-aware chunking** (`chunkDocument`): packs structural blocks (headings/paragraphs) up to a size bound instead of naive fixed-size slicing, which fragments coherent content. Configurable per pack via `chunking` (`strategy: structure_aware | recursive | semantic | fixed`). This is the cross-domain version of the philosophy lesson: keep whole ideas/arguments together.

## Per-stage model fallback chains

Operators configure ingestion LLM routing on **Models & keys** (`/keys/dashboard/connect/models`), stored per workspace (`knowledge_stage_models` JSON: `project_id`, optional `environment_id`, optional per-stage route id overrides). Each stage (`extraction`, `grouping`, `validation`, `remediation`, `embedding`) maps to a Keys route with `workload=ingestion` and stage `ingestion_<stage>` (e.g. `ingestion_extraction`). The page links to the **visual route builder** (`?flow=visual`) for each stage — same UI as `/keys/dashboard/projects/{id}/routes/{routeId}?flow=visual`. The worker resolves routes via `resolveRouteForExecution`, walks the step chain on failure, and uses BYOK keys from Connections. Preview uses the extraction route so it matches a full run. Legacy comma-separated model-id chains in the same table are still supported when no project routing is saved; otherwise `OPENAI_API_KEY` on the server is the dev fallback.

## Steering the LLM (ontology + patterns + schema mode)

Two additions make the LLM build a *graph* (relationships), not just chunk text:

- **`relationship_patterns`** on the ontology — allowed triplets `(from_unit_type, relation, to_unit_type)` that ground extraction (Neo4j-style). Captures how units connect.
- **`schema_mode`** — `strict` (only declared types), `guided` (prefer declared, allow justified additions), or `open` (discover types from the corpus, GraphRAG-style).

The **Graph Designer** (`POST /keys/dashboard/api/connect/domain-packs/design`) auto-drafts these from the operator's intent + a sample of their own added documents (GraphRAG-style). It returns a draft Domain Pack — unit/group nouns, taxonomy, unit/relation/role types, **relationship patterns**, and schema mode — which the operator reviews and edits in the pack creator before saving (the draft is never auto-saved). Uses the dashboard's configured `OPENAI_API_KEY` (model via `RESTORMEL_CONNECT_DESIGNER_MODEL`, default `gpt-4o-mini`); returns 503 if unset. This is the highest-leverage quality control: it ensures the LLM knows what to look for and how ideas should connect, rather than producing a relationship-less pile of chunks.

## Security

- Graph store credentials are **AES-256-GCM encrypted at rest** (`RESTORMEL_CREDENTIALS_ENCRYPTION_KEY`); the secret is write-only and never returned by the API/UI. See [security-baseline.md](../governance/security-baseline.md).
- Connection tests run server-side and return only success/failure text — never the secret.

## Dry-run preview

Before a full run, operators can preview extraction (`POST /keys/dashboard/api/connect/extraction/preview`): it runs the **pack-driven, enforced** extraction over a small sample (a few chunks of a selected document or pasted text) and returns **units, relationships, and quality warnings** — orphan units, disconnected graphs, unknown types, and strict-mode pattern violations — **without writing anything**. This is the tuning loop: adjust the pack, re-preview, then commit. Surfaced on the New job page ("Preview extraction").

## Execution status

- **Persistence + REST + BFF + operator UI:** shipped.
- **Worker stub mode (default):** validates sources, advances stage bookkeeping; no store writes.
- **Worker full mode (`KNOWLEDGE_INGEST_WORKER_MODE=full`):** with `OPENAI_API_KEY` and a graph target, runs the full pipeline via a storage-agnostic **`GraphWriter`** (Postgres spine **or** Bring-Your-Own Surreal — same stages):
  - **extracting + relating:** chunk → `extractGraph` (prompt **enforces `schema_mode` + `relationship_patterns`**) → units + relations.
  - **grouping:** `groupUnits` clusters units into named groups with per-member roles, enforcing the pack's `group_roles`/`schema_mode`.
  - **validating:** each unit assessed against its source text (ok/weak/unsupported).
  - **remediating (self-healing):** weak/unsupported units are repaired (rewritten faithfully and re-embedded) or dropped, via `remediateUnits`.
  - **embedding:** final unit texts embedded via OpenAI (`RESTORMEL_CONNECT_EMBED_MODEL`, default `text-embedding-3-small`); runs after remediation so repaired text is embedded.
  - Stages honour the job's **`stop_after_stage`** (`shouldRunStage`); bounded by `KNOWLEDGE_INGEST_MAX_CHUNKS` (default 8) and a per-source unit cap.
  - **Postgres** writes typed spine tables (`knowledge_graph_units/relations/groups/group_members`, validation columns). **Surreal** writes via `CREATE`/`RELATE`/`UPDATE` using the pack's `graph_schema` table/edge names.
  - **No LLM key:** falls back to a `source` record per input.
- Preview and full execution share the same prompt builders, so **what you preview is what runs**.
- **Graph explorer** (`/keys/dashboard/connect/graph`) surfaces groups (with member roles), the ideas list filterable by validation status, and live counts (Postgres spine).
