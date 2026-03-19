# Phase 3 — MCP

> **Time:** ~15 minutes  
> **Prerequisites:** [Phase 1](03-phase-1-choose-workflow.md) complete; you chose "In my agent or IDE" or want MCP  
> **You'll need:** Understanding of [Model Context Protocol](https://modelcontextprotocol.io); optional: an MCP client (IDE or agent framework)

This phase introduces the Restormel MCP tool surface. **Tool schemas** are defined in `@restormel/mcp`; a runtime MCP server is planned. You can consume the schemas now and wire a server when available.

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

## Step 3.2 — Install the MCP package (schemas)

```bash
pnpm add @restormel/mcp
```

Import tool definitions:

```ts
import { ALL_TOOLS, modelsListTool } from "@restormel/mcp";
```

Use these to build an MCP server that implements the tools (e.g. with `@modelcontextprotocol/sdk`). Implementation is out of scope for this walkthrough until the official server is released.

---

## Step 3.3 — Connection status (Dashboard)

In the [Dashboard → Developer Tools → MCP](/keys/dashboard/dev-tools/mcp) tab you can see:

- Connection status (when a server is configured)
- Available tools list
- Recent calls and errors (when wired)

For now this tab shows the tool list and links to the MCP setup guide.

### How to test

You have `@restormel/mcp` installed and can import `ALL_TOOLS`. If you build your own server, verify it appears in the Dashboard when connected.

---

## Checkpoint

You now have:

- Clarity on the MCP tool surface.
- `@restormel/mcp` installed and importable.
- Dashboard MCP tab bookmarked for when the runtime is available.
