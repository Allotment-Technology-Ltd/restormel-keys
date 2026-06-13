# Connect — BYO graph store for agents (MVP)

**Status:** Reference (operator + integrator)  
**Canonical product:** [docs/product/CONNECT-PRODUCT.md](../product/CONNECT-PRODUCT.md)

Restormel Connect MVP keeps the **knowledge graph on your SurrealDB** (Bring-Your-Own). Restormel hosts ingest orchestration, job metadata, and encrypted connection secrets — not your full corpus.

## Source pre-check (Pipeline → Sources)

Before full parse/import, use **Preview metadata** on a page URL or uploaded text/HTML file. Restormel fetches the page head (or reads your upload), extracts title, authors, canonical URL, publisher, and description, and lets you edit them before parse/chunk. Stored provenance flows into ingest as graph **source** title, URL, and `text_preview` for the explorer.

## Prerequisites

1. **Graph store** — Surreal endpoint, namespace, database, credentials; connection test **OK** in Connect hub (Pipeline → Graph store).
2. **Keys routes** — Published ingestion **chat** (extraction) and **embedding** routes with provider credentials.
3. **Ingest** — At least one successful run so `claim` rows and embeddings exist on **your** instance.
4. **Reachability** — Your Surreal HTTP API must be reachable from Restormel hosted retrieve (firewall / allowlist as needed).

## Agent integration (MCP)

- Search tools: `connect.search`, `connect.get_context_for` on `@restormel/mcp` (HTTP mirror: `POST /keys/dashboard/api/connect/invoke`)
- Graph orchestrator tools (higher-order, curated context — map to `POST /connect/v1/graph`):
  - `connect.graph.retrieve_context` — vector + graph retrieval, token-budgeted
  - `connect.graph.expand_context` — expand from explicit seed node ids (optional edge-type filter)
  - `connect.graph.find_relevant_subgraph` — `reasoning_mode`: `semantic` | `causal` | `temporal`
  - `connect.graph.find_paths` — ranked paths between two nodes
  - `connect.graph.summarise_subgraph` — condense a subgraph under a `max_tokens` budget
- Env: `RESTORMEL_CONNECT_API_BASE`, `RESTORMEL_GATEWAY_KEY`, `RESTORMEL_WORKSPACE_ID`

**Trust by default:** every `connect.graph.*` tool (and `POST /connect/v1/graph`) returns **supported-only** claims unless you pass `verification_policy.include` (e.g. `["supported", "weak"]`). The response `trace.verification` reports included/excluded counts by trust category.

Copy-paste snippet: Connect hub → **Connect your agent** panel (`/keys/dashboard/connect`). The snippet is generated as valid JSON (env values are escaped) — paste into your MCP host `mcp.json`.

### Gateway key handoff (browser)

After you create a Gateway key, the dashboard may store it briefly in **`sessionStorage`** (`rk_pending_gateway_key_session`) so you can copy the MCP snippet in the same tab. Restormel does **not** persist raw `rk_…` keys server-side. Treat this like any secret in the browser: **XSS on the dashboard origin could read session storage** — keep extensions and third-party scripts trusted, and revoke keys you no longer need.

## Surreal endpoint policy (hosted dashboard)

When Restormel servers call **your** Surreal HTTP URL (connection test, ingest, retrieve), endpoints are restricted to reduce SSRF risk:

- **Production:** HTTPS only; no private, link-local, or cloud-metadata hostnames.
- **Local dev:** `http://localhost` / `127.0.0.1` allowed; remote hosts should use HTTPS.
- **Operator override (non-production only):** `RESTORMEL_ALLOW_PRIVATE_SURREAL_ENDPOINT=1` allows private IPs for VPN/LAN Surreal during dogfood — never enable in production.

## REST

`POST /connect/v1/retrieve` returns `context_block`, optional structured `graph` and `context_pack`, and `metadata.retrieval_degraded_code` when BYO setup is incomplete.

`POST /connect/v1/graph` runs the higher-order graph orchestrator. Set `operation` to one of `retrieve_context`, `expand_context`, `find_relevant_subgraph`, `find_paths`, or `summarise_subgraph`. Each returns a curated, ranked `subgraph` (or `paths`) plus a compact `trace` (seed count, hops, `tokens_used`, `nodes_dropped`, verification counts). Pass `max_tokens` to fit a context window and `verification_policy` to widen beyond supported-only.

## Roadmap: managed graphs

Optional Restormel-hosted graph storage may ship later for teams that do not want to operate Surreal. Not part of MVP — see [ROADMAP.md](../../ROADMAP.md).
