/**
 * Single source of truth for integration component ids used in marketing, docs,
 * the dashboard stack wizard, and optional {@link AAIFRequest.integrationStack}.
 */
export const INTEGRATION_STACK_SCHEMA_VERSION = "1" as const;

/** Stable lowercase kebab ids — keep in sync with dashboard static logos where applicable. */
export const INTEGRATION_COMPONENT_IDS = [
  "neon",
  "surreal",
  "vercel",
  "github",
  "openrouter",
  "portkey",
  "openai",
  "anthropic",
  "google",
  "mistral",
  "together",
  "voyage",
  "aizolo",
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

/** Marketing stack grid — groups catalog entries by role in the product story. */
export type StackLayer = "data" | "models" | "gateways" | "ship";

export const STACK_LAYER_ORDER: readonly StackLayer[] = ["data", "models", "gateways", "ship"] as const;

export const STACK_LAYERS: readonly {
  id: StackLayer;
  title: string;
  hint: string;
}[] = [
  {
    id: "data",
    title: "Data & graph",
    hint: "Workspace Postgres and your Connect knowledge graph — you keep the accounts.",
  },
  {
    id: "models",
    title: "Models (BYOK)",
    hint: "Direct provider keys for routing and ingest — your spend, your policies.",
  },
  {
    id: "gateways",
    title: "Gateways",
    hint: "Optional routers above providers — Restormel sits on top, not instead.",
  },
  {
    id: "ship",
    title: "Ship & verify",
    hint: "Hosting and CI when you extend the suite beyond the dashboard.",
  },
] as const;

export type IntegrationCatalogEntry = {
  id: IntegrationComponentId;
  label: string;
  category: IntegrationCatalogCategory;
  stackLayer: StackLayer;
  /** Short role label on marketing stack grid (e.g. "Knowledge graph"). */
  roleLabel?: string;
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
    stackLayer: "data",
    roleLabel: "Postgres spine",
    docsPath: "/keys/docs/guides/database-neon-for-self-hosters",
    externalUrl: "https://neon.tech/",
    logoId: "neon",
  },
  {
    id: "surreal",
    label: "SurrealDB",
    category: "database",
    stackLayer: "data",
    roleLabel: "Knowledge graph",
    docsPath: "/keys/docs/guides/connect-first-graph-onboarding",
    externalUrl: "https://surrealdb.com/",
    logoId: "surreal",
  },
  {
    id: "vercel",
    label: "Vercel",
    category: "hosting",
    stackLayer: "ship",
    roleLabel: "Hosting",
    docsPath: "/keys/docs/guides/vercel-ai-gateway",
    externalUrl: "https://vercel.com/",
    logoId: "vercel",
  },
  {
    id: "github",
    label: "GitHub Actions",
    category: "ci",
    stackLayer: "ship",
    roleLabel: "CI",
    docsPath: "/testing/docs/guides/ci",
    externalUrl: "https://github.com/features/actions",
    logoId: "github",
  },
  {
    id: "openrouter",
    label: "OpenRouter",
    category: "gateway",
    stackLayer: "gateways",
    docsPath: "/keys/docs/guides/openrouter",
    externalUrl: "https://openrouter.ai/",
    logoId: "openrouter",
  },
  {
    id: "portkey",
    label: "Portkey",
    category: "gateway",
    stackLayer: "gateways",
    docsPath: "/keys/docs/guides/portkey",
    externalUrl: "https://portkey.ai/",
    logoId: "portkey",
  },
  {
    id: "openai",
    label: "OpenAI",
    category: "model_provider",
    stackLayer: "models",
    docsPath: "/keys/docs/compatibility",
    externalUrl: "https://openai.com/",
    logoId: "openai",
  },
  {
    id: "anthropic",
    label: "Anthropic",
    category: "model_provider",
    stackLayer: "models",
    docsPath: "/keys/docs/compatibility",
    externalUrl: "https://www.anthropic.com/",
    logoId: "anthropic",
  },
  {
    id: "google",
    label: "Google AI",
    category: "model_provider",
    stackLayer: "models",
    docsPath: "/keys/docs/compatibility",
    externalUrl: "https://ai.google.dev/",
    logoId: "google",
  },
  {
    id: "mistral",
    label: "Mistral",
    category: "model_provider",
    stackLayer: "models",
    docsPath: "/keys/docs/guides/canonical-catalog",
    externalUrl: "https://mistral.ai/",
    logoId: "mistral",
  },
  {
    id: "together",
    label: "Together AI",
    category: "model_provider",
    stackLayer: "models",
    roleLabel: "Open models",
    docsPath: "/keys/docs/guides/canonical-catalog",
    externalUrl: "https://www.together.ai/",
    logoId: "together",
  },
  {
    id: "voyage",
    label: "Voyage AI",
    category: "model_provider",
    stackLayer: "models",
    roleLabel: "Embeddings",
    docsPath: "/keys/docs/guides/canonical-catalog",
    externalUrl: "https://www.voyageai.com/",
    logoId: "voyage",
  },
  {
    id: "aizolo",
    label: "AiZolo",
    category: "model_provider",
    stackLayer: "models",
    docsPath: "/keys/docs/guides/aizolo",
    externalUrl: "https://aizolo.com/",
    logoId: "aizolo",
  },
  {
    id: "zuplo",
    label: "Zuplo",
    category: "gateway",
    stackLayer: "gateways",
    roleLabel: "Cloud API",
    docsPath: "/keys/docs/cloud-api",
    externalUrl: "https://zuplo.com/",
    logoId: "zuplo",
  },
] as const;

/** Preset templates for the dashboard stack wizard (ids must exist in {@link INTEGRATION_COMPONENT_IDS}). */
export const INTEGRATION_STACK_TEMPLATES = [
  {
    id: "sveltekit-neon-keys",
    label: "SvelteKit + Neon + Keys",
    componentIds: ["neon", "surreal", "openai"] as const,
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
