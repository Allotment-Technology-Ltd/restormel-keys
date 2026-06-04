/**
 * Canonical in-hub tab strips — sidebar links only to hub roots; detail lives here.
 */
import { DASHBOARD_BASE } from "$lib/dashboard-base";
import { CONNECT_HUB_HREF, TESTING_HUB_HREF } from "$lib/nav-config";

export type HubTab = { href: string; label: string; exact: boolean };

export const CONNECT_HUB_TABS: HubTab[] = [
  { href: CONNECT_HUB_HREF, label: "Home", exact: true },
  { href: CONNECT_HUB_HREF + "/models", label: "Models & keys", exact: false },
  { href: CONNECT_HUB_HREF + "/pipeline", label: "Pipeline", exact: false },
  { href: CONNECT_HUB_HREF + "/ingest", label: "Runs", exact: false },
  { href: CONNECT_HUB_HREF + "/graph", label: "Graph", exact: false },
];

export const TESTING_HUB_TABS: HubTab[] = [
  { href: TESTING_HUB_HREF, label: "Start", exact: true },
  { href: DASHBOARD_BASE + "/copy-for-ci", label: "CI snippets", exact: true },
];
