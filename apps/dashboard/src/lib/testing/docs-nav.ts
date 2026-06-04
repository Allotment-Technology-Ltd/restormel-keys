import type { DocsNavBlock } from "$lib/keys/docs-nav.js";

/**
 * Restormel Testing — docs IA (suite-aligned, progressive disclosure).
 */
export type DocsNavItem = { path: string; title: string };
export type DocsNavSection = { label: string; items: DocsNavItem[] };

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
    label: "Getting started",
    items: [
      { path: "/getting-started/new-project", title: "New project" },
      { path: "/getting-started/existing-stack", title: "Existing stack" },
    ],
  },
  {
    label: "Guides",
    items: [
      { path: "/guides/ci", title: "CI / GitHub Actions" },
      { path: "/guides/config", title: "Configuration" },
      { path: "/guides/keys-dashboard-onboarding", title: "Keys + Testing (dashboard)" },
    ],
  },
  {
    label: "Reference",
    items: [
      { path: "/walkthrough", title: "Walkthrough" },
      { path: "/architecture", title: "Architecture" },
      { path: "/compatibility", title: "Compatibility" },
      { path: "/examples", title: "Examples" },
      { path: "/integrations/keys", title: "Restormel Keys" },
    ],
  },
];

/** Core path: inventory → install → Keys → first goal → local run → CI (MVP). */
export type WalkthroughPhase = {
  path: string;
  title: string;
  summary: string;
  mvpDocPriority: "now" | "later";
};

export const walkthroughCorePhases: WalkthroughPhase[] = [
  {
    path: "/docs/walkthrough/phase-0-inventory",
    title: "Phase 0 — Inventory",
    summary: "What you already have (stack, CI, Keys).",
    mvpDocPriority: "now",
  },
  {
    path: "/docs/walkthrough/phase-1-install",
    title: "Phase 1 — Install and configure",
    summary: "CLI, init, validate, restormel-testing.yaml scaffold, doctor.",
    mvpDocPriority: "now",
  },
  {
    path: "/docs/walkthrough/phase-2-keys",
    title: "Phase 2 — Wire Keys",
    summary: "Prove one resolve path for test execution (BYOK-aligned).",
    mvpDocPriority: "now",
  },
  {
    path: "/docs/walkthrough/phase-3-first-goal",
    title: "Phase 3 — First goal",
    summary: "One business-meaningful outcome with explicit success criteria.",
    mvpDocPriority: "now",
  },
  {
    path: "/docs/walkthrough/phase-4-local-run",
    title: "Phase 4 — Local run",
    summary: "Execute the suite; read verdicts and artefacts.",
    mvpDocPriority: "now",
  },
  {
    path: "/docs/walkthrough/phase-5-ci",
    title: "Phase 5 — CI",
    summary: "GitHub Actions or your CI runner with the same contract as local.",
    mvpDocPriority: "now",
  },
];

export const walkthroughExtendedPhases: WalkthroughPhase[] = [
  {
    path: "/docs/walkthrough/migration-paths",
    title: "Migration paths",
    summary: "From Playwright-only scripts or ad hoc eval harnesses.",
    mvpDocPriority: "later",
  },
  {
    path: "/docs/walkthrough/verification-strategy",
    title: "Verification strategy",
    summary: "When to trust the gate; flakes; local/CI parity.",
    mvpDocPriority: "now",
  },
  {
    path: "/docs/walkthrough/secrets-and-ci-setup",
    title: "Secrets and CI setup",
    summary: "GitHub Actions secrets, rotation, staging vs prod Keys projects.",
    mvpDocPriority: "later",
  },
];

export const allWalkthroughPaths: string[] = [
  ...walkthroughCorePhases.map((p) => p.path),
  ...walkthroughExtendedPhases.map((p) => p.path),
];

export function testingDocsShellNav(testingBase: string): DocsNavBlock[] {
  const blocks: DocsNavBlock[] = [
    { kind: "link", href: "/docs", label: "Restormel docs" },
    { kind: "link", href: testingBase.replace(/\/docs$/, ""), label: "Testing" },
  ];
  for (const section of docsNav) {
    const defaultCollapsed = section.label === "Reference";
    blocks.push({
      kind: "section",
      label: section.label,
      ariaLabel: `${section.label} section`,
      defaultCollapsed,
      items: section.items.map((it) => ({
        href: `${testingBase}${it.path}`,
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
