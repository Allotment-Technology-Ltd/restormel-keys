/**
 * Canonical in-hub tab strips. The Connect hub strip is gone (R2 — the hub is
 * dissolved into top-level sections; see nav-config.ts). Only sections that
 * genuinely subdivide keep a single tab level (Testing today; Prove/Agents in R5).
 *
 * R5: Agents and Prove gain one tab level (no tabs-in-tabs). Routes gains an
 * Ingestion tab for the rehomed connect/models view.
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

// ── R5: Agents hub tabs ──────────────────────────────────────────────────────

/**
 * Agents section tabs.
 * - Wiring: MCP agent setup (moved from /connect/mcp).
 * - Catalogs: CLI / MCP / AAIF tool catalogs (moved from /dev-tools/**).
 */
export const AGENTS_HUB_TABS: HubTab[] = [
  { href: DASHBOARD_BASE + "/agents/wiring", label: "Wiring", exact: false },
  { href: DASHBOARD_BASE + "/agents/catalogs", label: "Catalogs", exact: false },
];

// ── R5: Prove hub tabs ───────────────────────────────────────────────────────

/**
 * Prove section tabs.
 * - Proof: graph-vs-baseline comparison (moved from /connect/proof).
 * - Traces: ingest trace list + export (GET /connect/v1/traces).
 * - Audit: key + config audit log (moved from /access/audit).
 * - Share: public scorecard placeholder (gated on W4.3 STOP decision).
 */
export const PROVE_HUB_TABS: HubTab[] = [
  { href: DASHBOARD_BASE + "/prove/proof", label: "Proof", exact: false },
  { href: DASHBOARD_BASE + "/prove/traces", label: "Traces", exact: false },
  { href: DASHBOARD_BASE + "/prove/audit", label: "Audit", exact: false },
  { href: DASHBOARD_BASE + "/prove/share", label: "Share", exact: false },
];

// ── R5: Routes hub tabs ──────────────────────────────────────────────────────

/**
 * Routes section tabs.
 * - Rules: the per-project routing rules table (existing /routes content).
 * - Ingestion: per-stage ingest route configuration (rehomed from /connect/models).
 */
export const ROUTES_HUB_TABS: HubTab[] = [
  { href: DASHBOARD_BASE + "/routes", label: "Rules", exact: true },
  { href: DASHBOARD_BASE + "/routes/ingestion", label: "Ingestion", exact: false },
];
