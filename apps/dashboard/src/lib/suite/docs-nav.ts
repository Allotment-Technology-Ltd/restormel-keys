import type { ModuleFlags } from "$lib/module-flags-types";
import { filterSuiteModulesForFlags } from "$lib/suite/filter-suite-modules";
import { SUITE_MODULES } from "$lib/suite/suite-modules";

export type SuiteDocsNavItem = {
  path: string;
  title: string;
  /** When set, used instead of `/docs${path}` (product doc trees live outside `/docs`). */
  href?: string;
};

export type SuiteDocsNavSection = { label: string; items: SuiteDocsNavItem[] };

const STATIC_SUITE_DOCS_NAV: SuiteDocsNavSection[] = [
  {
    label: "Start",
    items: [
      { path: "", title: "Docs home" },
      { path: "/how-it-fits-together", title: "How it fits together" },
      { path: "/run-vs-embed", title: "Run vs embed" },
    ],
  },
  {
    label: "Getting started",
    items: [
      { path: "/quickstart", title: "Suite quickstart" },
      { path: "/operator-model", title: "Operator model" },
    ],
  },
];

/** Tier 0–1 suite docs sidebar (Theme L). Capability section filtered via {@link suiteDocsNavForFlags}. */
export const suiteDocsNav: SuiteDocsNavSection[] = [
  ...STATIC_SUITE_DOCS_NAV,
  {
    label: "Capability docs",
    items: SUITE_MODULES.map((mod) => ({
      href: mod.id === "connect" ? "/connect/docs" : `${mod.href}/docs`,
      path: "",
      title: mod.navLabel,
    })),
  },
];

export function suiteDocsNavForFlags(flags: ModuleFlags): SuiteDocsNavSection[] {
  const modules = filterSuiteModulesForFlags(flags);
  return [
    ...STATIC_SUITE_DOCS_NAV,
    {
      label: "Capability docs",
      items: modules.map((mod) => ({
        href: mod.id === "connect" ? "/connect/docs" : `${mod.href}/docs`,
        path: "",
        title: mod.navLabel,
      })),
    },
  ];
}

export function suiteDocsShellNav(flags?: ModuleFlags): import("$lib/keys/docs-nav.js").DocsNavBlock[] {
  const nav = flags ? suiteDocsNavForFlags(flags) : suiteDocsNav;
  const base = "/docs";
  const blocks: import("$lib/keys/docs-nav.js").DocsNavBlock[] = [{ kind: "link", href: "/", label: "Restormel" }];
  for (const section of nav) {
    blocks.push({
      kind: "section",
      label: section.label,
      ariaLabel: `${section.label} section`,
      items: section.items.map((it) => ({
        href: it.href ?? (it.path ? `${base}${it.path}` : base),
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
