/**
 * Canonical suite module definitions — capability verb, product name, color, marketing copy.
 * Use everywhere (proof gallery, nav labels, landing pages) for consistent IA.
 */
import { DASHBOARD_BASE } from "$lib/dashboard-base";

export type SuiteModuleId = "keys" | "testing" | "graph" | "connect";

export type SuiteModule = {
  id: SuiteModuleId;
  /** Short capability verb (Route, Assure, …) */
  capability: string;
  /** Product name */
  product: string;
  /** CSS custom property for module accent */
  colorVar: string;
  summary: string;
  proofLabel: string;
  href: string;
  runHref: string;
  embedHref: string;
  dashboardLabel: string;
  navLabel: string;
};

export const SUITE_MODULES: SuiteModule[] = [
  {
    id: "keys",
    capability: "Route",
    product: "Restormel Keys",
    colorVar: "--brut-module-keys",
    summary:
      "Control which model runs on every request — visual routes, fallback chains, and policies on your existing gateways.",
    proofLabel: "Resolve chain",
    href: "/keys",
    runHref: DASHBOARD_BASE,
    embedHref: "/keys/docs/journeys/new-project",
    dashboardLabel: "Keys overview",
    navLabel: "Route (Keys)",
  },
  {
    id: "testing",
    capability: "Assure",
    product: "Restormel Testing",
    colorVar: "--brut-module-testing",
    summary:
      "Assure AI quality in CI and locally — goal-based acceptance tests with Keys-backed judge and resolve paths.",
    proofLabel: "QA verdict",
    href: "/testing",
    runHref: DASHBOARD_BASE + "/testing",
    embedHref: "/testing/docs/getting-started/existing-stack",
    dashboardLabel: "Testing overview",
    navLabel: "Assure (Testing)",
  },
  {
    id: "graph",
    capability: "Visualise",
    product: "Restormel Graph",
    colorVar: "--brut-module-graph",
    summary:
      "Visualise reasoning and knowledge graphs in your app — contract-first canvas for Svelte or Web Components.",
    proofLabel: "Knowledge graph",
    href: "/graph",
    runHref: DASHBOARD_BASE + "/graph",
    embedHref: "/graph/docs/integration/sveltekit",
    dashboardLabel: "SvelteKit guide",
    navLabel: "Visualise (Graph)",
  },
  {
    id: "connect",
    capability: "Connect",
    product: "Restormel Connect",
    colorVar: "--brut-module-connect",
    summary:
      "Stand up agent-ready knowledge infrastructure — wire documents into a structured graph, then serve verified context to agents via REST and MCP.",
    proofLabel: "Agent context layer",
    href: "/connect",
    runHref: DASHBOARD_BASE + "/connect",
    embedHref: "/connect/docs",
    dashboardLabel: "Open Connect hub",
    navLabel: "Connect",
  },
];

export const SUITE_CAPABILITY_TAGLINE = "Route, assure, visualise, and connect AI in one suite";

export function moduleById(id: SuiteModuleId): SuiteModule {
  const mod = SUITE_MODULES.find((m) => m.id === id);
  if (!mod) throw new Error(`Unknown suite module: ${id}`);
  return mod;
}
