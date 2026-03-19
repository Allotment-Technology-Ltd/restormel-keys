# Phase 3 — MCP

> **Time:** ~15 minutes  
> **Prerequisites:** [Phase 1](03-phase-1-choose-workflow.md) complete; you chose "In my agent or IDE" or want MCP  
> **You'll need:** Understanding of [Model Context Protocol](https://modelcontextprotocol.io); optional: an MCP client (IDE or agent framework)

This phase introduces the Restormel MCP tool surface. **`@restormel/mcp`** includes **JSON tool schemas**, a **stdio MCP server** (`restormel-mcp`), and a **`createRestormelMcpServer()`** factory for custom transports.

---

## Step 3.1 — Understand the tool surface

The following tools are defined (name, description, input/output schema):

- **models.list** — List available models across providers
- **providers.validate** — Validate provider configuration and access
- **cost.estimate** — Estimate cost for a model and token volume
- **routing.explain** — Explain routing decisions for a request
- **entitlements.check** — Check plan entitlements and feature access
- **integration.generate** — Generate integration configuration for a stack
- **docs.search** — Search Restormel documentation

See [MCP reference](/keys/docs/integrations/mcp) for full schema details.

---

## Step 3.2 — Install and run the MCP server

```bash
pnpm add @restormel/mcp @restormel/keys
```

**Stdio server** (typical for IDEs):

```json
{
  "mcpServers": {
    "restormel": {
      "command": "pnpm",
      "args": ["exec", "restormel-mcp"]
    }
  }
}
```

Import **schemas** or **embed** the server:

```ts
import { ALL_TOOLS, createRestormelMcpServer } from "@restormel/mcp";
```

See `packages/mcp/README.md` for environment variables (`RESTORMEL_MCP_CONFIG`, provider keys for `providers.validate`, optional `RESTORMEL_EVALUATE_URL` + `RESTORMEL_GATEWAY_KEY` for remote policy checks).

---

## Step 3.3 — Connection status (Dashboard)

In the [Dashboard → Developer Tools → MCP](/keys/dashboard/dev-tools/mcp) tab you can see:

- Connection status (when a server is configured)
- Available tools list
- Recent calls and errors (when wired)

This tab lists tools and links to the MCP setup guide. **Connection status** depends on your local MCP client (Cursor, etc.) — the dashboard does not host the stdio server.

### How to test

You have `@restormel/mcp` installed, can run `pnpm exec restormel-mcp`, and can import `ALL_TOOLS` or `createRestormelMcpServer`. Verify tools in your MCP client; use the Dashboard tab as a checklist, not a live connection meter.

---

## Checkpoint

You now have:

- Clarity on the MCP tool surface.
- `@restormel/mcp` installed and importable.
- Dashboard MCP tab bookmarked for when the runtime is available.
