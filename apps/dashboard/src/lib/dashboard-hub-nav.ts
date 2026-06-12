/**
 * Canonical in-hub tab strips — sidebar links only to hub roots; detail lives here.
 */
import { DASHBOARD_BASE } from "$lib/dashboard-base";
import { CONNECT_HUB_HREF, TESTING_HUB_HREF } from "$lib/nav-config";

export type HubTab = {
  href: string;
  label: string;
  exact: boolean;
  /**
   * Optional badge count. When provided and > 0 the tab strip renders a
   * numeric badge and an extended aria-label ("Graph — 12 claims need review").
   * Hidden at zero to keep the UI clean.
   */
  badge?: number;
};

/** Canonical Connect MCP / agent wiring screen (hub tab). */
export const CONNECT_MCP_HREF = CONNECT_HUB_HREF + "/mcp";

export const CONNECT_HUB_TABS: HubTab[] = [
  { href: CONNECT_HUB_HREF, label: "Home", exact: true },
  { href: CONNECT_HUB_HREF + "/library", label: "Library", exact: false },
  { href: CONNECT_HUB_HREF + "/models", label: "Ingest routes", exact: false },
  { href: CONNECT_HUB_HREF + "/pipeline", label: "Setup", exact: false },
  { href: CONNECT_HUB_HREF + "/ingest", label: "Runs", exact: false },
  { href: CONNECT_HUB_HREF + "/graph", label: "Graph", exact: false },
  { href: CONNECT_HUB_HREF + "/proof", label: "Proof", exact: false },
  { href: CONNECT_MCP_HREF, label: "Agents", exact: true },
  { href: CONNECT_HUB_HREF + "/memory", label: "Memory", exact: false },
];

export const TESTING_HUB_TABS: HubTab[] = [
  { href: TESTING_HUB_HREF, label: "Start", exact: true },
  { href: DASHBOARD_BASE + "/copy-for-ci", label: "CI snippets", exact: true },
];
