/**
 * Single source of truth for integration component ids used in marketing, docs,
 * the dashboard stack wizard, and optional {@link AAIFRequest.integrationStack}.
 */
export const INTEGRATION_STACK_SCHEMA_VERSION = "1" as const;

/** Stable lowercase kebab ids — keep in sync with dashboard static logos where applicable. */
export const INTEGRATION_COMPONENT_IDS = [
  "neon",
  "vercel",
  "github",
  "openrouter",
  "portkey",
  "openai",
  "anthropic",
  "google",
  "zuplo",
] as const;

export type IntegrationComponentId = (typeof INTEGRATION_COMPONENT_IDS)[number];

const INTEGRATION_COMPONENT_ID_SET = new Set<string>(INTEGRATION_COMPONENT_IDS);

export function isIntegrationComponentId(value: string): value is IntegrationComponentId {
  return INTEGRATION_COMPONENT_ID_SET.has(value);
}

export type IntegrationCatalogCategory =
  | "database"
  | "hosting"
  | "gateway"
  | "model_provider"
  | "ci"
  | "auth";

export type IntegrationCatalogEntry = {
  id: IntegrationComponentId;
  label: string;
  category: IntegrationCatalogCategory;
  /** In-app path starting with /keys/docs/ or /testing/docs/ or /graph/docs/ */
  docsPath: string;
  externalUrl?: string;
  /** Basename under apps/dashboard/static/integrations/brands (no .svg) — optional */
  logoId?: string;
};

export const INTEGRATION_CATALOG: readonly IntegrationCatalogEntry[] = [
  {
    id: "neon",
    label: "Neon",
    category: "database",
    docsPath: "/keys/docs/guides/database-neon-for-self-hosters",
    externalUrl: "https://neon.tech/",
  },
  {
    id: "vercel",
    label: "Vercel",
    category: "hosting",
    docsPath: "/keys/docs/guides/vercel-ai-gateway",
    externalUrl: "https://vercel.com/",
    logoId: "vercel",
  },
  {
    id: "github",
    label: "GitHub Actions",
    category: "ci",
    docsPath: "/testing/docs/guides/ci",
    externalUrl: "https://github.com/features/actions",
    logoId: "github",
  },
  {
    id: "openrouter",
    label: "OpenRouter",
    category: "gateway",
    docsPath: "/keys/docs/guides/openrouter",
    externalUrl: "https://openrouter.ai/",
  },
  {
    id: "portkey",
    label: "Portkey",
    category: "gateway",
    docsPath: "/keys/docs/guides/portkey",
    externalUrl: "https://portkey.ai/",
  },
  {
    id: "openai",
    label: "OpenAI",
    category: "model_provider",
    docsPath: "/keys/docs/compatibility",
    externalUrl: "https://openai.com/",
    logoId: "openai",
  },
  {
    id: "anthropic",
    label: "Anthropic",
    category: "model_provider",
    docsPath: "/keys/docs/compatibility",
    externalUrl: "https://www.anthropic.com/",
    logoId: "anthropic",
  },
  {
    id: "google",
    label: "Google AI",
    category: "model_provider",
    docsPath: "/keys/docs/compatibility",
    externalUrl: "https://ai.google.dev/",
    logoId: "google",
  },
  {
    id: "zuplo",
    label: "Zuplo",
    category: "gateway",
    docsPath: "/keys/docs/cloud-api",
    externalUrl: "https://zuplo.com/",
  },
] as const;

/** Preset templates for the dashboard stack wizard (ids must exist in {@link INTEGRATION_COMPONENT_IDS}). */
export const INTEGRATION_STACK_TEMPLATES = [
  {
    id: "sveltekit-neon-keys",
    label: "SvelteKit + Neon + Keys",
    componentIds: ["neon", "vercel", "openai"] as const,
  },
  {
    id: "next-vercel-ai-keys",
    label: "Next.js + Vercel AI + Keys",
    componentIds: ["vercel", "openai", "anthropic"] as const,
  },
  {
    id: "github-actions-testing",
    label: "GitHub Actions + Testing",
    componentIds: ["github", "openrouter"] as const,
  },
  {
    id: "openrouter-portkey-keys",
    label: "OpenRouter / Portkey + Keys",
    componentIds: ["openrouter", "portkey", "zuplo"] as const,
  },
] as const;

export type IntegrationStackTemplateId = (typeof INTEGRATION_STACK_TEMPLATES)[number]["id"];
