# @restormel/mcp

**Model Context Protocol** tools for Restormel Keys: model catalog, cost estimates, routing explain, provider validation, entitlements, integration scaffolds, and offline docs search.

## Install

```bash
pnpm add @restormel/mcp @restormel/keys
# or
npm install @restormel/mcp @restormel/keys
```

`@restormel/keys` is required at runtime for catalog, pricing, and validation logic.

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

## Environment variables

| Variable | Purpose |
|----------|---------|
| `RESTORMEL_MCP_CONFIG` | Optional path to JSON `KeysConfig` for local entitlement rules (see `@restormel/keys`). |
| `RESTORMEL_MCP_<PROVIDER>_KEY` | Override API key for `providers.validate` (e.g. `RESTORMEL_MCP_OPENAI_KEY`). Use underscores for hyphenated provider ids (`RESTORMEL_MCP_AZURE_OPENAI_KEY`). |
| `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GOOGLE_API_KEY`, … | Conventional names also accepted for validation. |
| `RESTORMEL_EVALUATE_URL` | Optional full URL to `POST` policy evaluation (e.g. dashboard `.../api/policies/evaluate`). |
| `RESTORMEL_GATEWAY_KEY` | Bearer token for that endpoint (never log this value). |

If `RESTORMEL_EVALUATE_URL` and `RESTORMEL_GATEWAY_KEY` are both set, `entitlements.check` calls the remote endpoint with `{ modelId: <feature> }`. Otherwise it uses local rules from `RESTORMEL_MCP_CONFIG` or a permissive default.

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

## Security

- Do not commit real API keys or gateway keys.
- This package does **not** log raw credentials. Errors are generic when validation or HTTP calls fail.

See repo `docs/security-baseline.md` for the full baseline.
