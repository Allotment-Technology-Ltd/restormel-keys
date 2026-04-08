/**
 * Restormel Testing — docs information architecture (suite-aligned with Keys).
 *
 * Taxonomy (structural discipline mirrors Keys: Concepts, Quickstart, Guides,
 * Integrations, Walkthrough, Journeys chooser, Compatibility).
 *
 * - **Docs home** (`/docs`) — intro, “What brings you here?”, components, quick links.
 * - **Concepts** — `overview`, `how-it-fits-together` (Keys-style top-level orientation).
 * - **Quickstart / getting started** — `getting-started/new-project`, `getting-started/existing-stack`.
 * - **Walkthrough** — phase-based onboarding (`walkthrough`, `walkthrough/phase-*`, extended topics).
 * - **Guides** — task docs: `guides/ci`, `guides/config`, `guides/test-definition`, `guides/plot-dogfooding`.
 * - **Integrations** — `integrations/keys` (BYOK seam; Keys canonical env/API docs linked from here).
 * - **Reference-style** — `architecture`, `examples`, `compatibility` (runtime/CI matrix).
 * - **Journeys** — thin entry points for the chooser (`journeys/*`), same pattern as Keys.
 *
 * Route names stay short and stable; expand with subpages later without renaming parents.
 */
export type DocsNavItem = { path: string; title: string };
export type DocsNavSection = { label: string; items: DocsNavItem[] };

export const docsNav: DocsNavSection[] = [
  {
    label: "Start",
    items: [
      { path: "/docs", title: "Docs home" },
      { path: "/docs/walkthrough", title: "Walkthrough" },
      { path: "/docs/overview", title: "Overview" },
      { path: "/docs/how-it-fits-together", title: "How it fits together" },
    ],
  },
  {
    label: "Getting started",
    items: [
      { path: "/docs/getting-started/new-project", title: "New project" },
      { path: "/docs/getting-started/existing-stack", title: "Existing stack" },
    ],
  },
  {
    label: "Guides",
    items: [
      { path: "/docs/guides/ci", title: "CI / GitHub Actions" },
      { path: "/docs/guides/config", title: "Configuration" },
      { path: "/docs/guides/test-definition", title: "Test definition" },
      { path: "/docs/guides/plot-dogfooding", title: "Plot dogfooding" },
    ],
  },
  {
    label: "Integrations",
    items: [{ path: "/docs/integrations/keys", title: "Restormel Keys" }],
  },
  {
    label: "Reference",
    items: [
      { path: "/docs/architecture", title: "Architecture" },
      { path: "/docs/compatibility", title: "Compatibility" },
      { path: "/docs/examples", title: "Examples" },
    ],
  },
];

/** Core path: inventory → install → Keys → first goal → local run → CI (MVP). */
export type WalkthroughPhase = {
  path: string;
  title: string;
  summary: string;
  /** Ship full prose in the web docs next. */
  mvpDocPriority: "now" | "later";
};

export const walkthroughCorePhases: WalkthroughPhase[] = [
  {
    path: "/docs/walkthrough/phase-0-inventory",
    title: "Phase 0 — Inventory",
    summary: "Audit AI-heavy journeys; decide goals vs unit/E2E; secrets and Keys posture.",
    mvpDocPriority: "now",
  },
  {
    path: "/docs/walkthrough/phase-1-install",
    title: "Phase 1 — Install and configure",
    summary: "CLI, `init`, `validate`, `restormel-testing.yaml` scaffold, `doctor`; repo layout.",
    mvpDocPriority: "now",
  },
  {
    path: "/docs/walkthrough/phase-2-keys",
    title: "Phase 2 — Wire Keys and confirm resolution",
    summary: "Logical model references; prove one resolve path for test execution (BYOK-aligned).",
    mvpDocPriority: "now",
  },
  {
    path: "/docs/walkthrough/phase-3-first-goal",
    title: "Phase 3 — Define your first goal",
    summary: "One business-meaningful outcome with explicit success criteria.",
    mvpDocPriority: "now",
  },
  {
    path: "/docs/walkthrough/phase-4-local-run",
    title: "Phase 4 — Run your first suite locally",
    summary: "Execute the suite; read verdicts, reason codes, and artefacts.",
    mvpDocPriority: "now",
  },
  {
    path: "/docs/walkthrough/phase-5-ci",
    title: "Phase 5 — Add CI (GitHub Actions)",
    summary: "Same run contract as local; composite Action, artefacts, reproduction commands.",
    mvpDocPriority: "now",
  },
];

/** Same shape as Keys: migration, verification strategy, secrets/CI depth after the numbered path. */
export const walkthroughExtendedPhases: WalkthroughPhase[] = [
  {
    path: "/docs/walkthrough/migration-paths",
    title: "Migration paths",
    summary: "From Playwright-only scripts, ad hoc eval harnesses, or brittle legacy E2E.",
    mvpDocPriority: "later",
  },
  {
    path: "/docs/walkthrough/verification-strategy",
    title: "Verification strategy",
    summary: "When to trust the gate; flakes; local/CI parity; artefact review.",
    mvpDocPriority: "now",
  },
  {
    path: "/docs/walkthrough/secrets-and-ci-setup",
    title: "Secrets and CI setup",
    summary: "GitHub Actions secrets, rotation, staging vs prod Keys projects, nightly vs PR jobs.",
    mvpDocPriority: "later",
  },
];

/** Full ordered list for nav highlighting: any walkthrough subpath activates Walkthrough in sidebar. */
export const allWalkthroughPaths: string[] = [
  ...walkthroughCorePhases.map((p) => p.path),
  ...walkthroughExtendedPhases.map((p) => p.path),
];
