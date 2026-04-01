/**
 * Registers Restormel MCP tools on an McpServer instance.
 * Keep Zod field shapes aligned with {@link ./tools.js} JSON schemas.
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import {
  createKeys,
  defaultProviders,
  estimateCost,
  type KeysConfig,
  type ProviderDefinition,
} from "@restormel/keys";
import { searchDocs } from "./docs-index.js";
import { credentialEnvHint, resolveProviderCredential } from "./provider-env.js";
import { getMcpKeysConfig } from "./mcp-config.js";

function findProviderForModel(modelId: string, providers: ProviderDefinition[]): ProviderDefinition | undefined {
  return providers.find((p) => p.models.includes(modelId));
}

const modelsListInput = {
  provider: z.string().optional().describe("Filter by provider ID (e.g. openai, anthropic). Omit to list all."),
};

const modelsListOutput = {
  models: z.array(
    z.object({
      id: z.string(),
      provider: z.string(),
      displayName: z.string(),
    }),
  ),
};

const providersValidateInput = {
  provider: z.string().describe("Provider ID to validate (e.g. openai, anthropic)."),
};

const providersValidateOutput = {
  valid: z.boolean(),
  provider: z.string(),
  errors: z.array(z.string()),
};

const costEstimateInput = {
  model: z.string().describe("Model ID (e.g. gpt-4o, claude-3-5-sonnet)."),
  inputTokensM: z.number().optional().describe("Input tokens in millions. Default: 1."),
  outputTokensM: z.number().optional().describe("Output tokens in millions. Default: 1."),
};

const costEstimateOutput = {
  model: z.string(),
  provider: z.string(),
  inputCost: z.number(),
  outputCost: z.number(),
  totalCost: z.number(),
  unit: z.string(),
};

const routingExplainInput = {
  model: z.string().describe("Model ID to explain routing for."),
  projectId: z.string().optional().describe("Optional project context (informational only for static explain)."),
};

const routingExplainOutput = {
  model: z.string(),
  resolvedProvider: z.string(),
  reason: z.string(),
  steps: z.array(z.string()),
};

const entitlementsCheckInput = {
  feature: z
    .string()
    .describe(
      "Feature or model id to check. Interpreted as a model id for local plan rules; optional remote policy uses this as modelId.",
    ),
  userId: z.string().optional().describe("Reserved for future use; not sent to remote services."),
};

const entitlementsCheckOutput = {
  feature: z.string(),
  entitled: z.boolean(),
  plan: z.string(),
  reason: z.string(),
};

const integrationGenerateInput = {
  framework: z.string().describe("Framework (e.g. next, svelte, express)."),
  providers: z.array(z.string()).optional().describe("Provider IDs to include (e.g. openai, anthropic)."),
};

const integrationGenerateOutput = {
  config: z.string(),
  files: z.array(
    z.object({
      path: z.string(),
      content: z.string(),
    }),
  ),
};

const docsSearchInput = {
  query: z.string().describe("Search query or question."),
  section: z.string().optional().describe("Optional section filter (e.g. cli, mcp, walkthrough)."),
};

const docsSearchOutput = {
  results: z.array(
    z.object({
      title: z.string(),
      url: z.string(),
      excerpt: z.string(),
    }),
  ),
};

const routesListInput = {
  projectId: z.string().describe("Project ID in the Restormel control plane."),
};

const routeShape = z.object({
  id: z.string(),
  name: z.string(),
  primaryModel: z.string(),
  fallbackModels: z.array(z.string()),
  enabled: z.boolean(),
  updatedAt: z.string(),
});

const routesCrudOutput = {
  route: routeShape.optional(),
  routes: z.array(routeShape).optional(),
  status: z.string(),
  serverOnlyToken: z.boolean(),
};

const routesCreateInput = {
  projectId: z.string(),
  name: z.string(),
  primaryModel: z.string(),
  fallbackModels: z.array(z.string()).optional(),
  enabled: z.boolean().optional(),
};

const routesUpdateInput = {
  projectId: z.string(),
  routeId: z.string(),
  name: z.string().optional(),
  primaryModel: z.string().optional(),
  fallbackModels: z.array(z.string()).optional(),
  enabled: z.boolean().optional(),
};

const routesDeleteInput = {
  projectId: z.string(),
  routeId: z.string(),
};

const policyShape = z.object({
  id: z.string(),
  name: z.string(),
  effect: z.enum(["allow", "deny"]),
  roles: z.array(z.string()),
  plans: z.array(z.string()),
  models: z.array(z.string()),
  enabled: z.boolean(),
  updatedAt: z.string(),
});

const policiesCrudOutput = {
  policy: policyShape.optional(),
  policies: z.array(policyShape).optional(),
  status: z.string(),
  serverOnlyToken: z.boolean(),
};

const policiesListInput = {
  projectId: z.string(),
};

const policiesCreateInput = {
  projectId: z.string(),
  name: z.string(),
  effect: z.enum(["allow", "deny"]),
  roles: z.array(z.string()).optional(),
  plans: z.array(z.string()).optional(),
  models: z.array(z.string()).optional(),
  enabled: z.boolean().optional(),
};

const policiesUpdateInput = {
  projectId: z.string(),
  policyId: z.string(),
  name: z.string().optional(),
  effect: z.enum(["allow", "deny"]).optional(),
  roles: z.array(z.string()).optional(),
  plans: z.array(z.string()).optional(),
  models: z.array(z.string()).optional(),
  enabled: z.boolean().optional(),
};

const policiesDeleteInput = {
  projectId: z.string(),
  policyId: z.string(),
};

const fallbackChainSetInput = {
  projectId: z.string(),
  routeId: z.string(),
  primaryModel: z.string(),
  fallbackModels: z.array(z.string()).optional(),
};

const fallbackChainSetOutput = {
  route: routeShape,
  status: z.string(),
  serverOnlyToken: z.boolean(),
};

const integrationBootstrapNextjsInput = {
  projectId: z.string().optional(),
  includeAppRouter: z.boolean().optional(),
};

const integrationBootstrapNextjsOutput = {
  serverResolverBoilerplate: z.string(),
  adminKeyManagerContract: z.object({
    component: z.string(),
    notes: z.array(z.string()),
    requiredProps: z.array(z.object({ name: z.string(), type: z.string(), description: z.string() })),
  }),
  envChecklist: z.array(
    z.object({
      name: z.string(),
      required: z.boolean(),
      serverOnly: z.boolean(),
      purpose: z.string(),
    }),
  ),
};

const byokSchemaGenerateInput = {
  db: z.enum(["postgres"]).optional(),
  includeUserScope: z.boolean().optional(),
};

const byokSchemaGenerateOutput = {
  db: z.string(),
  templates: z.object({
    globalScopeSql: z.string(),
    userScopeSql: z.string().optional(),
  }),
  notes: z.array(z.string()),
};

const byokApiContractGenerateInput = {
  basePath: z.string().optional(),
  includeUserScope: z.boolean().optional(),
};

const byokApiContractGenerateOutput = {
  basePath: z.string(),
  contracts: z.array(
    z.object({
      name: z.string(),
      method: z.string(),
      path: z.string(),
      requestSchema: z.record(z.string(), z.unknown()),
      responseSchema: z.record(z.string(), z.unknown()),
      serverOnlyToken: z.boolean(),
    }),
  ),
};

const policySimulateInput = {
  cases: z.array(
    z.object({
      id: z.string(),
      userRole: z.string(),
      plan: z.string(),
      modelCandidates: z.array(z.string()),
      expectedAllow: z.boolean(),
      expectedSelectedModel: z.string().optional(),
    }),
  ),
  allowRoles: z.array(z.string()).optional(),
  allowPlans: z.array(z.string()).optional(),
  deniedModels: z.array(z.string()).optional(),
};

const policySimulateOutput = {
  summary: z.object({
    total: z.number(),
    passed: z.number(),
    failed: z.number(),
  }),
  results: z.array(
    z.object({
      id: z.string(),
      actualAllow: z.boolean(),
      selectedModel: z.string().optional(),
      passed: z.boolean(),
      reason: z.string(),
    }),
  ),
};

const catalogSyncCheckInput = {
  referencedModels: z.array(z.string()),
};

const catalogSyncCheckOutput = {
  ok: z.boolean(),
  knownModels: z.array(z.string()),
  unknownModels: z.array(z.string()),
};

const catalogDeprecationAlertsInput = {
  models: z.array(z.string()),
};

const catalogDeprecationAlertsOutput = {
  alerts: z.array(
    z.object({
      model: z.string(),
      severity: z.enum(["info", "warning", "critical"]),
      message: z.string(),
      replacement: z.string().optional(),
    }),
  ),
};

const readinessCheckInput = {
  providers: z.array(z.string()).optional(),
  referencedModels: z.array(z.string()).optional(),
  strict: z.boolean().optional(),
};

const readinessCheckOutput = {
  status: z.enum(["pass", "warn", "fail"]),
  exitCode: z.number(),
  errorCodes: z.array(z.string()),
  errors: z.array(z.object({ code: z.string(), message: z.string() })),
  warnings: z.array(z.object({ code: z.string(), message: z.string() })),
  checks: z.array(z.object({ name: z.string(), status: z.enum(["pass", "warn", "fail"]), detail: z.string() })),
};

type EntitlementToolResult = {
  feature: string;
  entitled: boolean;
  plan: string;
  reason: string;
};

type RouteRecord = {
  id: string;
  name: string;
  primaryModel: string;
  fallbackModels: string[];
  enabled: boolean;
  updatedAt: string;
};

type PolicyRecord = {
  id: string;
  name: string;
  effect: "allow" | "deny";
  roles: string[];
  plans: string[];
  models: string[];
  enabled: boolean;
  updatedAt: string;
};

const SERVER_ONLY_MARKER = true;
const DEPRECATED_MODELS: Record<string, { severity: "info" | "warning" | "critical"; replacement?: string; message: string }> =
  {
    "gpt-3.5-turbo": {
      severity: "warning",
      replacement: "gpt-4o-mini",
      message: "Model is considered legacy for new workloads.",
    },
    "claude-2": {
      severity: "critical",
      replacement: "claude-3-5-sonnet",
      message: "Model is retired in many regions and should be removed from fallback chains.",
    },
  };

async function remotePolicyEvaluate(feature: string): Promise<EntitlementToolResult | null> {
  const url = process.env.RESTORMEL_EVALUATE_URL?.trim();
  const key = process.env.RESTORMEL_GATEWAY_KEY?.trim();
  if (!url || !key) return null;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        modelId: feature,
      }),
    });

    if (!res.ok) {
      return {
        feature,
        entitled: false,
        plan: "remote",
        reason: `Policy endpoint returned HTTP ${res.status}.`,
      };
    }

    const body = (await res.json()) as { data?: { allowed?: boolean } };
    const allowed = body.data?.allowed === true;
    return {
      feature,
      entitled: allowed,
      plan: "remote",
      reason: allowed
        ? "Remote policy evaluation reported no violations for this context."
        : "Remote policy evaluation reported violations for this context.",
    };
  } catch {
    return {
      feature,
      entitled: false,
      plan: "remote",
      reason: "Remote policy request failed (network or response parse).",
    };
  }
}

function buildIntegrationFiles(framework: string, providerIds: string[]): { path: string; content: string }[] {
  const fw = framework.toLowerCase().trim();
  const providers = providerIds.length ? providerIds : ["openai"];
  const providersJson = JSON.stringify(providers);

  const restormelConfig = `{
  "keys": [],
  "routing": {
    "defaultProvider": "${providers[0] ?? "openai"}",
    "fallbackOrder": ${providersJson}
  },
  "plans": []
}
`;

  const envExample = `# Provider keys (never commit real values)
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
GOOGLE_API_KEY=
`;

  const readme = `## Restormel Keys (${fw})

1. Copy env: \`cp .env.example .env\` and add your keys.
2. Ensure \`restormel.config.json\` matches your providers.
3. Use \`@restormel/keys\` in your server code for resolve/estimate.

Docs: /keys/docs/integrations
`;

  const files: { path: string; content: string }[] = [
    { path: "restormel.config.json", content: restormelConfig },
    { path: ".env.example", content: envExample },
    { path: "RESTORMEL_INTEGRATION.md", content: readme },
  ];

  if (fw === "next" || fw === "nextjs") {
    files.push({
      path: "lib/restormel.ts",
      content: `// Example: createKeys + providers in Next.js server routes
import { createKeys, defaultProviders } from "@restormel/keys";
import type { KeysConfig } from "@restormel/keys";

const config = {} as KeysConfig; // load from restormel.config.json
export const keys = createKeys(config, { providers: defaultProviders });
`,
    });
  }

  if (fw === "svelte" || fw === "sveltekit") {
    files.push({
      path: "src/lib/server/restormel.ts",
      content: `import { createKeys, defaultProviders } from "@restormel/keys";
import type { KeysConfig } from "@restormel/keys";

const config = {} as KeysConfig;
export const keys = createKeys(config, { providers: defaultProviders });
`,
    });
  }

  if (fw === "express" || fw === "node") {
    files.push({
      path: "src/restormel.ts",
      content: `import { createKeys, defaultProviders } from "@restormel/keys";
import type { KeysConfig } from "@restormel/keys";

const config = {} as KeysConfig;
export const keys = createKeys(config, { providers: defaultProviders });
`,
    });
  }

  return files;
}

function getControlPlaneConfig(): { baseUrl: string; token: string } {
  const baseUrl = process.env.RESTORMEL_CONTROL_PLANE_URL?.trim();
  const token = process.env.RESTORMEL_SERVER_TOKEN?.trim() || process.env.RESTORMEL_GATEWAY_KEY?.trim();
  if (!baseUrl || !token) {
    throw new Error(
      "Control-plane tools require RESTORMEL_CONTROL_PLANE_URL and RESTORMEL_SERVER_TOKEN (or RESTORMEL_GATEWAY_KEY) in the MCP server environment.",
    );
  }
  return { baseUrl: baseUrl.replace(/\/+$/, ""), token };
}

async function controlPlaneRequest<T>(method: string, path: string, body?: Record<string, unknown>): Promise<T> {
  const { baseUrl, token } = getControlPlaneConfig();
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    throw new Error(`Control-plane request failed (${method} ${path}): HTTP ${res.status}.`);
  }
  const data = (await res.json()) as T;
  return data;
}

function nowIso(): string {
  return new Date().toISOString();
}

function asRouteRecord(value: unknown): RouteRecord {
  const obj = (value ?? {}) as Record<string, unknown>;
  return {
    id: String(obj.id ?? ""),
    name: String(obj.name ?? ""),
    primaryModel: String(obj.primaryModel ?? ""),
    fallbackModels: Array.isArray(obj.fallbackModels) ? obj.fallbackModels.map((m) => String(m)) : [],
    enabled: Boolean(obj.enabled ?? true),
    updatedAt: typeof obj.updatedAt === "string" ? obj.updatedAt : nowIso(),
  };
}

function asPolicyRecord(value: unknown): PolicyRecord {
  const obj = (value ?? {}) as Record<string, unknown>;
  const effect = obj.effect === "deny" ? "deny" : "allow";
  return {
    id: String(obj.id ?? ""),
    name: String(obj.name ?? ""),
    effect,
    roles: Array.isArray(obj.roles) ? obj.roles.map((v) => String(v)) : [],
    plans: Array.isArray(obj.plans) ? obj.plans.map((v) => String(v)) : [],
    models: Array.isArray(obj.models) ? obj.models.map((v) => String(v)) : [],
    enabled: Boolean(obj.enabled ?? true),
    updatedAt: typeof obj.updatedAt === "string" ? obj.updatedAt : nowIso(),
  };
}

function catalogModelsSet(): Set<string> {
  const ids: string[] = [];
  for (const provider of defaultProviders) {
    ids.push(...provider.models);
  }
  return new Set(ids);
}

export function registerRestormelTools(server: McpServer): void {
  server.registerTool(
    "models.list",
    {
      description: "List available models across all configured providers.",
      inputSchema: modelsListInput,
      outputSchema: modelsListOutput,
    },
    async (args: { provider?: string }) => {
      const providerFilter = args.provider?.toLowerCase().trim();
      const list: { id: string; provider: string; displayName: string }[] = [];

      for (const p of defaultProviders) {
        if (providerFilter && p.id !== providerFilter) continue;
        for (const id of p.models) {
          list.push({
            id,
            provider: p.id,
            displayName: id,
          });
        }
      }

      const structuredContent = { models: list };
      return {
        content: [{ type: "text" as const, text: JSON.stringify(structuredContent, null, 2) }],
        structuredContent,
      };
    },
  );

  server.registerTool(
    "providers.validate",
    {
      description: "Validate provider configuration and access credentials via a read-only provider check.",
      inputSchema: providersValidateInput,
      outputSchema: providersValidateOutput,
    },
    async (args: { provider: string }) => {
      const providerId = args.provider.toLowerCase().trim();
      const provider = defaultProviders.find((p) => p.id === providerId);

      if (!provider) {
        const structuredContent = {
          valid: false,
          provider: providerId,
          errors: [`Unknown provider "${providerId}". Use one of: ${defaultProviders.map((p) => p.id).join(", ")}.`],
        };
        return {
          content: [{ type: "text" as const, text: JSON.stringify(structuredContent, null, 2) }],
          structuredContent,
        };
      }

      const credential = resolveProviderCredential(providerId);
      if (!credential) {
        const structuredContent = {
          valid: false,
          provider: providerId,
          errors: [`No API key found. ${credentialEnvHint(providerId)}`],
        };
        return {
          content: [{ type: "text" as const, text: JSON.stringify(structuredContent, null, 2) }],
          structuredContent,
        };
      }

      const result = await provider.validateKey(credential);
      const structuredContent = {
        valid: result.valid,
        provider: providerId,
        errors: result.errors ?? (result.valid ? [] : ["Validation failed."]),
      };
      return {
        content: [{ type: "text" as const, text: JSON.stringify(structuredContent, null, 2) }],
        structuredContent,
      };
    },
  );

  server.registerTool(
    "cost.estimate",
    {
      description: "Estimate cost for a model given an expected token volume (per-million pricing).",
      inputSchema: costEstimateInput,
      outputSchema: costEstimateOutput,
    },
    async (args: { model: string; inputTokensM?: number; outputTokensM?: number }) => {
      const inputM = args.inputTokensM ?? 1;
      const outputM = args.outputTokensM ?? 1;
      if (Number.isNaN(inputM) || Number.isNaN(outputM) || inputM < 0 || outputM < 0) {
        throw new Error("inputTokensM and outputTokensM must be non-negative numbers.");
      }

      const result = estimateCost(args.model, defaultProviders);
      if (!result) {
        throw new Error(`Unknown model: ${args.model}`);
      }

      const inputCost = (result.inputPerMillion ?? 0) * inputM;
      const outputCost = (result.outputPerMillion ?? 0) * outputM;
      const unit = result.unit ?? "USD";

      const structuredContent = {
        model: result.modelId,
        provider: result.providerId ?? "",
        inputCost,
        outputCost,
        totalCost: inputCost + outputCost,
        unit,
      };

      return {
        content: [{ type: "text" as const, text: JSON.stringify(structuredContent, null, 2) }],
        structuredContent,
      };
    },
  );

  server.registerTool(
    "routing.explain",
    {
      description: "Explain static routing for a model against built-in default providers (BYOK/policy routing needs a configured project).",
      inputSchema: routingExplainInput,
      outputSchema: routingExplainOutput,
    },
    async (args: { model: string; projectId?: string }) => {
      void args.projectId;
      const model = args.model;
      const provider = findProviderForModel(model, defaultProviders);

      if (!provider) {
        const structuredContent = {
          model,
          resolvedProvider: "",
          reason: "Model not found in default provider catalog.",
          steps: [
            "Search default providers for model id.",
            `No match. Available providers: ${defaultProviders.map((p) => p.id).join(", ")}.`,
          ],
        };
        return {
          content: [{ type: "text" as const, text: JSON.stringify(structuredContent, null, 2) }],
          structuredContent,
        };
      }

      const cost = provider.estimateCost(model);
      const steps: string[] = ["Search default providers for model id.", `Match: ${provider.name} (${provider.id}).`];
      if (cost) {
        steps.push(
          `Pricing (per 1M tokens): input $${cost.inputPerMillion?.toFixed(4) ?? "?"}, output $${cost.outputPerMillion?.toFixed(4) ?? "?"}.`,
        );
      }
      steps.push(`Resolution: route to ${provider.id}/${model}.`);
      steps.push("Note: policy-based routing requires a configured Restormel project with routes and policies.");

      const structuredContent = {
        model,
        resolvedProvider: provider.id,
        reason: `Model is provided by ${provider.name}.`,
        steps,
      };

      return {
        content: [{ type: "text" as const, text: JSON.stringify(structuredContent, null, 2) }],
        structuredContent,
      };
    },
  );

  server.registerTool(
    "entitlements.check",
    {
      description:
        "Check entitlements: uses RESTORMEL_EVALUATE_URL + RESTORMEL_GATEWAY_KEY when set; otherwise local rules from RESTORMEL_MCP_CONFIG or a permissive default.",
      inputSchema: entitlementsCheckInput,
      outputSchema: entitlementsCheckOutput,
    },
    async (args: { feature: string; userId?: string }) => {
      void args.userId;
      const feature = args.feature;

      const remote = await remotePolicyEvaluate(feature);
      if (remote) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify(remote, null, 2) }],
          structuredContent: remote,
        };
      }

      const config: KeysConfig = getMcpKeysConfig();
      const keys = createKeys(config, { providers: defaultProviders });
      const r = keys.entitlements.check(feature);
      const planId = (config.plans?.[0] as { id?: string } | undefined)?.id ?? "mcp-local";

      const structuredContent = {
        feature,
        entitled: r.allowed,
        plan: String(planId),
        reason: r.allowed
          ? "Allowed by local MCP entitlement rules (model pattern match)."
          : "Denied by local MCP entitlement rules.",
      };

      return {
        content: [{ type: "text" as const, text: JSON.stringify(structuredContent, null, 2) }],
        structuredContent,
      };
    },
  );

  server.registerTool(
    "integration.generate",
    {
      description: "Generate starter Restormel integration files (config, env template, optional framework stub).",
      inputSchema: integrationGenerateInput,
      outputSchema: integrationGenerateOutput,
    },
    async (args: { framework: string; providers?: string[] }) => {
      const files = buildIntegrationFiles(args.framework, args.providers ?? []);
      const structuredContent = {
        config: files.find((f) => f.path === "restormel.config.json")?.content ?? "",
        files,
      };
      return {
        content: [{ type: "text" as const, text: JSON.stringify(structuredContent, null, 2) }],
        structuredContent,
      };
    },
  );

  server.registerTool(
    "routes.list",
    {
      description: "List configured project routes from the Restormel control plane (server token required).",
      inputSchema: routesListInput,
      outputSchema: routesCrudOutput,
    },
    async (args: { projectId: string }) => {
      const payload = await controlPlaneRequest<{ routes?: unknown[] }>("GET", `/api/projects/${args.projectId}/routes`);
      const routes = Array.isArray(payload.routes) ? payload.routes.map(asRouteRecord) : [];
      const structuredContent = { routes, status: "ok", serverOnlyToken: SERVER_ONLY_MARKER };
      return {
        content: [{ type: "text" as const, text: JSON.stringify(structuredContent, null, 2) }],
        structuredContent,
      };
    },
  );

  server.registerTool(
    "routes.create",
    {
      description: "Create a route in the Restormel control plane (server token required).",
      inputSchema: routesCreateInput,
      outputSchema: routesCrudOutput,
    },
    async (args: { projectId: string; name: string; primaryModel: string; fallbackModels?: string[]; enabled?: boolean }) => {
      const payload = await controlPlaneRequest<{ route?: unknown }>("POST", `/api/projects/${args.projectId}/routes`, {
        name: args.name,
        primaryModel: args.primaryModel,
        fallbackModels: args.fallbackModels ?? [],
        enabled: args.enabled ?? true,
      });
      const route = asRouteRecord(payload.route);
      const structuredContent = { route, status: "created", serverOnlyToken: SERVER_ONLY_MARKER };
      return {
        content: [{ type: "text" as const, text: JSON.stringify(structuredContent, null, 2) }],
        structuredContent,
      };
    },
  );

  server.registerTool(
    "routes.update",
    {
      description: "Update a route in the Restormel control plane (server token required).",
      inputSchema: routesUpdateInput,
      outputSchema: routesCrudOutput,
    },
    async (args: {
      projectId: string;
      routeId: string;
      name?: string;
      primaryModel?: string;
      fallbackModels?: string[];
      enabled?: boolean;
    }) => {
      const payload = await controlPlaneRequest<{ route?: unknown }>(
        "PATCH",
        `/api/projects/${args.projectId}/routes/${args.routeId}`,
        {
          name: args.name,
          primaryModel: args.primaryModel,
          fallbackModels: args.fallbackModels,
          enabled: args.enabled,
        },
      );
      const route = asRouteRecord(payload.route);
      const structuredContent = { route, status: "updated", serverOnlyToken: SERVER_ONLY_MARKER };
      return {
        content: [{ type: "text" as const, text: JSON.stringify(structuredContent, null, 2) }],
        structuredContent,
      };
    },
  );

  server.registerTool(
    "routes.delete",
    {
      description: "Delete a route in the Restormel control plane (server token required).",
      inputSchema: routesDeleteInput,
      outputSchema: routesCrudOutput,
    },
    async (args: { projectId: string; routeId: string }) => {
      await controlPlaneRequest<Record<string, unknown>>("DELETE", `/api/projects/${args.projectId}/routes/${args.routeId}`);
      const structuredContent = { status: "deleted", serverOnlyToken: SERVER_ONLY_MARKER };
      return {
        content: [{ type: "text" as const, text: JSON.stringify(structuredContent, null, 2) }],
        structuredContent,
      };
    },
  );

  server.registerTool(
    "policies.list",
    {
      description: "List configured project policies from the Restormel control plane (server token required).",
      inputSchema: policiesListInput,
      outputSchema: policiesCrudOutput,
    },
    async (args: { projectId: string }) => {
      const payload = await controlPlaneRequest<{ policies?: unknown[] }>("GET", `/api/projects/${args.projectId}/policies`);
      const policies = Array.isArray(payload.policies) ? payload.policies.map(asPolicyRecord) : [];
      const structuredContent = { policies, status: "ok", serverOnlyToken: SERVER_ONLY_MARKER };
      return {
        content: [{ type: "text" as const, text: JSON.stringify(structuredContent, null, 2) }],
        structuredContent,
      };
    },
  );

  server.registerTool(
    "policies.create",
    {
      description: "Create a policy in the Restormel control plane (server token required).",
      inputSchema: policiesCreateInput,
      outputSchema: policiesCrudOutput,
    },
    async (args: {
      projectId: string;
      name: string;
      effect: "allow" | "deny";
      roles?: string[];
      plans?: string[];
      models?: string[];
      enabled?: boolean;
    }) => {
      const payload = await controlPlaneRequest<{ policy?: unknown }>("POST", `/api/projects/${args.projectId}/policies`, {
        name: args.name,
        effect: args.effect,
        roles: args.roles ?? [],
        plans: args.plans ?? [],
        models: args.models ?? [],
        enabled: args.enabled ?? true,
      });
      const policy = asPolicyRecord(payload.policy);
      const structuredContent = { policy, status: "created", serverOnlyToken: SERVER_ONLY_MARKER };
      return {
        content: [{ type: "text" as const, text: JSON.stringify(structuredContent, null, 2) }],
        structuredContent,
      };
    },
  );

  server.registerTool(
    "policies.update",
    {
      description: "Update a policy in the Restormel control plane (server token required).",
      inputSchema: policiesUpdateInput,
      outputSchema: policiesCrudOutput,
    },
    async (args: {
      projectId: string;
      policyId: string;
      name?: string;
      effect?: "allow" | "deny";
      roles?: string[];
      plans?: string[];
      models?: string[];
      enabled?: boolean;
    }) => {
      const payload = await controlPlaneRequest<{ policy?: unknown }>(
        "PATCH",
        `/api/projects/${args.projectId}/policies/${args.policyId}`,
        {
          name: args.name,
          effect: args.effect,
          roles: args.roles,
          plans: args.plans,
          models: args.models,
          enabled: args.enabled,
        },
      );
      const policy = asPolicyRecord(payload.policy);
      const structuredContent = { policy, status: "updated", serverOnlyToken: SERVER_ONLY_MARKER };
      return {
        content: [{ type: "text" as const, text: JSON.stringify(structuredContent, null, 2) }],
        structuredContent,
      };
    },
  );

  server.registerTool(
    "policies.delete",
    {
      description: "Delete a policy in the Restormel control plane (server token required).",
      inputSchema: policiesDeleteInput,
      outputSchema: policiesCrudOutput,
    },
    async (args: { projectId: string; policyId: string }) => {
      await controlPlaneRequest<Record<string, unknown>>(
        "DELETE",
        `/api/projects/${args.projectId}/policies/${args.policyId}`,
      );
      const structuredContent = { status: "deleted", serverOnlyToken: SERVER_ONLY_MARKER };
      return {
        content: [{ type: "text" as const, text: JSON.stringify(structuredContent, null, 2) }],
        structuredContent,
      };
    },
  );

  server.registerTool(
    "fallback_chain.set",
    {
      description: "Set route primary + fallback model chain in one control-plane call (server token required).",
      inputSchema: fallbackChainSetInput,
      outputSchema: fallbackChainSetOutput,
    },
    async (args: { projectId: string; routeId: string; primaryModel: string; fallbackModels?: string[] }) => {
      const payload = await controlPlaneRequest<{ route?: unknown }>(
        "PATCH",
        `/api/projects/${args.projectId}/routes/${args.routeId}/fallback-chain`,
        {
          primaryModel: args.primaryModel,
          fallbackModels: args.fallbackModels ?? [],
        },
      );
      const route = asRouteRecord(payload.route);
      const structuredContent = { route, status: "updated", serverOnlyToken: SERVER_ONLY_MARKER };
      return {
        content: [{ type: "text" as const, text: JSON.stringify(structuredContent, null, 2) }],
        structuredContent,
      };
    },
  );

  server.registerTool(
    "integration.bootstrap_nextjs",
    {
      description: "Generate Next.js bootstrap outputs for server resolver and admin-only KeyManager contract.",
      inputSchema: integrationBootstrapNextjsInput,
      outputSchema: integrationBootstrapNextjsOutput,
    },
    async (args: { projectId?: string; includeAppRouter?: boolean }) => {
      const projectId = args.projectId?.trim() || "YOUR_PROJECT_ID";
      const includeAppRouter = args.includeAppRouter ?? true;
      const serverResolverBoilerplate = `import { createRestormelClient } from "@restormel/keys/dashboard/client";

const restormel = createRestormelClient({
  baseUrl: process.env.RESTORMEL_DASHBOARD_BASE_URL!,
  gatewayKey: process.env.RESTORMEL_GATEWAY_KEY!, // server-only token
});

export async function resolveModelForAdmin(requestedModel: string) {
  return restormel.resolve({
    projectId: "${projectId}",
    modelId: requestedModel,
    context: { actor: "admin" },
  });
}

${includeAppRouter ? "// Use this only in server actions / route handlers. Never import into client bundles." : ""}`;

      const structuredContent = {
        serverResolverBoilerplate,
        adminKeyManagerContract: {
          component: "KeyManager",
          notes: [
            "Render KeyManager only for authenticated admin users.",
            "All key lifecycle calls must go through server routes with server-only credentials.",
            "Never return raw key values; use masked metadata and fingerprints only.",
          ],
          requiredProps: [
            { name: "projectId", type: "string", description: "Control-plane project identifier." },
            { name: "isAdmin", type: "boolean", description: "Gate UI and actions to admin-only context." },
            {
              name: "onAddKey",
              type: "(payload) => Promise<{ ok: boolean; fingerprint?: string }>",
              description: "Server action for key add/validate.",
            },
            {
              name: "onRemoveKey",
              type: "(keyId: string) => Promise<{ ok: boolean }>",
              description: "Server action for key removal.",
            },
          ],
        },
        envChecklist: [
          {
            name: "RESTORMEL_DASHBOARD_BASE_URL",
            required: true,
            serverOnly: true,
            purpose: "Base URL for server-side control-plane API calls.",
          },
          {
            name: "RESTORMEL_GATEWAY_KEY",
            required: true,
            serverOnly: true,
            purpose: "Server-only token for admin operations and resolver calls.",
          },
          {
            name: "NEXT_PUBLIC_RESTORMEL_PROJECT_ID",
            required: false,
            serverOnly: false,
            purpose: "Optional project id for read-only UI metadata.",
          },
        ],
      };
      return {
        content: [{ type: "text" as const, text: JSON.stringify(structuredContent, null, 2) }],
        structuredContent,
      };
    },
  );

  server.registerTool(
    "byok.schema.generate",
    {
      description: "Generate BYOK schema templates (masked metadata and fingerprints only).",
      inputSchema: byokSchemaGenerateInput,
      outputSchema: byokSchemaGenerateOutput,
    },
    async (args: { db?: "postgres"; includeUserScope?: boolean }) => {
      const db = args.db ?? "postgres";
      const globalScopeSql = `create table if not exists byok_keys_global (
  id uuid primary key default gen_random_uuid(),
  project_id text not null,
  provider text not null,
  key_masked text not null,
  key_fingerprint text not null,
  key_hash_sha256 text not null,
  is_active boolean not null default true,
  created_by text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(project_id, provider, key_fingerprint)
);`;
      const userScopeSql = `create table if not exists byok_keys_user (
  id uuid primary key default gen_random_uuid(),
  project_id text not null,
  user_id text not null,
  provider text not null,
  key_masked text not null,
  key_fingerprint text not null,
  key_hash_sha256 text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(project_id, user_id, provider, key_fingerprint)
);`;
      const templates = args.includeUserScope ? { globalScopeSql, userScopeSql } : { globalScopeSql };
      const structuredContent = {
        db,
        templates,
        notes: [
          "Store only masked metadata + fingerprint/hash fields; never persist raw key values.",
          "Keep global scope admin-only during initial rollout.",
          "Enable user scope behind explicit authz and migration gating.",
        ],
      };
      return {
        content: [{ type: "text" as const, text: JSON.stringify(structuredContent, null, 2) }],
        structuredContent,
      };
    },
  );

  server.registerTool(
    "byok.api_contract.generate",
    {
      description: "Generate BYOK API contracts (validate/add/remove/revalidate).",
      inputSchema: byokApiContractGenerateInput,
      outputSchema: byokApiContractGenerateOutput,
    },
    async (args: { basePath?: string; includeUserScope?: boolean }) => {
      const basePath = args.basePath?.trim() || "/api/admin/byok";
      const contracts: {
        name: string;
        method: string;
        path: string;
        requestSchema: Record<string, string>;
        responseSchema: Record<string, string>;
        serverOnlyToken: boolean;
      }[] = [
        {
          name: "validate",
          method: "POST",
          path: `${basePath}/validate`,
          requestSchema: { provider: "string", key: "string" },
          responseSchema: { ok: "boolean", keyMasked: "string", fingerprint: "string" },
          serverOnlyToken: SERVER_ONLY_MARKER,
        },
        {
          name: "add",
          method: "POST",
          path: `${basePath}/add`,
          requestSchema: { provider: "string", key: "string", scope: "global" },
          responseSchema: { ok: "boolean", keyId: "string", fingerprint: "string" },
          serverOnlyToken: SERVER_ONLY_MARKER,
        },
        {
          name: "remove",
          method: "POST",
          path: `${basePath}/remove`,
          requestSchema: { keyId: "string" },
          responseSchema: { ok: "boolean" },
          serverOnlyToken: SERVER_ONLY_MARKER,
        },
        {
          name: "revalidate",
          method: "POST",
          path: `${basePath}/revalidate`,
          requestSchema: { keyId: "string" },
          responseSchema: { ok: "boolean", fingerprint: "string" },
          serverOnlyToken: SERVER_ONLY_MARKER,
        },
      ];
      if (args.includeUserScope) {
        contracts.push({
          name: "add-user-scope",
          method: "POST",
          path: `${basePath}/add-user`,
          requestSchema: { provider: "string", key: "string", userId: "string", scope: "user" },
          responseSchema: { ok: "boolean", keyId: "string", fingerprint: "string" },
          serverOnlyToken: SERVER_ONLY_MARKER,
        });
      }

      const structuredContent = { basePath, contracts };
      return {
        content: [{ type: "text" as const, text: JSON.stringify(structuredContent, null, 2) }],
        structuredContent,
      };
    },
  );

  server.registerTool(
    "policy.simulate",
    {
      description: "Simulate policy decisions with batch scenarios and expected outcomes.",
      inputSchema: policySimulateInput,
      outputSchema: policySimulateOutput,
    },
    async (args: {
      cases: {
        id: string;
        userRole: string;
        plan: string;
        modelCandidates: string[];
        expectedAllow: boolean;
        expectedSelectedModel?: string;
      }[];
      allowRoles?: string[];
      allowPlans?: string[];
      deniedModels?: string[];
    }) => {
      const allowRoles = new Set(args.allowRoles ?? []);
      const allowPlans = new Set(args.allowPlans ?? []);
      const denied = new Set(args.deniedModels ?? []);

      const results = args.cases.map((testCase) => {
        const roleAllowed = allowRoles.size === 0 || allowRoles.has(testCase.userRole);
        const planAllowed = allowPlans.size === 0 || allowPlans.has(testCase.plan);
        const selectedModel = testCase.modelCandidates.find((m) => !denied.has(m));
        const actualAllow = roleAllowed && planAllowed && Boolean(selectedModel);

        const passed =
          actualAllow === testCase.expectedAllow &&
          (testCase.expectedSelectedModel ? testCase.expectedSelectedModel === selectedModel : true);

        const reason = actualAllow
          ? `Allowed (${testCase.userRole}/${testCase.plan}) using ${selectedModel}.`
          : `Denied (${testCase.userRole}/${testCase.plan}) by role/plan/model constraints.`;

        return {
          id: testCase.id,
          actualAllow,
          selectedModel,
          passed,
          reason,
        };
      });

      const passed = results.filter((r) => r.passed).length;
      const structuredContent = {
        summary: {
          total: results.length,
          passed,
          failed: results.length - passed,
        },
        results,
      };
      return {
        content: [{ type: "text" as const, text: JSON.stringify(structuredContent, null, 2) }],
        structuredContent,
      };
    },
  );

  server.registerTool(
    "catalog.sync_check",
    {
      description: "Validate that referenced models exist in the current Restormel model catalog.",
      inputSchema: catalogSyncCheckInput,
      outputSchema: catalogSyncCheckOutput,
    },
    async (args: { referencedModels: string[] }) => {
      const known = catalogModelsSet();
      const unknownModels = args.referencedModels.filter((m) => !known.has(m));
      const structuredContent = {
        ok: unknownModels.length === 0,
        knownModels: args.referencedModels.filter((m) => known.has(m)),
        unknownModels,
      };
      return {
        content: [{ type: "text" as const, text: JSON.stringify(structuredContent, null, 2) }],
        structuredContent,
      };
    },
  );

  server.registerTool(
    "catalog.deprecation_alerts",
    {
      description: "Alert on referenced models that are deprecated or retired.",
      inputSchema: catalogDeprecationAlertsInput,
      outputSchema: catalogDeprecationAlertsOutput,
    },
    async (args: { models: string[] }) => {
      const alerts = args.models
        .filter((m) => Boolean(DEPRECATED_MODELS[m]))
        .map((model) => ({
          model,
          severity: DEPRECATED_MODELS[model].severity,
          message: DEPRECATED_MODELS[model].message,
          replacement: DEPRECATED_MODELS[model].replacement,
        }));
      const structuredContent = { alerts };
      return {
        content: [{ type: "text" as const, text: JSON.stringify(structuredContent, null, 2) }],
        structuredContent,
      };
    },
  );

  server.registerTool(
    "readiness.check",
    {
      description: "Run machine-readable pre-deploy checks (providers, models, deprecations) with stable error codes.",
      inputSchema: readinessCheckInput,
      outputSchema: readinessCheckOutput,
    },
    async (args: { providers?: string[]; referencedModels?: string[]; strict?: boolean }) => {
      const providerIds = (args.providers ?? []).map((p) => p.toLowerCase().trim()).filter(Boolean);
      const referencedModels = args.referencedModels ?? [];
      const strict = args.strict ?? false;

      const checks: { name: string; status: "pass" | "warn" | "fail"; detail: string }[] = [];
      const errors: { code: string; message: string }[] = [];
      const warnings: { code: string; message: string }[] = [];

      for (const providerId of providerIds) {
        const provider = defaultProviders.find((p) => p.id === providerId);
        if (!provider) {
          errors.push({ code: "RST_PROV_UNKNOWN", message: `Unknown provider: ${providerId}` });
          checks.push({ name: `provider:${providerId}`, status: "fail", detail: "Provider not found in local catalog." });
          continue;
        }

        const credential = resolveProviderCredential(providerId);
        if (!credential) {
          errors.push({
            code: "RST_PROV_CREDENTIAL_MISSING",
            message: `Missing credential for ${providerId}. ${credentialEnvHint(providerId)}`,
          });
          checks.push({ name: `provider:${providerId}`, status: "fail", detail: "Credential not found in MCP environment." });
          continue;
        }

        const validation = await provider.validateKey(credential);
        if (!validation.valid) {
          errors.push({ code: "RST_PROV_INVALID", message: `Credential rejected by ${providerId}.` });
          checks.push({ name: `provider:${providerId}`, status: "fail", detail: "Credential validation failed." });
          continue;
        }

        checks.push({ name: `provider:${providerId}`, status: "pass", detail: "Credential validated." });
      }

      if (referencedModels.length > 0) {
        const known = catalogModelsSet();
        const unknown = referencedModels.filter((m) => !known.has(m));
        if (unknown.length > 0) {
          errors.push({
            code: "RST_MODEL_UNKNOWN",
            message: `Referenced unknown model ids: ${unknown.join(", ")}`,
          });
          checks.push({ name: "models.catalog", status: "fail", detail: `${unknown.length} unknown model(s).` });
        } else {
          checks.push({ name: "models.catalog", status: "pass", detail: "All referenced models are in catalog." });
        }

        const deprecations = referencedModels.filter((m) => Boolean(DEPRECATED_MODELS[m]));
        if (deprecations.length > 0) {
          warnings.push({
            code: "RST_MODEL_DEPRECATED",
            message: `Deprecated/retiring models found: ${deprecations.join(", ")}`,
          });
          checks.push({
            name: "models.deprecation",
            status: "warn",
            detail: `${deprecations.length} model(s) have deprecation alerts.`,
          });
        } else {
          checks.push({ name: "models.deprecation", status: "pass", detail: "No deprecation alerts." });
        }
      }

      const hasErrors = errors.length > 0;
      const hasWarnings = warnings.length > 0;
      const status: "pass" | "warn" | "fail" = hasErrors ? "fail" : hasWarnings ? "warn" : "pass";
      const exitCode = hasErrors || (strict && hasWarnings) ? 1 : 0;
      const errorCodes = [...errors.map((e) => e.code), ...warnings.map((w) => w.code)];

      const structuredContent = { status, exitCode, errorCodes, errors, warnings, checks };
      return {
        content: [{ type: "text" as const, text: JSON.stringify(structuredContent, null, 2) }],
        structuredContent,
      };
    },
  );

  server.registerTool(
    "docs.search",
    {
      description: "Search Restormel documentation index (offline, fast).",
      inputSchema: docsSearchInput,
      outputSchema: docsSearchOutput,
    },
    async (args: { query: string; section?: string }) => {
      const hits = searchDocs(args.query, args.section);
      const results = hits.map((h) => ({
        title: h.title,
        url: h.url,
        excerpt: h.keywords.slice(0, 4).join(", "),
      }));
      const structuredContent = { results };
      return {
        content: [{ type: "text" as const, text: JSON.stringify(structuredContent, null, 2) }],
        structuredContent,
      };
    },
  );
}
