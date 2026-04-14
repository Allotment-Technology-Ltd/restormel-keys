/**
 * MCP tool schema definitions for Restormel.
 * These define the tool surface — name, description, and JSON Schema for inputs/outputs.
 *
 * **Runtime:** The stdio MCP server (`restormel-mcp` / `pnpm exec restormel-mcp`) registers tools
 * with Zod schemas that mirror this file; keep shapes aligned when changing either layer.
 */
import {
  routesSimulateMcpOutputSchema,
  routingExportMcpOutputSchema,
  routingImportMcpOutputSchema,
  routingExplainChainMcpOutputSchema,
} from "./routing-mcp-output-schemas.js";

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
  description:
    "Create a route in the Restormel control plane (legacy primaryModel/fallbackModels shape; prefer routes.upsert_with_steps for dashboard-aligned ingestion routes with explicit steps).",
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

export const routesUpsertWithStepsTool: McpToolSchema = {
  name: "routes.upsert_with_steps",
  description:
    "Create a route with environment + optional ingestion workload/stage, then create ordered steps (provider+model per tier). Matches dashboard POST /routes and POST /routes/:id/steps. Does not execute LLM calls.",
  inputSchema: {
    type: "object",
    properties: {
      projectId: { type: "string" },
      environmentId: { type: "string" },
      name: { type: "string" },
      routeMode: { type: "string" },
      workload: { type: "string", description: "Optional; omit when not using ingestion workload." },
      stage: { type: "string", description: "Optional ingestion stage when workload is ingestion." },
      steps: {
        type: "array",
        minItems: 1,
        items: {
          type: "object",
          properties: {
            providerPreference: { type: "string" },
            modelId: { type: "string" },
            orderIndex: { type: "integer" },
            timeoutMs: { type: "integer" },
            fallbackOn: { type: "string" },
            label: { type: "string" },
          },
          required: ["providerPreference", "modelId"],
          additionalProperties: false,
        },
      },
    },
    required: ["projectId", "environmentId", "name", "steps"],
    additionalProperties: false,
  },
};

export const routesSimulateTool: McpToolSchema = {
  name: "routes.simulate",
  description:
    "Dry-run resolve for a single route (dashboard simulate API). Returns resolve-shaped payload and optional stepDiagnostics. Set includeRoutingAttempts for hypothetical tier outcomes (no LLM calls). Read-only for providers.",
  inputSchema: {
    type: "object",
    properties: {
      projectId: { type: "string" },
      routeId: { type: "string" },
      environmentId: { type: "string" },
      stage: { type: "string" },
      workload: { type: "string" },
      includeStepDiagnostics: { type: "boolean" },
      includeRoutingAttempts: { type: "boolean" },
    },
    required: ["projectId", "routeId", "environmentId"],
    additionalProperties: false,
  },
  outputSchema: routesSimulateMcpOutputSchema,
};

export const routingExportTool: McpToolSchema = {
  name: "routing.export",
  description:
    "GET portable route+steps bundle (JSON schema 1.0.0) for GitOps and agent diffs. Same data as dashboard GET .../routes/{routeId}/export. No secrets; read-only.",
  inputSchema: {
    type: "object",
    properties: {
      projectId: { type: "string" },
      routeId: { type: "string" },
    },
    required: ["projectId", "routeId"],
    additionalProperties: false,
  },
  outputSchema: routingExportMcpOutputSchema,
};

export const routingImportTool: McpToolSchema = {
  name: "routing.import",
  description:
    "POST apply a route+steps bundle (schema 1.0.0) on the control plane: create a route or replace an existing route (replaceRouteId) metadata + steps. Same as dashboard POST .../routes/import.",
  inputSchema: {
    type: "object",
    properties: {
      projectId: { type: "string" },
      bundle: { type: "object", additionalProperties: true, description: "Full route graph bundle (schemaVersion 1.0.0)." },
      replaceRouteId: { type: "string", description: "When set, update this route id instead of creating a new route." },
    },
    required: ["projectId", "bundle"],
    additionalProperties: false,
  },
  outputSchema: routingImportMcpOutputSchema,
};

export const routingExplainChainTool: McpToolSchema = {
  name: "routing.explain_chain",
  description:
    "GET agent-oriented route + ordered step summary + policy bindings at workspace/project/environment/route (read-only). Same as dashboard GET .../routes/{routeId}/explain-chain. Optional includePolicyRuleJson.",
  inputSchema: {
    type: "object",
    properties: {
      projectId: { type: "string" },
      routeId: { type: "string" },
      includePolicyRuleJson: { type: "boolean", description: "When true, include full ruleDefinition on each policy row." },
      includeCatalogHints: {
        type: "boolean",
        description: "When true, include catalogCrowdHints (aggregated observation counts per step model pair; read-only).",
      },
    },
    required: ["projectId", "routeId"],
    additionalProperties: false,
  },
  outputSchema: routingExplainChainMcpOutputSchema,
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

export const projectsListTool: McpToolSchema = {
  name: "projects.list",
  description:
    "List Restormel projects for the configured control-plane token (read-only). Use before routes/policies CRUD to pick projectId.",
  inputSchema: {
    type: "object",
    properties: {},
    additionalProperties: false,
  },
};

export const projectModelsListTool: McpToolSchema = {
  name: "project_models.list",
  description:
    "List model bindings (execution/registry) for a project via the control plane (read-only). Pair with projects.list.",
  inputSchema: {
    type: "object",
    properties: {
      projectId: { type: "string", description: "Restormel project UUID." },
    },
    required: ["projectId"],
    additionalProperties: false,
  },
};

export const testingJourneyTool: McpToolSchema = {
  name: "testing.journey",
  description:
    "Structured Keys + Restormel Testing onboarding: dashboard URLs, docs links, suggested MCP tools for the next step. No network calls.",
  inputSchema: {
    type: "object",
    properties: {
      focus: {
        type: "string",
        description:
          "Optional slice: all | testing_ci | keys_routing | guardrails | observability | developer | integrations | billing",
      },
    },
    additionalProperties: false,
  },
};

export const testingCiEnvTemplateTool: McpToolSchema = {
  name: "testing.ci_env_template",
  description:
    "Canonical RESTORMEL_* env snippet for Testing CLI/CI with placeholders only (no secret values).",
  inputSchema: {
    type: "object",
    properties: {
      keysBasePlaceholder: {
        type: "string",
        description: "Example RESTORMEL_KEYS_BASE origin (scheme + host, no path).",
      },
    },
    additionalProperties: false,
  },
};

export const testingResolveProbeTool: McpToolSchema = {
  name: "testing.resolve_probe",
  description:
    "Single POST to Keys /v1/testing/resolve-model; returns HTTP status only (body not echoed). Verifies RESTORMEL_KEYS_BASE + bearer.",
  inputSchema: {
    type: "object",
    properties: {
      logicalRef: {
        type: "string",
        description: "Optional logical ref (default ref:restormel-keys:llm/primary).",
      },
    },
    additionalProperties: false,
  },
};

export const projectEnvironmentsListTool: McpToolSchema = {
  name: "project.environments.list",
  description:
    "List environments (dev/prod slots) for a project via the control plane. Read-only; use ids for RESTORMEL_ENVIRONMENT_ID in CI.",
  inputSchema: {
    type: "object",
    properties: {
      projectId: { type: "string", description: "Restormel project UUID." },
    },
    required: ["projectId"],
    additionalProperties: false,
  },
};

export const testingHubSnapshotTool: McpToolSchema = {
  name: "testing.hub_snapshot",
  description:
    "Read-only bundle for Restormel Testing: picks the Testing project (or explicit projectId), lists environments and masked Gateway keys, suggests canonical RESTORMEL_* env lines (placeholders). Requires control-plane URL + token.",
  inputSchema: {
    type: "object",
    properties: {
      projectId: {
        type: "string",
        description: "Optional. When set, use this project; otherwise prefer isRestormelTesting from projects.list.",
      },
    },
    additionalProperties: false,
  },
};

export const projectGatewayKeysListTool: McpToolSchema = {
  name: "project.gateway_keys.list",
  description:
    "List Gateway keys for a project (masked prefixes only; no secret values). Control plane read.",
  inputSchema: {
    type: "object",
    properties: {
      projectId: { type: "string", description: "Restormel project UUID." },
    },
    required: ["projectId"],
    additionalProperties: false,
  },
};

export const projectGatewayKeysCreateTool: McpToolSchema = {
  name: "project.gateway_keys.create",
  description:
    "Create a new Gateway key (rk_…) for a project. Response includes rawKey ONCE — treat as a secret; never log it or commit it; store in a vault/CI secret immediately. Control-plane write.",
  inputSchema: {
    type: "object",
    properties: {
      projectId: { type: "string", description: "Restormel project UUID." },
    },
    required: ["projectId"],
    additionalProperties: false,
  },
};

export const projectGatewayKeysDeleteTool: McpToolSchema = {
  name: "project.gateway_keys.delete",
  description: "Revoke/delete a Gateway key by id for a project. Control-plane write.",
  inputSchema: {
    type: "object",
    properties: {
      projectId: { type: "string", description: "Restormel project UUID." },
      keyId: { type: "string", description: "Gateway key row id from project.gateway_keys.list." },
    },
    required: ["projectId", "keyId"],
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

export const docsCanonicalResolveTool: McpToolSchema = {
  name: "docs.canonical_resolve",
  description:
    "Resolve a canonical programme doc topic to repo path and optional public URL. Read-only; no network.",
  inputSchema: {
    type: "object",
    properties: {
      topic: { type: "string", description: "Canonical doc topic id (see @restormel/mcp CANONICAL_DOC_TOPICS)." },
    },
    required: ["topic"],
    additionalProperties: false,
  },
  outputSchema: {
    type: "object",
    properties: {
      ok: { type: "boolean" },
      code: { type: "string" },
      message: { type: "string" },
      topic: { type: "string" },
      title: { type: "string" },
      repoPath: { type: "string" },
      publicUrl: { type: "string" },
    },
  },
};

export const testingConfigValidateTool: McpToolSchema = {
  name: "testing.config_validate",
  description:
    "Validate restormel-testing YAML/JSON config offline. Input is string only—do not log secrets. Max ~512k chars.",
  inputSchema: {
    type: "object",
    properties: {
      content: { type: "string", description: "YAML or JSON document string." },
      format: { type: "string", enum: ["yaml", "json"] },
    },
    required: ["content", "format"],
    additionalProperties: false,
  },
  outputSchema: {
    type: "object",
    properties: {
      ok: { type: "boolean" },
      code: { type: "string" },
      message: { type: "string" },
      valid: { type: "boolean" },
      errors: {
        type: "array",
        items: {
          type: "object",
          properties: {
            path: { type: "string" },
            code: { type: "string" },
            message: { type: "string" },
          },
        },
      },
    },
  },
};

export const observabilityTraceSummarizeTool: McpToolSchema = {
  name: "observability.trace_summarize",
  description:
    "Parse RunTrace JSON, normalize via observability helpers, return summary and counts. Read-only; max ~2M chars.",
  inputSchema: {
    type: "object",
    properties: {
      traceJson: { type: "string", description: "JSON string matching RunTraceSchema." },
    },
    required: ["traceJson"],
    additionalProperties: false,
  },
  outputSchema: {
    type: "object",
    properties: {
      ok: { type: "boolean" },
      code: { type: "string" },
      message: { type: "string" },
      summary: { type: "string" },
      traceId: { type: "string" },
      eventCount: { type: "number" },
      spanCount: { type: "number" },
      errorEventCount: { type: "number" },
    },
  },
};

export const graphFixtureValidateTool: McpToolSchema = {
  name: "graph.fixture_validate",
  description:
    "Validate minimal GraphData JSON (Contract v0): nodes, edges, ghostNodes, ghostEdges arrays. Structural only.",
  inputSchema: {
    type: "object",
    properties: {
      graphJson: { type: "string", description: "JSON string of GraphData." },
    },
    required: ["graphJson"],
    additionalProperties: false,
  },
  outputSchema: {
    type: "object",
    properties: {
      ok: { type: "boolean" },
      code: { type: "string" },
      message: { type: "string" },
      nodeCount: { type: "number" },
      edgeCount: { type: "number" },
      ghostNodeCount: { type: "number" },
      ghostEdgeCount: { type: "number" },
    },
  },
};

export const stateMemoryPreviewTool: McpToolSchema = {
  name: "state.memory_preview",
  description:
    "Project Restormel State events into working memory; returns counts and cell metadata with text lengths only.",
  inputSchema: {
    type: "object",
    properties: {
      eventsJson: { type: "string", description: "JSON array of StateEvent objects." },
      maxCellsPerScope: { type: "integer", minimum: 1 },
      maxApproxTokensPerScope: { type: "integer", minimum: 1 },
    },
    required: ["eventsJson"],
    additionalProperties: false,
  },
  outputSchema: {
    type: "object",
    properties: {
      ok: { type: "boolean" },
      code: { type: "string" },
      message: { type: "string" },
      last_sequence: { type: "number" },
      applied_event_count: { type: "number" },
      scope_ids: { type: "array", items: { type: "string" } },
      scope_cell_counts: { type: "object", additionalProperties: { type: "number" } },
      cells_preview: {
        type: "array",
        items: {
          type: "object",
          properties: {
            scope: { type: "string" },
            id: { type: "string" },
            approx_tokens: { type: "number" },
            pinned: { type: "boolean" },
            textLength: { type: "number" },
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
  projectsListTool,
  projectModelsListTool,
  testingJourneyTool,
  testingCiEnvTemplateTool,
  testingResolveProbeTool,
  projectEnvironmentsListTool,
  testingHubSnapshotTool,
  projectGatewayKeysListTool,
  projectGatewayKeysCreateTool,
  projectGatewayKeysDeleteTool,
  routesListTool,
  routesCreateTool,
  routesUpdateTool,
  routesDeleteTool,
  routesUpsertWithStepsTool,
  routesSimulateTool,
  routingExportTool,
  routingImportTool,
  routingExplainChainTool,
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
  docsCanonicalResolveTool,
  testingConfigValidateTool,
  observabilityTraceSummarizeTool,
  graphFixtureValidateTool,
  stateMemoryPreviewTool,
];
