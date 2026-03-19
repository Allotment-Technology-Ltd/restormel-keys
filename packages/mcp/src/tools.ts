/**
 * MCP tool schema definitions for Restormel.
 * These define the tool surface — name, description, and JSON Schema for inputs/outputs.
 *
 * **Runtime:** The stdio MCP server (`restormel-mcp` / `pnpm exec restormel-mcp`) registers tools
 * with Zod schemas that mirror this file; keep shapes aligned when changing either layer.
 */

export type McpToolSchema = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
};

export const modelsListTool: McpToolSchema = {
  name: "models.list",
  description: "List available models across all configured providers.",
  inputSchema: {
    type: "object",
    properties: {
      provider: {
        type: "string",
        description: "Filter by provider ID (e.g. openai, anthropic). Omit to list all.",
      },
    },
    additionalProperties: false,
  },
  outputSchema: {
    type: "object",
    properties: {
      models: {
        type: "array",
        items: {
          type: "object",
          properties: {
            id: { type: "string" },
            provider: { type: "string" },
            displayName: { type: "string" },
          },
        },
      },
    },
  },
};

export const providersValidateTool: McpToolSchema = {
  name: "providers.validate",
  description: "Validate provider configuration and access credentials.",
  inputSchema: {
    type: "object",
    properties: {
      provider: {
        type: "string",
        description: "Provider ID to validate (e.g. openai, anthropic).",
      },
    },
    required: ["provider"],
    additionalProperties: false,
  },
  outputSchema: {
    type: "object",
    properties: {
      valid: { type: "boolean" },
      provider: { type: "string" },
      errors: { type: "array", items: { type: "string" } },
    },
  },
};

export const costEstimateTool: McpToolSchema = {
  name: "cost.estimate",
  description: "Estimate cost for a model given an expected token volume.",
  inputSchema: {
    type: "object",
    properties: {
      model: {
        type: "string",
        description: "Model ID (e.g. gpt-4o, claude-3-5-sonnet).",
      },
      inputTokensM: {
        type: "number",
        description: "Input tokens in millions. Default: 1.",
      },
      outputTokensM: {
        type: "number",
        description: "Output tokens in millions. Default: 1.",
      },
    },
    required: ["model"],
    additionalProperties: false,
  },
  outputSchema: {
    type: "object",
    properties: {
      model: { type: "string" },
      provider: { type: "string" },
      inputCost: { type: "number" },
      outputCost: { type: "number" },
      totalCost: { type: "number" },
      unit: { type: "string" },
    },
  },
};

export const routingExplainTool: McpToolSchema = {
  name: "routing.explain",
  description: "Explain routing decisions for a given model or route request.",
  inputSchema: {
    type: "object",
    properties: {
      model: {
        type: "string",
        description: "Model ID to explain routing for.",
      },
      projectId: {
        type: "string",
        description: "Optional project context for route resolution.",
      },
    },
    required: ["model"],
    additionalProperties: false,
  },
  outputSchema: {
    type: "object",
    properties: {
      model: { type: "string" },
      resolvedProvider: { type: "string" },
      reason: { type: "string" },
      steps: { type: "array", items: { type: "string" } },
    },
  },
};

export const entitlementsCheckTool: McpToolSchema = {
  name: "entitlements.check",
  description: "Check plan entitlements and feature access for a user or workspace.",
  inputSchema: {
    type: "object",
    properties: {
      feature: {
        type: "string",
        description: "Feature key to check (e.g. healthcheck, advanced-routing).",
      },
      userId: {
        type: "string",
        description: "User ID to check entitlements for.",
      },
    },
    required: ["feature"],
    additionalProperties: false,
  },
  outputSchema: {
    type: "object",
    properties: {
      feature: { type: "string" },
      entitled: { type: "boolean" },
      plan: { type: "string" },
      reason: { type: "string" },
    },
  },
};

export const integrationGenerateTool: McpToolSchema = {
  name: "integration.generate",
  description: "Generate integration configuration for a given stack and provider setup.",
  inputSchema: {
    type: "object",
    properties: {
      framework: {
        type: "string",
        description: "Framework (e.g. next, svelte, express).",
      },
      providers: {
        type: "array",
        items: { type: "string" },
        description: "Provider IDs to include (e.g. openai, anthropic).",
      },
    },
    required: ["framework"],
    additionalProperties: false,
  },
  outputSchema: {
    type: "object",
    properties: {
      config: { type: "string", description: "Generated configuration as a string." },
      files: {
        type: "array",
        items: {
          type: "object",
          properties: {
            path: { type: "string" },
            content: { type: "string" },
          },
        },
      },
    },
  },
};

export const docsSearchTool: McpToolSchema = {
  name: "docs.search",
  description: "Search Restormel documentation by keyword or question.",
  inputSchema: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "Search query or question.",
      },
      section: {
        type: "string",
        description: "Optional section filter (e.g. cli, mcp, walkthrough).",
      },
    },
    required: ["query"],
    additionalProperties: false,
  },
  outputSchema: {
    type: "object",
    properties: {
      results: {
        type: "array",
        items: {
          type: "object",
          properties: {
            title: { type: "string" },
            url: { type: "string" },
            excerpt: { type: "string" },
          },
        },
      },
    },
  },
};

export const ALL_TOOLS: McpToolSchema[] = [
  modelsListTool,
  providersValidateTool,
  costEstimateTool,
  routingExplainTool,
  entitlementsCheckTool,
  integrationGenerateTool,
  docsSearchTool,
];
