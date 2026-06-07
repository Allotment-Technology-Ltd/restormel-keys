# @restormel/mcp

**Model Context Protocol** tools for Restormel Keys and Restormel Testing: model catalog, cost estimates, routing explain, provider validation, entitlements, **projects + model bindings + environments + Gateway keys (read/write)**, **Testing hub snapshot + journey + CI env template + resolve probe**, control-plane route/policy CRUD, integration bootstrap, BYOK contracts, simulation, offline docs search, and **Horizon suite read tools** (`docs.canonical_resolve`, `testing.config_validate`, `observability.trace_summarize`, `graph.fixture_validate`, `state.memory_preview` — same semantics as **`POST …/api/suite/invoke`** on the dashboard when using a Zuplo consumer key; see [restormel-suite-tool-envelope.schema.json](../../docs/integrations/restormel-suite-tool-envelope.schema.json)).

## Install

```bash
pnpm add @restormel/mcp @restormel/keys
# or
npm install @restormel/mcp @restormel/keys
```

`@restormel/keys` is required at runtime for catalog, pricing, and validation logic.

**Programmatic doc index:** `searchDocs`, `DOC_INDEX`, and `DocIndexEntry` are exported from the package entrypoint for hosts such as **`@restormel/support`** (same data as MCP `docs.search`).

## Run the stdio server (Cursor, Claude Desktop, Codex, …)

After install, point your MCP client at the published binary:

```json
{
  "mcpServers": {
    "restormel": {
      "command": "pnpm",
      "args": ["exec", "restormel-mcp"],
      "env": {}
    }
  }
}
```

Or with `npx` (from a project that depends on `@restormel/mcp`):

```json
{
  "mcpServers": {
    "restormel": {
      "command": "npx",
      "args": ["--no-install", "restormel-mcp"]
    }
  }
}
```

Global install:

```bash
npm i -g @restormel/mcp @restormel/keys
restormel-mcp
```

**Important:** The server speaks MCP on **stdout**. Do not enable tools that print to stdout. Diagnostics use **stderr** only.

## CI and operator checks (non-interactive)

Emit a JSON manifest (package version + sorted tool names) without starting stdio:

```bash
pnpm exec restormel-mcp --check
# equivalent:
pnpm exec restormel-mcp tools --json
```

Exit code `0` when the manifest is built successfully. Use in smoke scripts instead of parsing stderr from a live stdio session.

**Publish / npm login:** Publishing requires a logged-in npm user with access to the `@restormel` scope. If `npm whoami` returns **401**, run `npm login` (or set a valid `NPM_TOKEN`) before `pnpm publish`. A misleading **404** on `PUT …/@restormel%2fmcp` often means missing auth or no permission to create the package under the org.

## Environment variables

**Canonical naming (read this first):** [docs/guides/restormel-environment-vocabulary.md](../../docs/guides/restormel-environment-vocabulary.md) — official names for `RESTORMEL_GATEWAY_KEY` vs `RESTORMEL_SERVER_TOKEN`, and for the three URL roles (`RESTORMEL_KEYS_BASE`, `RESTORMEL_CONTROL_PLANE_URL`, `RESTORMEL_EVALUATE_URL`). Do not introduce alternate env names for the same key or URL in docs or generators.

| Variable | Purpose |
|----------|---------|
| `RESTORMEL_MCP_CONFIG` | Optional path to JSON `KeysConfig` for local entitlement rules (see `@restormel/keys`). |
| `RESTORMEL_MCP_<PROVIDER>_KEY` | Override API key for `providers.validate` (e.g. `RESTORMEL_MCP_OPENAI_KEY`). Use underscores for hyphenated provider ids (`RESTORMEL_MCP_AZURE_OPENAI_KEY`). |
| `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GOOGLE_API_KEY`, `AIZOLO_API_KEY`, … | Conventional names also accepted for validation. |
| `RESTORMEL_EVALUATE_URL` | Optional **full** URL for `POST` policy evaluation on the **Dashboard API**. Hosted example: `https://restormel.dev/keys/dashboard/api/policies/evaluate`. Self-host: `https://<host>/keys/dashboard/api/policies/evaluate`. |
| `RESTORMEL_GATEWAY_KEY` | Project Gateway Key (`rk_…`) for `Authorization: Bearer` to the evaluate URL (never log this value). |
| `RESTORMEL_CONTROL_PLANE_URL` | Base URL for MCP control-plane tools (`projects.list`, `project_models.list`, `routes.*`, `policies.*`, `fallback_chain.set`). Must be the dashboard app origin **without** a trailing slash, such that `{base}/api/projects/...` is valid. Hosted: `https://restormel.dev/keys/dashboard`. **Not** the same value as `RESTORMEL_EVALUATE_URL`. |
| `RESTORMEL_SERVER_TOKEN` | Preferred server-only Bearer token for control-plane calls (typically the same Gateway Key). `RESTORMEL_GATEWAY_KEY` is accepted as a fallback. |
| `RESTORMEL_CONNECT_API_BASE` | Hosted Connect REST origin for `connect.*` knowledge tools (e.g. `https://restormel.dev`). |
| `RESTORMEL_WORKSPACE_ID` | Default Keys workspace id for `connect.*` tools (override per call with `workspace_id`). |
| `RESTORMEL_PROJECT_ID` | Optional default Keys project id for `connect.*` tools. |

If `RESTORMEL_EVALUATE_URL` and `RESTORMEL_GATEWAY_KEY` are both set, `entitlements.check` calls the remote endpoint with `{ modelId: <feature> }`. Otherwise it uses local rules from `RESTORMEL_MCP_CONFIG` or a permissive default.

For control-plane tools (read and write: `projects.list`, `project_models.list`, `routes.*`, `policies.*`, …), set `RESTORMEL_CONTROL_PLANE_URL` and `RESTORMEL_SERVER_TOKEN` (or gateway key fallback).

For **Restormel Testing** HTTP resolve checks (`testing.resolve_probe`), set **`RESTORMEL_KEYS_BASE`** (site origin) and the same bearer you use for the CLI (**`RESTORMEL_GATEWAY_KEY`** or compatibility aliases — see vocabulary doc § Testing runner).

For **Restormel Connect** knowledge tools, set `RESTORMEL_CONNECT_API_BASE`, `RESTORMEL_GATEWAY_KEY` and `RESTORMEL_WORKSPACE_ID` (BYO Surreal graph store configured in the Connect hub). Search tools — `connect.search`, `connect.get_context_for` — return structured context packs. The graph orchestrator tools — `connect.graph.retrieve_context`, `connect.graph.expand_context`, `connect.graph.find_relevant_subgraph`, `connect.graph.find_paths`, `connect.graph.summarise_subgraph` — proxy to `POST /connect/v1/graph` and return curated, ranked, token-budgeted subgraphs/paths with an audit trace. **They default to supported-only retrieval** (the trust promise); pass `verification_policy.include` (e.g. `["supported","weak"]`) to widen.

See repo runbook [docs/runbooks/mcp-implementation-workflow.md](../../docs/runbooks/mcp-implementation-workflow.md) for the full server-side journey (evaluate vs control-plane bases, trust boundaries, and links to Cloud API / dashboard docs).

## Programmatic use

Embed the same tool surface in your own host:

```ts
import { createRestormelMcpServer } from "@restormel/mcp/server";
// or: import { createRestormelMcpServer } from "@restormel/mcp";

const server = createRestormelMcpServer();
// connect your transport (stdio, HTTP, etc.) per @modelcontextprotocol/sdk
```

## Tool schemas (JSON)

For clients that only need JSON Schema metadata:

```ts
import { ALL_TOOLS } from "@restormel/mcp";
```

## Suite inventory and roadmap

Maintainer table of **implemented tools** (read vs act) and **desired** Testing / Graph / State / observability coverage: [docs/restormel/HORIZON-PLATFORM-PROGRAMME.md](../../docs/restormel/HORIZON-PLATFORM-PROGRAMME.md) (section 3).

## Security

- Do not commit real API keys or gateway keys.
- This package does **not** log raw credentials. Errors are generic when validation or HTTP calls fail.
- Key lifecycle helpers only emit masked metadata + fingerprints in generated contracts/templates (never raw key values).

See repo `docs/security-baseline.md` for the full baseline.
