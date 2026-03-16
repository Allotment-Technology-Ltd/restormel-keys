declare global {
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
    // interface Error {}
    // interface Platform {}
  }
}

export {};
