interface ImportMetaEnv {
  readonly PUBLIC_GITHUB_REPO_URL?: string;
  readonly PUBLIC_SUITE_TESTING_URL?: string;
  /** When `"false"`, hide Restormel Support FAB for signed-in users (default: show). */
  readonly PUBLIC_RESTORMEL_SUPPORT_UI?: string;
}

declare global {
  interface Window {
    posthog?: {
      init?: (apiKey: string, opts?: Record<string, unknown>) => void;
      capture?: (event: string, props?: Record<string, unknown>) => void;
    };
    rmCapture?: (event: string, props?: Record<string, unknown>) => void;
    /** Dev-only: dump client debug ring buffer (`reportClientDebug` / hooks). */
    __rmClientDebugDump?: () => unknown[];
  }

  namespace App {
    interface Locals {
      user?: {
        uid: string;
        email?: string | null;
        name?: string | null;
        /** When set, request was authenticated via Bearer key (Gateway or Management), not session. */
        authType?: "session" | "gateway_key" | "management_key";
        /** Service operator (Allotment): plan limits and Pro gates waived; not end-customer RBAC. */
        isServiceAdmin?: boolean;
        /** Founders Circle approved (or service operator). Session auth only. */
        foundersCircleApproved?: boolean;
        /** Only set when authType === "gateway_key": restricts API access to this project. */
        projectIdForKey?: string;
        /** Set when authType is gateway_key or management_key (key id, for audit). */
        keyId?: string;
        /** Only set when authType === "management_key": workspace-scoped access. */
        workspaceId?: string;
      };
      /**
       * W4.6a — true when a request carried a session cookie but Neon Auth verification
       * could NOT complete (5xx / 429-with-no-cache / network throw / unexpected throw in
       * the auth pipeline). Distinct from "genuinely signed out" (`!user && !authDegraded`).
       * Loads/pages render an auth-degraded retry state for this, never the signed-out CTA.
       */
      authDegraded?: boolean;
      /** Suite module flags (PostHog + env override). */
      moduleFlags?: import("$lib/module-flags-types").ModuleFlags;
      /**
       * Per-request stats memo: a single Promise<ConnectGraphStatsView | null> shared
       * across all streamed loads within one hub page request (pulse + scorecard + any
       * other consumer). Keyed by workspaceId so a multi-tenant request never mixes
       * results. Populated by the first caller of resolveConnectGraphStats; subsequent
       * callers within the same request reuse it without a second store scan.
       */
      connectStatsRequestMemo?: Map<
        string,
        Promise<import("$lib/server/connect/graph-explorer-service").ConnectGraphStatsView | null>
      >;
    }
    interface PageData {
      user?: {
        uid: string;
        email?: string | null;
        name?: string | null;
        authType?: "session" | "gateway_key" | "management_key";
        isServiceAdmin?: boolean;
        /** Founders Circle approved (or service operator). Session auth only. */
        foundersCircleApproved?: boolean;
      };
    }
    interface LayoutData {
      /** Session or key auth from root layout load (passed to SupportAssistant; avoid `$page` in that child). */
      user?: PageData["user"];
      /**
       * W4.6a — Neon Auth verification could not complete for a cookie-bearing request.
       * The shell renders an auth-degraded banner (retry, not the signed-out CTA) so it
       * does not contradict a page that is showing its own degraded/retry state.
       */
      authDegraded?: boolean;
      /** GitHub stars + summed npm downloads (30d); null when skipped, failed, or zero. Cached 1h server-side. */
      socialProof?: import("$lib/social-proof").SocialProofMetrics | null;
      dashboardUiHidden?: import("$lib/dashboard-ui-sections").DashboardUiSection[];
      navGroupsForUi?: import("$lib/nav-config").NavGroup[];
      dashboardUiHiddenBanner?: { section: string; label: string } | null;
      /** Integration + Gateway key counts for contextual “next step” hints (Keys dashboard). */
      journeySignals?: { integrationCount: number; gatewayKeyCount: number } | null;
      /** Resolved suite module flags (server). */
      moduleFlags?: import("$lib/module-flags-types").ModuleFlags;
      /** Suite modules visible for current flags (marketing). */
      suiteModulesForUi?: import("$lib/suite/suite-modules").SuiteModule[];
      /** Filtered primary work nav (Keys dashboard). */
      workNavForUi?: import("$lib/nav-config").NavItem[];
      /** Testing hub nav entry (below the collapsed groups), null when module off. */
      testingNavForUi?: import("$lib/nav-config").NavItem | null;
      /** Graph marketing preview banner when graph module is preview-only. */
      graphModulePreview?: boolean;
    }
    // interface Error {}
    // interface Platform {}
  }
}

export {};
