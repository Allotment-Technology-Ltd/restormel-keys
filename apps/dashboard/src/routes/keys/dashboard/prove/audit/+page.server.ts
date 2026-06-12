/**
 * R5: Prove / Audit tab — moved from /access/audit (D5 approved).
 * Audit log is a proof artefact (ux-contracts §2 registry). Key and config changes
 * are part of the evidentiary chain an external auditor would examine.
 * /access/audit now 308-redirects here; the /access deep link is preserved.
 */
import type { PageServerLoad } from "./$types";
import { getOrCreateDefaultWorkspace, listAuditEvents } from "$lib/server/db";

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.user || locals.user.authType === "gateway_key") {
    return { events: [], error: null as string | null };
  }
  try {
    let workspaceId: string;
    if (locals.user.authType === "management_key" && locals.user.workspaceId) {
      workspaceId = locals.user.workspaceId;
    } else {
      const workspace = await getOrCreateDefaultWorkspace(locals.user.uid);
      workspaceId = workspace.id;
    }
    const events = await listAuditEvents(workspaceId, { limit: 50 });
    return { events, error: null };
  } catch (e) {
    console.error("[prove/audit] load failed:", e);
    return { events: [], error: "Unable to load audit log" };
  }
};
