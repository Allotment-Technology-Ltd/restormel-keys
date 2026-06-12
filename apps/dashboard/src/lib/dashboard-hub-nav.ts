/**
 * Canonical in-hub tab strips. The Connect hub strip is gone (R2 — the hub is
 * dissolved into top-level sections; see nav-config.ts). Only sections that
 * genuinely subdivide keep a single tab level (Testing today; Prove/Agents in R5).
 */
import { DASHBOARD_BASE } from "$lib/dashboard-base";
import { TESTING_HUB_HREF } from "$lib/nav-config";

export type HubTab = {
  href: string;
  label: string;
  exact: boolean;
  /**
   * Optional badge count. When provided and > 0 the tab strip renders a
   * numeric badge and an extended aria-label. Hidden at zero to keep the UI clean.
   */
  badge?: number;
};

export const TESTING_HUB_TABS: HubTab[] = [
  { href: TESTING_HUB_HREF, label: "Start", exact: true },
  { href: DASHBOARD_BASE + "/copy-for-ci", label: "CI snippets", exact: true },
];
