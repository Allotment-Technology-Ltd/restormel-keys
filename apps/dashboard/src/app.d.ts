declare global {
  interface Window {
    posthog?: {
      init?: (apiKey: string, opts?: Record<string, unknown>) => void;
      capture?: (event: string, props?: Record<string, unknown>) => void;
    };
    rmCapture?: (event: string, props?: Record<string, unknown>) => void;
  }

  namespace App {
    interface Locals {
      user?: {
        uid: string;
        email?: string | null;
        /** When set, request was authenticated via Bearer key (Gateway or Management), not session. */
        authType?: "session" | "gateway_key" | "management_key";
        /** Only set when authType === "gateway_key": restricts API access to this project. */
        projectIdForKey?: string;
        /** Set when authType is gateway_key or management_key (key id, for audit). */
        keyId?: string;
        /** Only set when authType === "management_key": workspace-scoped access. */
        workspaceId?: string;
      };
    }
    interface PageData {
      user?: { uid: string; email?: string | null };
    }
    interface LayoutData {
      dashboardUiHidden?: import("$lib/dashboard-ui-sections").DashboardUiSection[];
      navGroupsForUi?: import("$lib/nav-config").NavGroup[];
      dashboardUiHiddenBanner?: { section: string; label: string } | null;
    }
    // interface Error {}
    // interface Platform {}
  }
}

export {};
