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

export const routesListTool: McpToolSchema = {
  name: "routes.list",
  description: "List configured project routes from the Restormel control plane.",
  inputSchema: {
    type: "object",
    properties: {
      projectId: { type: "string", description: "Project ID in the Restormel control plane." },
    },
    required: ["projectId"],
    additionalProperties: false,
  },
};

export const routesCreateTool: McpToolSchema = {
  name: "routes.create",
  description: "Create a route in the Restormel control plane.",
  inputSchema: {
    type: "object",
    properties: {
      projectId: { type: "string" },
      name: { type: "string" },
      primaryModel: { type: "string" },
      fallbackModels: { type: "array", items: { type: "string" } },
      enabled: { type: "boolean" },
    },
    required: ["projectId", "name", "primaryModel"],
    additionalProperties: false,
  },
};

export const routesUpdateTool: McpToolSchema = {
  name: "routes.update",
  description: "Update a route in the Restormel control plane.",
  inputSchema: {
    type: "object",
    properties: {
      projectId: { type: "string" },
      routeId: { type: "string" },
      name: { type: "string" },
      primaryModel: { type: "string" },
      fallbackModels: { type: "array", items: { type: "string" } },
      enabled: { type: "boolean" },
    },
    required: ["projectId", "routeId"],
    additionalProperties: false,
  },
};

export const routesDeleteTool: McpToolSchema = {
  name: "routes.delete",
  description: "Delete a route in the Restormel control plane.",
  inputSchema: {
    type: "object",
    properties: {
      projectId: { type: "string" },
      routeId: { type: "string" },
    },
    required: ["projectId", "routeId"],
    additionalProperties: false,
  },
};

export const policiesListTool: McpToolSchema = {
  name: "policies.list",
  description: "List configured project policies from the Restormel control plane.",
  inputSchema: {
    type: "object",
    properties: {
      projectId: { type: "string" },
    },
    required: ["projectId"],
    additionalProperties: false,
  },
};

export const policiesCreateTool: McpToolSchema = {
  name: "policies.create",
  description: "Create a policy in the Restormel control plane.",
  inputSchema: {
    type: "object",
    properties: {
      projectId: { type: "string" },
      name: { type: "string" },
      effect: { type: "string", enum: ["allow", "deny"] },
      roles: { type: "array", items: { type: "string" } },
      plans: { type: "array", items: { type: "string" } },
      models: { type: "array", items: { type: "string" } },
      enabled: { type: "boolean" },
    },
    required: ["projectId", "name", "effect"],
    additionalProperties: false,
  },
};

export const policiesUpdateTool: McpToolSchema = {
  name: "policies.update",
  description: "Update a policy in the Restormel control plane.",
  inputSchema: {
    type: "object",
    properties: {
      projectId: { type: "string" },
      policyId: { type: "string" },
      name: { type: "string" },
      effect: { type: "string", enum: ["allow", "deny"] },
      roles: { type: "array", items: { type: "string" } },
      plans: { type: "array", items: { type: "string" } },
      models: { type: "array", items: { type: "string" } },
      enabled: { type: "boolean" },
    },
    required: ["projectId", "policyId"],
    additionalProperties: false,
  },
};

export const policiesDeleteTool: McpToolSchema = {
  name: "policies.delete",
  description: "Delete a policy in the Restormel control plane.",
  inputSchema: {
    type: "object",
    properties: {
      projectId: { type: "string" },
      policyId: { type: "string" },
    },
    required: ["projectId", "policyId"],
    additionalProperties: false,
  },
};

export const fallbackChainSetTool: McpToolSchema = {
  name: "fallback_chain.set",
  description: "Set primary and fallback models for a route in one call.",
  inputSchema: {
    type: "object",
    properties: {
      projectId: { type: "string" },
      routeId: { type: "string" },
      primaryModel: { type: "string" },
      fallbackModels: { type: "array", items: { type: "string" } },
    },
    required: ["projectId", "routeId", "primaryModel"],
    additionalProperties: false,
  },
};

export const integrationBootstrapNextjsTool: McpToolSchema = {
  name: "integration.bootstrap_nextjs",
  description: "Generate Next.js server resolver boilerplate and admin-only key wiring contract.",
  inputSchema: {
    type: "object",
    properties: {
      projectId: { type: "string", description: "Optional project ID used in examples." },
      includeAppRouter: { type: "boolean", description: "Include App Router examples. Default true." },
    },
    additionalProperties: false,
  },
};

export const byokSchemaGenerateTool: McpToolSchema = {
  name: "byok.schema.generate",
  description: "Generate DB schema templates for admin-global and future per-user BYOK models.",
  inputSchema: {
    type: "object",
    properties: {
      db: { type: "string", enum: ["postgres"], description: "Template target database." },
      includeUserScope: { type: "boolean", description: "Include per-user BYOK table template." },
    },
    additionalProperties: false,
  },
};

export const byokApiContractGenerateTool: McpToolSchema = {
  name: "byok.api_contract.generate",
  description: "Generate API endpoint contract templates for BYOK validate/add/remove/revalidate flows.",
  inputSchema: {
    type: "object",
    properties: {
      basePath: { type: "string", description: "Base API path. Default /api/admin/byok." },
      includeUserScope: { type: "boolean", description: "Include future per-user endpoint variants." },
    },
    additionalProperties: false,
  },
};

export const policySimulateTool: McpToolSchema = {
  name: "policy.simulate",
  description: "Simulate batch allow/deny decisions and fallback selection for policy scenarios.",
  inputSchema: {
    type: "object",
    properties: {
      cases: {
        type: "array",
        items: {
          type: "object",
          properties: {
            id: { type: "string" },
            userRole: { type: "string" },
            plan: { type: "string" },
            modelCandidates: { type: "array", items: { type: "string" } },
            expectedAllow: { type: "boolean" },
            expectedSelectedModel: { type: "string" },
          },
          required: ["id", "userRole", "plan", "modelCandidates", "expectedAllow"],
          additionalProperties: false,
        },
      },
      allowRoles: { type: "array", items: { type: "string" } },
      allowPlans: { type: "array", items: { type: "string" } },
      deniedModels: { type: "array", items: { type: "string" } },
    },
    required: ["cases"],
    additionalProperties: false,
  },
};

export const catalogSyncCheckTool: McpToolSchema = {
  name: "catalog.sync_check",
  description: "Check whether referenced models exist in the currently known Restormel model catalog.",
  inputSchema: {
    type: "object",
    properties: {
      referencedModels: { type: "array", items: { type: "string" } },
    },
    required: ["referencedModels"],
    additionalProperties: false,
  },
};

export const catalogDeprecationAlertsTool: McpToolSchema = {
  name: "catalog.deprecation_alerts",
  description: "Report deprecation/retirement alerts for referenced models.",
  inputSchema: {
    type: "object",
    properties: {
      models: { type: "array", items: { type: "string" } },
    },
    required: ["models"],
    additionalProperties: false,
  },
};

export const readinessCheckTool: McpToolSchema = {
  name: "readiness.check",
  description: "Run CI-friendly readiness checks with stable error codes and machine-readable output.",
  inputSchema: {
    type: "object",
    properties: {
      providers: { type: "array", items: { type: "string" } },
      referencedModels: { type: "array", items: { type: "string" } },
      strict: { type: "boolean", description: "When true, warnings are treated as failures." },
    },
    additionalProperties: false,
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
  routesListTool,
  routesCreateTool,
  routesUpdateTool,
  routesDeleteTool,
  policiesListTool,
  policiesCreateTool,
  policiesUpdateTool,
  policiesDeleteTool,
  fallbackChainSetTool,
  integrationBootstrapNextjsTool,
  byokSchemaGenerateTool,
  byokApiContractGenerateTool,
  policySimulateTool,
  catalogSyncCheckTool,
  catalogDeprecationAlertsTool,
  readinessCheckTool,
];
