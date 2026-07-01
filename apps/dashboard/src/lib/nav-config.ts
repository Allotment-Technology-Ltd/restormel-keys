/**
 * Dashboard nav — north-star IA (docs/design/keys-northstar-redesign-2026-06.md §2.2),
 * collapsed to depth by Phase 3 Stage 6 ("the operator desk becomes depth").
 *
 * The verified-query product is the hero. The primary work nav now leads with the
 * four verified-query surfaces — Answer Console (home) · Sources/health · Traces ·
 * Keys & Routing — and the operator/audit desk (Home masthead · Runs · Claims/
 * Stamping · Prove-audit · Agents) is demoted into a collapsed "Operator" group:
 * still reachable when an answer is wrong or for an auditor, but no longer a
 * primary destination. The Connect hub stays dissolved — sections are intents,
 * not modules.
 */
import { DASHBOARD_BASE } from "$lib/dashboard-base";

import type { ModuleFlags } from "$lib/module-flags-types";

export type NavItem = {
  href: string;
  label: string;
};

export type NavGroupId = "operator" | "foundation" | "observe";

export type NavGroup = {
  id: NavGroupId;
  label: string;
  items: NavItem[];
  /** When false, group starts collapsed (persisted in localStorage). */
  defaultOpen?: boolean;
  /** Show coming-soon placeholder instead of nav links (Observe when monitor flag off). */
  comingSoon?: boolean;
};

// ── Canonical section URLs (redesign §2.2) ─────────────────────────────────
export const HOME_HREF = DASHBOARD_BASE + "/home";
export const SOURCES_HREF = DASHBOARD_BASE + "/sources";
/** The ingest guided flow (the relocated setup wizard — a flow, not a place; not in nav). */
export const INGEST_FLOW_HREF = SOURCES_HREF + "/ingest";
export const RUNS_HREF = DASHBOARD_BASE + "/runs";
export const CLAIMS_HREF = DASHBOARD_BASE + "/claims";
export const CLAIMS_MEMORY_HREF = CLAIMS_HREF + "/memory";
export const PROVE_HREF = DASHBOARD_BASE + "/prove";
export const AGENTS_HREF = DASHBOARD_BASE + "/agents";
export const TESTING_HUB_HREF = DASHBOARD_BASE + "/testing";
/** The per-stage ingest-routes view, rehomed under Routes (§2.3 `/connect/models` → MOVE). */
export const INGEST_ROUTES_HREF = DASHBOARD_BASE + "/routes/ingestion";
/** Phase 3 Stage 5 — Traces ("what my app actually asked"), promoted to a lead surface. */
export const TRACES_HREF = DASHBOARD_BASE + "/traces";
/** Gateway keys (the "Keys & Routing" lead surface; Routes lives under Foundation). */
export const ACCESS_HREF = DASHBOARD_BASE + "/access";
export const ROUTES_HREF = DASHBOARD_BASE + "/routes";

// ── RES-113 journey IA (REC-ADR-021 §1/§3/§5, docs/design/onboarding-handoff/02_IA_AND_NAV.md) ──
// These surface the M0–M4 learn-by-doing spine and are returned by the `resolve*`
// helpers below ONLY when the `onboardingJourney` module flag is ON. When the flag
// is OFF, the resolvers delegate to the north-star helpers and the live IA is
// byte-for-byte unchanged.
export const BUILD_HREF = DASHBOARD_BASE + "/build";
export const VERIFY_HREF = DASHBOARD_BASE + "/verify";
/** Connect (M4) hub — the bare `/connect` path (flag-aware redirect → the M4 wiring surface). */
export const CONNECT_HUB_HREF = DASHBOARD_BASE + "/connect";
/** The M4 ConnectWizard/ConnectionsManager surface (where `/connect` lands under the journey IA). */
export const AGENTS_WIRING_HREF = AGENTS_HREF + "/wiring";

/**
 * Phase 3 Stage 1 — the verified-query Answer Console (the Prove "Proof" tab).
 * North Star = verified answers at query time, so this is the dashboard's default
 * landing AND the first primary destination (Phase 3 Stage 6).
 */
export const ANSWER_CONSOLE_HREF = PROVE_HREF + "/proof";

/** Workspace landing (login + dashboard root). Phase 3 Stage 1: the Answer Console. */
export const WORKSPACE_HOME_HREF = ANSWER_CONSOLE_HREF;

/**
 * Primary work destinations (Phase 3 Stage 6) — lead with the verified-query
 * product surfaces. The operator/audit desk (Home, Runs, Claims, Prove, Agents)
 * is demoted to the collapsed "Operator" group below, not deleted.
 *  1. Answer Console — the hero (verified answers at query time).
 *  2. Sources — watched background sources + health (Stage 3).
 *  3. Traces — "what my app actually asked" (Stage 5).
 *  4. Keys & Routing — gateway keys + routes (the binding layer).
 */
export const WORK_NAV_ITEMS: NavItem[] = [
  { href: ANSWER_CONSOLE_HREF, label: "Answer Console" },
  { href: SOURCES_HREF, label: "Sources" },
  { href: TRACES_HREF, label: "Traces" },
  { href: ACCESS_HREF, label: "Keys & Routing" },
];

/** Testing keeps its own hub below the collapsed groups (§2.2). */
export const TESTING_NAV_ITEM: NavItem = { href: TESTING_HUB_HREF, label: "Testing" };

export const NAV_GROUPS: NavGroup[] = [
  {
    // Phase 3 Stage 6 — the operator / audit desk, demoted to depth. These are the
    // surfaces you reach when an answer is wrong, or for an auditor; not primary
    // destinations. Preserved in full (same spirit as the route builder kept as
    // "advanced"): demoted, never deleted.
    id: "operator",
    label: "Operator",
    defaultOpen: false,
    items: [
      { href: HOME_HREF, label: "Operator home" },
      { href: RUNS_HREF, label: "Runs" },
      { href: CLAIMS_HREF, label: "Stamping desk" },
      { href: PROVE_HREF, label: "Prove (audit)" },
      { href: AGENTS_HREF, label: "Agents" },
    ],
  },
  {
    id: "foundation",
    label: "Foundation",
    defaultOpen: false,
    items: [
      { href: DASHBOARD_BASE + "/integrations", label: "Connections" },
      { href: ROUTES_HREF, label: "Routes" },
      { href: DASHBOARD_BASE + "/policies", label: "Guard rails" },
      { href: DASHBOARD_BASE + "/projects", label: "Projects" },
      { href: DASHBOARD_BASE + "/models", label: "Model catalog" },
      { href: DASHBOARD_BASE + "/sandbox", label: "Request tester" },
    ],
  },
  {
    id: "observe",
    label: "Observe",
    defaultOpen: false,
    items: [
      // Traces is promoted to a primary work surface (Phase 3 Stage 6); Observe
      // keeps the operational telemetry below it.
      { href: DASHBOARD_BASE + "/logs", label: "Logs" },
      { href: DASHBOARD_BASE + "/analytics", label: "Usage" },
      { href: DASHBOARD_BASE + "/healthcheck", label: "Health" },
    ],
  },
];

/**
 * Phase 3 Stage 6 — the Answer Console (`/prove/proof`) and the demoted
 * Prove-audit desk (`/prove`) share a path prefix. The Answer Console owns the
 * `/prove/proof` subtree; Prove-audit owns the rest of `/prove`. This keeps the
 * top-level Answer Console highlight from also lighting up the Operator group.
 */
function matchesNavHref(pathname: string, href: string): boolean {
  if (href === PROVE_HREF) {
    // Prove-audit: everything under /prove EXCEPT the Answer Console subtree.
    if (pathname === ANSWER_CONSOLE_HREF || pathname.startsWith(ANSWER_CONSOLE_HREF + "/")) {
      return false;
    }
    return pathname === PROVE_HREF || pathname.startsWith(PROVE_HREF + "/");
  }
  return pathname === href || pathname.startsWith(href + "/");
}

/** Sidebar active state for primary work nav items (section prefixes). */
export function isWorkNavActive(pathname: string, href: string): boolean {
  if (href === TESTING_HUB_HREF) {
    return (
      pathname === TESTING_HUB_HREF ||
      pathname.startsWith(TESTING_HUB_HREF + "/") ||
      pathname === DASHBOARD_BASE + "/copy-for-ci"
    );
  }
  return matchesNavHref(pathname, href);
}

/** Whether a collapsible group contains the current path. */
export function navGroupContainsPath(group: NavGroup, pathname: string): boolean {
  return group.items.some((item) => matchesNavHref(pathname, item.href));
}

/** Initial expand state for collapsible sidebar groups. */
export function defaultNavGroupsOpen(): Record<NavGroupId, boolean> {
  return Object.fromEntries(
    NAV_GROUPS.map((g) => [g.id, g.defaultOpen !== false])
  ) as Record<NavGroupId, boolean>;
}

/**
 * Merge persisted localStorage with new group ids.
 * Legacy keys from older IAs migrate forward:
 *  - "keys" (Configure, pre-R2) and its ancestors "ready"/"build"/"connect" → foundation
 *  - "observe"/"monitor" → observe
 *  - "operator" is new in Phase 3 Stage 6 (the demoted desk); no legacy successor.
 * ("tools"/"embed"/"suite"/"quality" had no successor group — they are ignored.)
 */
export function hydrateNavGroupsOpen(stored: Record<string, unknown> | null): Record<NavGroupId, boolean> {
  const defaults = defaultNavGroupsOpen();
  if (!stored) return defaults;
  const bool = (key: string, fallback: boolean) =>
    typeof stored[key] === "boolean" ? (stored[key] as boolean) : fallback;

  const legacyFoundationOpen =
    stored.keys === true || stored.ready === true || stored.build === true || stored.connect === true;

  return {
    operator: bool("operator", defaults.operator),
    foundation: bool("foundation", legacyFoundationOpen ? true : defaults.foundation),
    observe: bool("observe", bool("monitor", defaults.observe)),
  };
}

const PATH_TO_TITLE: Record<string, string> = {
  [HOME_HREF]: "Operator home",
  [SOURCES_HREF]: "Sources",
  [INGEST_FLOW_HREF]: "Ingest",
  [RUNS_HREF]: "Runs",
  [CLAIMS_HREF]: "Stamping desk",
  [CLAIMS_MEMORY_HREF]: "Memory inbox",
  [ANSWER_CONSOLE_HREF]: "Answer Console",
  [PROVE_HREF]: "Prove",
  [AGENTS_HREF]: "Agents",
  [TRACES_HREF]: "Traces",
  [TESTING_HUB_HREF]: "Testing",
  [DASHBOARD_BASE + "/"]: "Home",
  [DASHBOARD_BASE + "/projects"]: "Projects",
  [DASHBOARD_BASE + "/copy-for-ci"]: "CI snippets",
  [DASHBOARD_BASE + "/access"]: "Gateway keys",
  [DASHBOARD_BASE + "/integrations"]: "Connections",
  [DASHBOARD_BASE + "/graph"]: "Graph",
  [DASHBOARD_BASE + "/dev-tools"]: "CLI & agents",
  [DASHBOARD_BASE + "/cli/connect"]: "Connect CLI",
  [DASHBOARD_BASE + "/models"]: "Model catalog",
  [DASHBOARD_BASE + "/healthcheck"]: "Health",
  [DASHBOARD_BASE + "/routes"]: "Routes",
  [INGEST_ROUTES_HREF]: "Ingest routes",
  [DASHBOARD_BASE + "/policies"]: "Guard rails",
  [DASHBOARD_BASE + "/analytics"]: "Usage",
  [DASHBOARD_BASE + "/logs"]: "Logs",
  [DASHBOARD_BASE + "/traces"]: "Traces",
  [DASHBOARD_BASE + "/sandbox"]: "Request tester",
  [DASHBOARD_BASE + "/settings"]: "Profile",
};

/** Title for topbar from pathname (exact match or segment). */
export function topbarTitle(pathname: string): string {
  if (PATH_TO_TITLE[pathname]) return PATH_TO_TITLE[pathname];
  if (pathname.startsWith(RUNS_HREF + "/")) {
    return "Run";
  }
  if (pathname.startsWith(DASHBOARD_BASE + "/projects/") && pathname.includes("/routes")) {
    if (pathname.endsWith("/routes")) return "Routes";
    return "Route";
  }
  if (pathname.startsWith(DASHBOARD_BASE + "/projects/") && pathname !== DASHBOARD_BASE + "/projects") {
    return "Project";
  }
  if (pathname.startsWith(DASHBOARD_BASE + "/integrations/") && pathname !== DASHBOARD_BASE + "/integrations") {
    return "Connection";
  }
  if (pathname.startsWith(DASHBOARD_BASE + "/dev-tools/") && pathname !== DASHBOARD_BASE + "/dev-tools") {
    return "CLI & agents";
  }
  if (pathname.startsWith(DASHBOARD_BASE + "/models/") && pathname !== DASHBOARD_BASE + "/models") {
    return "Model";
  }
  if (pathname.startsWith(DASHBOARD_BASE + "/policies/") && pathname !== DASHBOARD_BASE + "/policies") {
    return "Guard rail";
  }
  if (pathname.startsWith(DASHBOARD_BASE + "/cli/")) {
    return "Connect CLI";
  }
  return "";
}

/**
 * Filter primary work nav by suite module flags (Phase 3 Stage 6 lead surfaces).
 * Answer Console (the verified-query home) and Keys & Routing always show; the
 * verified-corpus surfaces (Sources, Traces) require the connect module.
 */
export function filterWorkNavForModuleFlags(flags: ModuleFlags): NavItem[] {
  const connectSections = new Set([SOURCES_HREF, TRACES_HREF]);
  return WORK_NAV_ITEMS.filter((item) => {
    if (connectSections.has(item.href)) return flags.connect;
    return true;
  });
}

/** Testing hub nav entry, gated by the testing module flag. */
export function filterTestingNavForModuleFlags(flags: ModuleFlags): NavItem | null {
  return flags.testing ? TESTING_NAV_ITEM : null;
}

/**
 * Hide guard-rails when module off; Observe shows coming soon when monitor off.
 * In the demoted Operator group (Phase 3 Stage 6) the Connect operator surfaces
 * (Runs, Stamping desk, Prove-audit, Agents) require the connect module; the
 * operator masthead (`/home`) always shows.
 */
export function filterNavGroupsForModuleFlags(groups: NavGroup[], flags: ModuleFlags): NavGroup[] {
  const operatorConnectSurfaces = new Set([RUNS_HREF, CLAIMS_HREF, PROVE_HREF, AGENTS_HREF]);
  return groups
    .map((g) => {
      if (g.id === "observe" && !flags.monitor) {
        return { ...g, items: [], comingSoon: true };
      }
      return {
        ...g,
        items: g.items.filter((item) => {
          if (item.href === DASHBOARD_BASE + "/policies") return flags.guardrails;
          if (g.id === "operator" && operatorConnectSurfaces.has(item.href)) return flags.connect;
          return true;
        }),
      };
    })
    .filter((g) => g.items.length > 0 || g.comingSoon);
}

// ── RES-113 journey IA — Home · Build · Verify · Connect (flag-gated) ─────────
//
// REC-ADR-021 §1/§3/§5 + docs/design/onboarding-handoff/02_IA_AND_NAV.md.
// Surfaced ONLY when the `onboardingJourney` module flag is ON (default OFF). The
// `resolve*` helpers below branch on that flag: OFF ⇒ they call the north-star
// helpers verbatim (live IA byte-for-byte unchanged); ON ⇒ they return the verb
// spine. This is the "one big flagged cut" — additive + reversible.

/**
 * Primary nav under the journey IA: the Build → Verify → Connect aha spine, hung
 * off a persistent Home (the landing). Runs fold into Build, Prove becomes a Home
 * action, Agents + gateway-keys fold into Connect (02_IA_AND_NAV.md §3).
 */
export const JOURNEY_NAV_ITEMS: NavItem[] = [
  { href: HOME_HREF, label: "Home" },
  { href: BUILD_HREF, label: "Build" },
  { href: VERIFY_HREF, label: "Verify" },
  { href: CONNECT_HUB_HREF, label: "Connect" },
];

/** Journey landing (login + dashboard root) = the persistent Home (REC-ADR-021 §3). */
export const JOURNEY_WORKSPACE_HOME_HREF = HOME_HREF;

/**
 * Settings / Advanced — everything tucked away under the journey IA (02_IA_AND_NAV.md §3).
 * Reuses the existing "foundation" group id (the config/advanced group) so the
 * localStorage open-state keying and `NavGroupId` type are unchanged; only the
 * label + items differ. The layout's `filterNavGroupsForDashboardUi` pass still
 * applies on top, so monitor-gated surfaces (Audit log, Metrics) stay hidden when
 * the monitor flag is off — no per-item flag logic needed here.
 */
export const JOURNEY_NAV_GROUPS: NavGroup[] = [
  {
    id: "foundation",
    label: "Settings",
    defaultOpen: false,
    items: [
      { href: DASHBOARD_BASE + "/integrations", label: "Providers" },
      { href: DASHBOARD_BASE + "/projects", label: "Store" },
      { href: ROUTES_HREF, label: "Routes" },
      { href: DASHBOARD_BASE + "/logs", label: "Audit log" },
      { href: DASHBOARD_BASE + "/analytics", label: "Metrics" },
    ],
  },
];

/**
 * Primary work nav, flag-resolved. OFF ⇒ the north-star four (verbatim). ON ⇒ the
 * journey verb spine; Build/Verify/Connect require the connect module (Home always
 * shows), mirroring how the north-star nav gates its verified-corpus surfaces.
 */
export function resolveWorkNavForModuleFlags(flags: ModuleFlags): NavItem[] {
  if (!flags.onboardingJourney) return filterWorkNavForModuleFlags(flags);
  const connectSpine = new Set([BUILD_HREF, VERIFY_HREF, CONNECT_HUB_HREF]);
  return JOURNEY_NAV_ITEMS.filter((item) => {
    if (connectSpine.has(item.href)) return flags.connect;
    return true;
  });
}

/**
 * Collapsible nav groups, flag-resolved. OFF ⇒ the north-star Operator/Foundation/
 * Observe groups (verbatim). ON ⇒ the single tucked-away Settings group.
 */
export function resolveNavGroupsForModuleFlags(flags: ModuleFlags): NavGroup[] {
  if (!flags.onboardingJourney) return filterNavGroupsForModuleFlags(NAV_GROUPS, flags);
  // The journey Settings group is static; the layout's dashboard-ui/monitor filter
  // pass handles per-surface visibility (e.g. Audit log / Metrics when monitor off).
  return JOURNEY_NAV_GROUPS.map((g) => ({ ...g, items: [...g.items] }));
}

/**
 * Testing hub nav entry, flag-resolved. The journey primary IA has no standalone
 * Testing destination (it folds into Settings/advanced), so ON ⇒ hidden; OFF ⇒ the
 * north-star behaviour (gated on the testing flag).
 */
export function resolveTestingNavForModuleFlags(flags: ModuleFlags): NavItem | null {
  if (flags.onboardingJourney) return null;
  return filterTestingNavForModuleFlags(flags);
}

/**
 * Workspace landing href, flag-resolved. OFF ⇒ the verified Answer Console
 * (north-star Phase 3 Stage 1). ON ⇒ the persistent journey Home (REC-ADR-021 §3).
 * Callers that decide the landing redirect read `moduleFlags` and pass them here.
 */
export function resolveWorkspaceHomeHref(flags: ModuleFlags): string {
  return flags.onboardingJourney ? JOURNEY_WORKSPACE_HOME_HREF : WORKSPACE_HOME_HREF;
}

// ── RES-113 PR-2 — state-derived journey nav (`resolveJourneyNav`) ────────────
//
// Plan §3.5 AFTER-state, implementing the founder's decisions (plan §4):
//   • STRIPPED / MINIMAL nav (§4.2): the mandatory spine (Home · Build · Connect)
//     is ALWAYS rendered; unreachable items render DIMMED with NO dots, NO inline
//     lock-reason text, NO Verify count badge. The reason string still travels on
//     each item (`lockReason`) for the click-through explanation — the reason lives
//     BEHIND the click, not in the chrome. This function returns the reason; the
//     shell decides to reveal it only on interaction.
//   • Verify (§4.4) enters per the ADR-020 trigger (flagged/low-trust claims) and is
//     MONOTONIC once shown — derived from a SERVER-derived "has ever shown" signal,
//     never client persistence (see `everHadVerifyActivity` below).
//   • Settings group incl. Store (§4.3) present FROM S1 (empty workspace) onward,
//     collapsed — reuses `JOURNEY_NAV_GROUPS` (the layout's monitor filter still
//     applies on top).
//   • Project switcher (§3.5 Mechanics) shown ONLY when `projectCount > 1`.
//
// This is used ONLY by the flag-ON branch. `resolveWorkNavForModuleFlags` and every
// flag-OFF path are untouched — flag-OFF byte-identity is preserved by construction.

/** A journey nav item with its reachability + the (chrome-free) click-through reason. */
export type JourneyNavItem = NavItem & {
  /**
   * False ⇒ render DIMMED (stripped-nav §4.2 — no inline reason, no dot). The shell
   * dims it and reveals `lockReason` only on click. True ⇒ normal reachable item.
   */
  reachable: boolean;
  /**
   * Why the item is unreachable — surfaced ONLY via the click-through explanation,
   * NEVER inline in the nav chrome (founder §4.2). Null when `reachable`.
   */
  lockReason: string | null;
};

/** The server-derived signals `resolveJourneyNav` needs (plan §3.5 Mechanics). */
export type JourneyNavSignals = {
  /** ≥1 completed ingest run (S2 gate — unlocks Connect). */
  completedRunCount: number;
  /** Idea/unit count (`> 0` ⇒ a graph is built — a second, robust "past empty" cue). */
  units: number;
  /** Live app connections (S4 — full spine, CTA becomes ask/prove). */
  connectionCount: number;
  /** Flagged claims awaiting triage RIGHT NOW (the ADR-020 forward Verify trigger). */
  flaggedClaimCount: number;
  /**
   * SERVER-derived "Verify has ever been warranted" — the monotonic anchor (§4.4).
   * True when any historical verify activity exists (e.g. a claim was ever flagged /
   * triaged / a make-ready pass ever ran), independent of whether anything is flagged
   * NOW. This is what makes the Verify tab persist once shown WITHOUT client
   * persistence. See the caller (`+layout.server.ts`) for how it is computed; when the
   * server cannot supply it, it falls back to `flaggedClaimCount > 0` (forward-only —
   * safe: the tab simply is not monotonic in that degraded case, never wrongly shown).
   */
  everHadVerifyActivity: boolean;
  /** Number of projects (switcher shows only when > 1). */
  projectCount: number;
};

export type JourneyNav = {
  /** The always-rendered spine + Verify (when shown), in order, with reachability. */
  items: JourneyNavItem[];
  /** The collapsed Settings group (present from S1) — reuses JOURNEY_NAV_GROUPS. */
  groups: NavGroup[];
  /** Whether the project switcher renders (projectCount > 1). */
  showProjectSwitcher: boolean;
  /** Whether the Verify item is present (monotonic — flagged now OR ever had activity). */
  showVerify: boolean;
};

/**
 * Journey-branch topbar titles (plan §3.5 Mechanics: `PATH_TO_TITLE` → "Home" +
 * verb titles). Overrides ONLY the spine paths for the flag-ON branch; every other
 * path falls back to the north-star `topbarTitle`. This is a separate map so the
 * flag-OFF `PATH_TO_TITLE` / `topbarTitle` stay byte-identical (Home is "Operator
 * home" on the flag-OFF path; "Home" only under the journey IA).
 */
const JOURNEY_PATH_TO_TITLE: Record<string, string> = {
  [HOME_HREF]: "Home",
  [BUILD_HREF]: "Build",
  [VERIFY_HREF]: "Verify",
  [CONNECT_HUB_HREF]: "Connect",
};

/**
 * Topbar title, flag-resolved. OFF ⇒ the north-star `topbarTitle` (byte-identical).
 * ON ⇒ the journey verb titles for the spine paths, falling back to `topbarTitle`
 * for everything else (Settings/advanced surfaces keep their existing titles).
 */
export function resolveJourneyTopbarTitle(pathname: string, flags: ModuleFlags): string {
  if (!flags.onboardingJourney) return topbarTitle(pathname);
  return JOURNEY_PATH_TO_TITLE[pathname] ?? topbarTitle(pathname);
}

/**
 * Whether the Verify tab shows — the MONOTONIC trigger (§4.4). Shown when Verify is
 * warranted NOW (`flaggedClaimCount > 0`) OR has EVER been warranted
 * (`everHadVerifyActivity`, server-derived). Monotonic without client persistence:
 * once any historical activity exists, the server signal stays true, so the tab does
 * not flicker as `flaggedClaimCount` oscillates.
 */
export function shouldShowVerifyTab(signals: JourneyNavSignals): boolean {
  return signals.flaggedClaimCount > 0 || signals.everHadVerifyActivity;
}

/**
 * Resolve the state-derived journey nav (flag-ON only). The mandatory spine is
 * ALWAYS present (never hidden); Build/Connect dim with a click-through reason when
 * unreachable; Verify enters monotonically. Pure + deterministic.
 *
 * Reachability (plan §3.5 States):
 *   • Home    — always reachable (the landing).
 *   • Build   — always reachable (M1 ingest is available from S1).
 *   • Verify  — present per `shouldShowVerifyTab`; reachable when present.
 *   • Connect — reachable once a graph exists (≥1 completed run OR units > 0);
 *               otherwise dimmed with "Build your graph first" behind the click.
 */
export function resolveJourneyNav(signals: JourneyNavSignals, flags: ModuleFlags): JourneyNav {
  const graphExists = signals.completedRunCount > 0 || signals.units > 0;
  const showVerify = shouldShowVerifyTab(signals);

  const items: JourneyNavItem[] = [
    { href: HOME_HREF, label: "Home", reachable: true, lockReason: null },
    { href: BUILD_HREF, label: "Build", reachable: true, lockReason: null },
  ];

  // Verify enters monotonically, between Build and Connect (verb-spine order).
  if (showVerify) {
    items.push({ href: VERIFY_HREF, label: "Verify", reachable: true, lockReason: null });
  }

  // Connect is ALWAYS rendered (never hidden — §3.5 "Explicitly rejected: hiding
  // Connect pre-ingest"); dimmed with a click-through reason until a graph exists.
  items.push({
    href: CONNECT_HUB_HREF,
    label: "Connect",
    reachable: graphExists,
    lockReason: graphExists ? null : "Build your graph first — there is nothing to connect yet.",
  });

  // Settings (incl. Store) present from S1, collapsed — reuse the flag-ON groups.
  // The layout's dashboard-ui/monitor filter still applies on top (Audit log / Metrics).
  const groups = resolveNavGroupsForModuleFlags(flags);

  return {
    items,
    groups,
    showProjectSwitcher: signals.projectCount > 1,
    showVerify,
  };
}
