# MCP suite tools — troubleshooting

**Scope:** Horizon Phase 1 **suite read** tools (`docs.canonical_resolve`, `testing.config_validate`, `observability.trace_summarize`, `graph.fixture_validate`, `state.memory_preview`) via **stdio MCP** or **HTTP** (`POST …/suite/invoke`).

## Environment matrix

| Surface | Auth | Notes |
|---------|------|--------|
| stdio `@restormel/mcp` | None for suite tools | Runs in IDE/agent process; no `RESTORMEL_*` required for these five tools. |
| Dashboard `POST /keys/dashboard/api/suite/invoke` | Session or Gateway key (same as other dashboard APIs) | Signed-in dashboard or server-to-server with Bearer. |
| Zuplo `POST /api/suite/invoke` | Zuplo consumer key (`zpka_…`) | Forwards to dashboard; backend sees injected **`rk_…`** per [zuplo-setup.md](./zuplo-setup.md). |

## Symptom → check

| Symptom | Likely cause | What to do |
|---------|----------------|------------|
| `RST_SUITE_UNKNOWN_TOPIC` | Invalid `topic` for `docs.canonical_resolve` | Call with a topic from `CANONICAL_DOC_TOPICS` (`@restormel/mcp`) or see [THEME-L-IA-MATRIX.md](../architecture/THEME-L-IA-MATRIX.md). |
| `RST_SUITE_TRACE_SHAPE` / `RST_SUITE_TRACE_PARSE` | `traceJson` not valid **RunTrace** JSON | Validate against `@restormel/contracts` **RunTraceSchema**; ensure `source`, `events`, `snapshots` are present. |
| `RST_SUITE_GRAPH_SHAPE` | `graphJson` missing arrays | Root object must have `nodes`, `edges`, `ghostNodes`, `ghostEdges` arrays (Contract v0 **GraphData** shape). |
| `RST_SUITE_STATE_*` | Bad **StateEvent** array or reducer error | Events must be a JSON **array** of typed events; see `@restormel/state` types. |
| `RST_SUITE_INPUT_TOO_LARGE` | Body exceeds package caps | Shorten input; config ~512k chars, trace ~2M, graph ~2M, state ~1M. |
| HTTP `RST_SUITE_UNKNOWN_TOOL` | Wrong `tool` string in envelope | Use exact names from [restormel-suite-tool-envelope.schema.json](../integrations/restormel-suite-tool-envelope.schema.json). |
| HTTP 401 | Missing or invalid Bearer / session | For Zuplo: consumer key; for dashboard: Gateway key or session cookie flow. |
| Version skew | `@restormel/mcp` vs dashboard deploy | Bump MCP to match published changelog; suite logic ships with dashboard via workspace pin. |

## CI / regression

- Package tests: `pnpm --filter @restormel/mcp run test` (fixtures under `packages/mcp/test/fixtures/`).
- Zuplo OpenAPI gate: `node zuplo-gateway/scripts/check-openapi.mjs` after editing `zuplo-gateway/config/routes.oas.json`.

## Security

- Do not log full config YAML, trace JSON, or state event bodies in support tickets.
- `state.memory_preview` returns **text lengths only**, not cell content.

See also [mcp-implementation-workflow.md](./mcp-implementation-workflow.md) and [security-baseline.md](../governance/security-baseline.md).
