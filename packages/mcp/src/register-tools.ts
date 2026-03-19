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

type EntitlementToolResult = {
  feature: string;
  entitled: boolean;
  plan: string;
  reason: string;
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
