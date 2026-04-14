/**
 * Keys in-app docs sidebar — single source for navigation blocks.
 * Mirrors structure previously inlined in routes/keys/docs/+layout.svelte.
 */
export type DocsNavBlock =
  | { kind: "link"; href: string; label: string; external?: boolean }
  | {
      kind: "section";
      label: string;
      ariaLabel?: string;
      items: { href: string; label: string }[];
    }
  | { kind: "divider" };

export const keysDocsNavBlocks: DocsNavBlock[] = [
  { kind: "link", href: "/keys", label: "Keys" },
  {
    kind: "section",
    label: "Concepts",
    ariaLabel: "Concepts section",
    items: [
      { href: "/keys/docs", label: "Overview" },
      { href: "/keys/docs/how-it-fits-together", label: "How it fits together" },
    ],
  },
  { kind: "divider" },
  {
    kind: "section",
    label: "Quickstart",
    ariaLabel: "Quickstart section",
    items: [
      { href: "/keys/docs/journeys/new-project", label: "New project" },
      { href: "/keys/docs/journeys/existing-stack", label: "Existing stack" },
      { href: "/keys/docs/journeys/byok-saas", label: "BYOK SaaS" },
      { href: "/keys/docs/journeys/agent-ide", label: "Agent/IDE path" },
      { href: "/keys/docs/journeys/platform-ops", label: "Platform ops" },
      { href: "/keys/docs/search", label: "Search" },
      { href: "/keys/docs/walkthrough", label: "Walkthrough" },
    ],
  },
  { kind: "divider" },
  {
    kind: "section",
    label: "Guides",
    ariaLabel: "Guides section",
    items: [
      { href: "/keys/docs/guides/routing-contract", label: "Routing contract (SOPHIA-class)" },
      { href: "/keys/docs/guides/environment-vocabulary", label: "Environment vocabulary" },
      { href: "/keys/docs/guides/keys-testing-onboarding", label: "Keys + Testing onboarding" },
      { href: "/keys/docs/guides/byo-gpu-vm", label: "BYO-GPU — VM path" },
      { href: "/keys/docs/guides/byo-gpu-kubernetes", label: "BYO-GPU — Kubernetes" },
      { href: "/keys/docs/guides/testing-gpu-route-smoke", label: "GPU route smoke (Testing)" },
      { href: "/keys/docs/guides/release-pack-and-merge-gates", label: "Release pack & merge gates" },
      { href: "/keys/docs/guides/integration-failure-attribution", label: "Integration failure attribution" },
      { href: "/keys/docs/guides/gtm-self-serve-first", label: "Self-serve before enterprise" },
      { href: "/keys/docs/guides/provider-access-modes", label: "Provider access modes" },
      { href: "/keys/docs/reference/cli", label: "CLI options" },
      { href: "/keys/docs/guides/openrouter", label: "OpenRouter" },
      { href: "/keys/docs/guides/vercel-ai-gateway", label: "Vercel AI Gateway" },
      { href: "/keys/docs/guides/portkey", label: "Portkey" },
      { href: "/keys/docs/guides/canonical-catalog", label: "Canonical catalog" },
      { href: "/keys/docs/guides/integration-vs-hosted-vault", label: "Integration vs key custody" },
    ],
  },
  { kind: "divider" },
  {
    kind: "section",
    label: "Integrations",
    ariaLabel: "Integrations section",
    items: [
      { href: "/keys/docs/integrations", label: "Overview" },
      { href: "/keys/docs/integrations/cli", label: "CLI" },
      { href: "/keys/docs/integrations/mcp", label: "MCP" },
      { href: "/keys/docs/integrations/hosted-mcp-byo", label: "Hosted MCP (BYO execution)" },
      { href: "/keys/docs/integrations/aaif", label: "AAIF" },
      { href: "/keys/docs/integrations/webhooks-audit", label: "Webhooks & audit (MVP)" },
      { href: "/keys/docs/integrations-walkthrough/", label: "Integrations walkthrough" },
    ],
  },
  { kind: "divider" },
  {
    kind: "section",
    label: "API & compatibility",
    ariaLabel: "API and compatibility",
    items: [
      { href: "/keys/docs/compatibility", label: "Compatibility" },
      { href: "/keys/docs/cloud-api", label: "Cloud API" },
    ],
  },
];
