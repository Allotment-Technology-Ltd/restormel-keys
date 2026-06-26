/**
 * Keys in-app docs sidebar — single source for navigation blocks.
 * Mirrors structure previously inlined in routes/keys/docs/+layout.svelte.
 */
import type { ModuleFlags } from "$lib/module-flags-types";
import { integrationCatalogForFlags } from "$lib/integration-catalog-for-flags";

export type DocsNavBlock =
  | { kind: "link"; href: string; label: string; external?: boolean }
  | {
      kind: "section";
      label: string;
      ariaLabel?: string;
      items: { href: string; label: string }[];
      /** Tier 2 reference — collapsed by default (Theme L progressive disclosure). */
      defaultCollapsed?: boolean;
    }
  | { kind: "divider" };

/**
 * Tier 1 Keys docs sidebar — one coherent spine: Start · Guides · Tutorials · Reference.
 * Tutorials is the single home for the two step-by-step walkthroughs plus the
 * persona "Choose your path" hub (formerly three competing trees).
 */
export const keysDocsNavBlocks: DocsNavBlock[] = [
  { kind: "link", href: "/docs", label: "Restormel docs" },
  { kind: "link", href: "/keys", label: "Keys" },
  { kind: "link", href: "/keys/docs/api-reference", label: "API reference" },
  {
    kind: "section",
    label: "Start",
    ariaLabel: "Start section",
    items: [
      { href: "/keys/docs", label: "Overview" },
      { href: "/docs/how-it-fits-together", label: "How it fits together" },
      { href: "/keys/docs/tutorials", label: "Tutorials" },
      { href: "/keys/docs/guides/provider-access-modes", label: "Provider access modes" },
    ],
  },
  { kind: "divider" },
  {
    kind: "section",
    label: "Guides",
    ariaLabel: "Guides section",
    items: [
      { href: "/keys/docs/guides/verified-context", label: "Verified context" },
      { href: "/keys/docs/guides/mcp-verified-context", label: "MCP verified-context quickstart" },
      { href: "/keys/docs/guides/wrap-your-mcp-server", label: "Wrap your MCP server" },
      { href: "/keys/docs/guides/context-regression-ci", label: "Context-regression CI" },
      { href: "/keys/docs/guides/connect-first-graph-onboarding", label: "Connect first graph" },
      { href: "/keys/docs/guides/integration-catalog", label: "Integration catalog" },
      { href: "/keys/docs/guides/keys-testing-onboarding", label: "Keys + Testing" },
      { href: "/keys/docs/guides/environment-vocabulary", label: "Environment vocabulary" },
    ],
  },
  { kind: "divider" },
  {
    kind: "section",
    label: "Tutorials",
    ariaLabel: "Tutorials section",
    items: [
      { href: "/keys/docs/tutorials", label: "All tutorials" },
      { href: "/keys/docs/walkthrough", label: "Keys integration walkthrough" },
      { href: "/keys/docs/integrations-walkthrough", label: "Integrations: CLI / MCP / Dispatch" },
    ],
  },
  { kind: "divider" },
  {
    kind: "section",
    label: "Reference",
    ariaLabel: "Reference section",
    defaultCollapsed: true,
    items: [
      { href: "/keys/docs/search", label: "Search all docs" },
      { href: "/keys/docs/integrations", label: "Integrations hub" },
      { href: "/keys/docs/compatibility", label: "Compatibility" },
      { href: "/keys/docs/cloud-api", label: "Cloud API" },
      { href: "/keys/docs/guides/openrouter", label: "OpenRouter" },
      { href: "/keys/docs/guides/portkey", label: "Portkey" },
      { href: "/keys/docs/guides/vercel-ai-gateway", label: "Vercel AI Gateway" },
      { href: "/keys/docs/integrations/mcp", label: "MCP" },
      { href: "/keys/docs/integrations/aaif", label: "Dispatch" },
    ],
  },
];

const GATEWAY_GUIDE_HREFS = new Set([
  "/keys/docs/guides/openrouter",
  "/keys/docs/guides/portkey",
  "/keys/docs/guides/vercel-ai-gateway",
]);

/** Filter Keys docs nav for resolved module flags (MVP hides Testing + gateway guides). */
export function keysDocsNavBlocksForFlags(flags: ModuleFlags): DocsNavBlock[] {
  return keysDocsNavBlocks
    .map((block) => {
      if (block.kind !== "section") return block;
      const items = block.items.filter((item) => {
        if (!flags.testing && item.href === "/keys/docs/guides/keys-testing-onboarding") return false;
        if (!flags.environments && item.href === "/keys/docs/guides/environment-vocabulary") return false;
        if (!flags.gatewayProviders && GATEWAY_GUIDE_HREFS.has(item.href)) return false;
        if (
          item.href === "/keys/docs/guides/integration-catalog" &&
          integrationCatalogForFlags(flags).length === 0
        ) {
          return false;
        }
        return true;
      });
      if (items.length === 0) return null;
      return { ...block, items };
    })
    .filter((block): block is DocsNavBlock => block !== null);
}
