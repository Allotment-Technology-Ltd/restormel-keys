# @restormel/mcp-server

A standalone Model Context Protocol (MCP) server that exposes a Restormel knowledge graph as trustworthy, provenance-rich retrieval tools. It connects **directly** to your graph store via `@restormel/graphrag-core` — no hosted REST API, no control plane. Point it at a SurrealDB (or Neo4j) instance, give it a workspace, and any MCP client (Claude Desktop, Cursor, your own agent) can query the graph with the trust filter built in: claims are returned **supported-only by default**, with full audit provenance and a dedicated tool to inspect exactly what the filter is hiding.

## Prerequisites

- Node.js >= 20
- A reachable graph store (SurrealDB over its HTTP `/sql` API, or Neo4j) with an ingested workspace
- pnpm (this package lives in the Restormel monorepo)

## Quick start

```bash
# 1. install workspace deps
pnpm install

# 2. build
pnpm --filter @restormel/mcp-server build

# 3. configure
cp apps/mcp-server/.env.example apps/mcp-server/.env   # then edit values

# 4. run (stdio, the default)
node apps/mcp-server/dist/index.js

# 5. register in Claude Desktop / Cursor (claude_desktop_config.json):
#    {
#      "mcpServers": {
#        "restormel": {
#          "command": "node",
#          "args": ["/abs/path/to/apps/mcp-server/dist/index.js"],
#          "env": {
#            "RESTORMEL_GRAPH_STORE_URL": "https://your-surreal-host/sql",
#            "RESTORMEL_GRAPH_STORE_CREDS": "{\"username\":\"root\",\"password\":\"root\"}",
#            "RESTORMEL_WORKSPACE_ID": "<your-workspace-id>"
#          }
#        }
#      }
#    }
```

For local development without a build step, use `pnpm --filter @restormel/mcp-server dev` (runs `tsx src/index.ts`).

## Environment variables

| Name | Required | Default | Description |
| --- | --- | --- | --- |
| `RESTORMEL_GRAPH_STORE_TYPE` | no | `surrealdb` | Graph backend: `surrealdb` or `neo4j`. |
| `RESTORMEL_GRAPH_STORE_URL` | **yes** | — | Connection URL. SurrealDB: the HTTP `/sql` endpoint (namespace/database from the path tail `…/sql/<ns>/<db>` or `?ns=&db=`). Neo4j: a `bolt://`/`neo4j://` URI. |
| `RESTORMEL_GRAPH_STORE_CREDS` | no | `{}` | JSON object of credentials: `{ "username", "password" }` (also accepts `{ "user", "password" }`). |
| `RESTORMEL_WORKSPACE_ID` | **yes** | — | Workspace this server serves; the fallback when a tool call omits `workspace_id`. |
| `RESTORMEL_DEFAULT_VERIFICATION` | no | `supported` | Default trust policy, comma-separated: `supported` \| `supported,weak` \| `supported,weak,unsupported`. |
| `RESTORMEL_MAX_TOKENS` | no | `2000` | Default token budget for context blocks when a tool omits `max_tokens`. |
| `RESTORMEL_LOG_LEVEL` | no | `info` | `debug` \| `info` \| `warn` \| `error` (stderr only). |
| `RESTORMEL_TRANSPORT` | no | `stdio` | `stdio` (Claude Desktop/Cursor) or `http` (StreamableHTTP). |
| `RESTORMEL_PORT` | no | `3000` | Port used only when `RESTORMEL_TRANSPORT=http`. |

## Tools

All tools share the `connect.graph.*` namespace and return **structured** results. They never throw raw errors back to the client — on failure they return `{ error, code, recoverable, suggestion }`.

### `connect.graph.retrieve_context`

Primary retrieval: seeded, graph-expanded, token-budgeted context for a query.

```jsonc
// input
{ "query": "What grounds moral realism?", "top_k": 5, "max_tokens": 2000 }
// output
{
  "context_block": "…assembled prose context…",
  "claims": [
    {
      "claimId": "claim:abc",
      "claimText": "Moral facts are mind-independent.",
      "sourceRef": "Enoch, Taking Morality Seriously",
      "verificationState": "validated",
      "confidenceScore": 0.82,
      "trustScore": 90,
      "retrievedAt": "2026-06-07T12:00:00.000Z",
      "hopDepth": 0,
      "policyApplied": "include=[supported], exclude-flagged",
      "auditTrace": [ { "step": "retrieved", "detail": "source: …" } ]
    }
  ],
  "trace_summary": { "operation": "retrieve_context", "seed_count": 5, "hops": 2, "claim_count": 11, "tokens_used": 1840 }
}
```

### `connect.graph.expand_context`

Graph expansion from explicit seed node ids (where graph-RAG beats vector-RAG).

```jsonc
{ "seed_node_ids": ["claim:abc", "claim:def"], "depth": 2, "edge_types": ["supports", "contradicts"] }
// → { context_block, claims: ClaimWithProvenance[], trace_summary }
```

### `connect.graph.find_relevant_subgraph`

Topic-driven subgraph; `reasoning_mode` (`semantic` | `causal` | `temporal`) re-weights edge priors.

```jsonc
{ "topic": "free will and determinism", "reasoning_mode": "causal", "max_nodes": 40 }
// → { context_block, claims: ClaimWithProvenance[], trace_summary }
```

### `connect.graph.find_paths`

Ranked paths between two nodes, or an empty list with a reason.

```jsonc
{ "source_node_id": "claim:abc", "target_node_id": "claim:xyz", "max_hops": 4 }
// output
{
  "paths": [ { "node_ids": ["claim:abc","claim:mid","claim:xyz"], "relations": [ … ], "score": 1.2 } ],
  "trace_summary": { "operation": "find_paths", "claim_count": 3, "relation_count": 2 }
}
// when none exist: { "paths": [], "trace_summary": { "reason": "no_path_within_4_hops" } }
```

### `connect.graph.inspect_query` — the diagnostic tool

Runs a permissive dry retrieval, then partitions candidates into what **would** be returned under the configured trust policy vs what is **filtered out**, with a reason per dropped claim.

```jsonc
// input
{ "query": "Is consciousness physical?" }
// output
{
  "would_retrieve": [ /* ClaimWithProvenance that passes the default policy */ ],
  "filtered_out":  [ /* ClaimWithProvenance that exists but is filtered */ ],
  "reason_filtered": [ "claim:weak1: category \"weak\" not in policy include=[supported]" ],
  "policy_inspected": "include=[supported], exclude-flagged",
  "trace": { "operation": "retrieve_context", "claim_count": 19, "retrieval_trace": { … } }
}
```

Pass `verification_policy` to inspect against a hypothetical policy instead of the server default.

## Verification filtering

Restormel's trust promise is that retrieval returns **supported** evidence by default — claims whose `verification_state` is in the domain pack's supported vocabulary, with flagged claims excluded. This is why `RESTORMEL_DEFAULT_VERIFICATION=supported` is the default: an agent should not silently ground its answer in unverified or flagged material.

To widen, set a broader default (`RESTORMEL_DEFAULT_VERIFICATION=supported,weak`) or pass a per-call `verification_policy`:

```jsonc
{ "query": "…", "verification_policy": { "include": ["supported", "weak"], "min_trust_score": 50, "exclude_flagged": true } }
```

Before widening, run `connect.graph.inspect_query` to see precisely which claims the supported-only filter is excluding and why.

## Common failure modes

1. **Startup exits with "RESTORMEL_GRAPH_STORE_URL is required" (or similar).**
   Required env vars are missing or malformed. The server validates everything up front and prints each problem to stderr. Fix the named variables in `.env` / your MCP client `env` block. There is no degraded start.

2. **Startup exits with "graph store health check failed".**
   The URL/credentials are wrong or the store is unreachable. Verify `RESTORMEL_GRAPH_STORE_URL` resolves and accepts the SurrealDB HTTP `/sql` API, and that `RESTORMEL_GRAPH_STORE_CREDS` is valid JSON with a working username/password.

3. **Startup exits with "workspace … has no graph content".**
   The workspace is empty (or `RESTORMEL_WORKSPACE_ID` points at the wrong one). Ingest a domain pack into the workspace, or correct the id. The server refuses to serve an empty graph so tools never silently return nothing.
