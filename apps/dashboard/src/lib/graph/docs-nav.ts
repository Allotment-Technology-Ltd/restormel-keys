import type { DocsNavBlock } from "$lib/keys/docs-nav.js";

export type DocsNavItem = { path: string; title: string };
export type DocsNavSection = { label: string; items: DocsNavItem[] };

/**
 * Restormel Graph — public docs IA (suite-aligned, progressive disclosure).
 * Canonical integrator path: `/graph/docs/integration/sveltekit`.
 */
export const docsNav: DocsNavSection[] = [
  {
    label: "Start",
    items: [
      { path: "", title: "Docs home" },
      { path: "/overview", title: "Overview" },
      { path: "/how-it-fits-together", title: "How it fits together" },
    ],
  },
  {
    label: "Integration",
    items: [
      { path: "/integration/sveltekit", title: "SvelteKit integration" },
      { path: "/integration/web-components", title: "Web Components" },
    ],
  },
  {
    label: "Reference",
    items: [
      { path: "/guides/recipes", title: "Recipes" },
      { path: "/reference/api", title: "API reference" },
      { path: "/reference/contract-v0-scope", title: "Contract v0 scope" },
      { path: "/reference/accessibility", title: "Accessibility" },
      { path: "/reference/performance", title: "Performance" },
      { path: "/extensions/state", title: "Restormel State" },
    ],
  },
];

export function graphDocsShellNav(graphBase: string): DocsNavBlock[] {
  const blocks: DocsNavBlock[] = [
    { kind: "link", href: "/docs", label: "Restormel docs" },
    { kind: "link", href: graphBase, label: "Graph" },
  ];
  for (const section of docsNav) {
    blocks.push({
      kind: "section",
      label: section.label,
      ariaLabel: `${section.label} section`,
      defaultCollapsed: section.label === "Reference",
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
