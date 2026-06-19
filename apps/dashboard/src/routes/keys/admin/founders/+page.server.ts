import type { PageServerLoad } from "./$types";
import { listFoundersAccessForAdmin } from "$lib/server/founders-access";
import { getLastFoundersSendsFor, type FoundersSendStatus } from "$lib/server/email/email-send-log";
import { normalizeEmailForServiceOwnerMatch } from "$lib/server/service-admin";
import { requireServiceAdminSession } from "$lib/server/session-user";

export type FoundersSendStatusBrief = {
  category: FoundersSendStatus["category"];
  success: boolean;
  errorReason: string | null;
  sentAtMs: number;
};

export const load: PageServerLoad = async ({ locals }) => {
  // W4.6a SECURITY: defense-in-depth — never serialize founders access requests under
  // degraded/forged auth even if the layout gate were ever changed.
  requireServiceAdminSession(locals);
  let rows: Awaited<ReturnType<typeof listFoundersAccessForAdmin>> = [];
  let loadError: string | null = null;
  try {
    rows = await listFoundersAccessForAdmin();
  } catch {
    loadError = "Could not load Founders Circle access requests.";
  }

  // Per-applicant last email send status (fail-safe — never blocks the page). Keyed by the
  // normalised email so the client can join it onto each row. We deliberately DROP the
  // message-id (operator only needs sent/failed + when + why) to keep the page payload lean.
  const sendStatus: Record<string, FoundersSendStatusBrief> = {};
  try {
    const statuses = await getLastFoundersSendsFor(rows.map((r) => r.email));
    for (const r of rows) {
      const key = normalizeEmailForServiceOwnerMatch(r.email);
      if (!key) continue;
      const s = statuses.get(key);
      if (s) {
        sendStatus[r.email] = {
          category: s.category,
          success: s.success,
          errorReason: s.errorReason,
          sentAtMs: s.sentAtMs,
        };
      }
    }
  } catch {
    /* send-status is best-effort surface; the page is fine without it */
  }

  return { foundersAccess: rows, foundersLoadError: loadError, sendStatus };
};
