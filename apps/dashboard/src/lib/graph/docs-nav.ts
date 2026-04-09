import type { DocsNavBlock } from "$lib/keys/docs-nav.js";

export type DocsNavItem = { path: string; title: string };
export type DocsNavSection = { label: string; items: DocsNavItem[] };

/**
 * Restormel Graph — public docs IA (suite-aligned with Keys / Testing).
 * Canonical integrator path: `/graph/docs/integration/sveltekit`.
 */
export const docsNav: DocsNavSection[] = [
  {
    label: "Start",
    items: [
      { path: "/docs", title: "Docs home" },
      { path: "/docs/overview", title: "Overview" },
      { path: "/docs/how-it-fits-together", title: "How it fits together" },
    ],
  },
  {
    label: "Integration",
    items: [{ path: "/docs/integration/sveltekit", title: "SvelteKit integration" }],
  },
  {
    label: "Extensions",
    items: [{ path: "/docs/extensions/reasoning", title: "Reasoning extensions & contracts" }],
  },
  {
    label: "Guides",
    items: [
      { path: "/docs/guides/migration-from-custom-canvas", title: "Migrate from a custom canvas" },
      { path: "/docs/guides/recipes", title: "Recipes" },
    ],
  },
  {
    label: "Reference",
    items: [
      { path: "/docs/reference/api", title: "API reference" },
      { path: "/docs/reference/contract-v0-scope", title: "Contract v0 scope" },
      { path: "/docs/reference/accessibility", title: "Accessibility & input" },
      { path: "/docs/reference/performance", title: "Performance & scale" },
      { path: "/docs/reference/releases-and-support", title: "Releases & support" },
    ],
  },
];

export function graphDocsShellNav(graphBase: string): DocsNavBlock[] {
  const blocks: DocsNavBlock[] = [{ kind: "link", href: graphBase, label: "Graph" }];
  for (const section of docsNav) {
    blocks.push({
      kind: "section",
      label: section.label,
      ariaLabel: `${section.label} section`,
      items: section.items.map((it) => ({
        href: `${graphBase}${it.path}`,
        label: it.title,
      })),
    });
    blocks.push({ kind: "divider" });
  }
  if (blocks.length > 1 && blocks[blocks.length - 1].kind === "divider") {
    blocks.pop();
  }
  return blocks;
}
