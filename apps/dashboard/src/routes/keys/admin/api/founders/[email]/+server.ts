import { json } from "@sveltejs/kit";
import { env as publicEnv } from "$env/dynamic/public";
import type { RequestHandler } from "./$types";
import {
  setFoundersAccessStatus,
  deleteFoundersAccess,
  type FoundersAccessStatus,
} from "$lib/server/founders-access";
import { sendFoundersApprovedEmail } from "$lib/server/email/founders-approved-email";
import { sendFoundersRejectedEmail } from "$lib/server/email/founders-rejected-email";
import { sendFoundersDeletedEmail } from "$lib/server/email/founders-deleted-email";
import { invalidateSessionAuthCache } from "$lib/server/session-auth-cache";
import { sessionUser } from "$lib/server/session-user";
import { DASHBOARD_BASE } from "$lib/dashboard-base";

export const config = { runtime: "nodejs22.x" as const };

type Body = { status?: FoundersAccessStatus };

function dashboardUrl(origin: string): string {
  const override = (publicEnv.PUBLIC_KEYS_DASHBOARD_URL ?? "").trim();
  return override || `${origin}${DASHBOARD_BASE}`;
}

export const PATCH: RequestHandler = async ({ locals, params, request, url }) => {
  const u = sessionUser(locals);
  if (!u || !u.isServiceAdmin) {
    return json({ error: "forbidden" }, { status: 403 });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return json({ error: "invalid_json" }, { status: 400 });
  }

  const status = body.status;
  if (status !== "approved" && status !== "rejected" && status !== "pending") {
    return json({ error: "invalid_status" }, { status: 400 });
  }

  const email = decodeURIComponent(params.email ?? "");
  if (!email) {
    return json({ error: "missing_email" }, { status: 400 });
  }

  const result = await setFoundersAccessStatus({
    email,
    status,
    reviewerUserId: u.uid,
  });

  if (!result.ok) {
    return json(
      { error: result.code, message: result.message },
      { status: result.code === "not_found" ? 404 : 500 }
    );
  }

  // Status changed by email (uid unknown here): drop all memoized hook auth statuses
  // so the grant/revoke applies on the affected user's next request, as before.
  invalidateSessionAuthCache();

  // Notify the applicant their access is approved. FAIL-OPEN: the grant is already
  // committed, so an email/SMTP failure must never fail this request or surface as an
  // operator error — log and continue. Only fires on approve.
  if (status === "approved") {
    try {
      await sendFoundersApprovedEmail({
        to: result.email,
        name: result.applicantName,
        dashboardUrl: dashboardUrl(url.origin),
      });
    } catch (e) {
      // Log only an opaque error code/name — an SMTP error message can echo the recipient
      // address (PII per the security baseline: Founders Circle data must not hit logs).
      const code =
        (e as { code?: string })?.code ?? (e instanceof Error ? e.name : "unknown");
      console.error("[founders-approved-email] send failed:", String(code).slice(0, 40));
    }
  } else if (status === "rejected") {
    // Notify the applicant they weren't approved. FAIL-OPEN, same as approve: the status
    // change is already committed, so an email/SMTP failure must never fail this request.
    try {
      await sendFoundersRejectedEmail({
        to: result.email,
        name: result.applicantName,
      });
    } catch (e) {
      const code =
        (e as { code?: string })?.code ?? (e instanceof Error ? e.name : "unknown");
      console.error("[founders-rejected-email] send failed:", String(code).slice(0, 40));
    }
  }

  return json({ ok: true });
};

export const DELETE: RequestHandler = async ({ locals, params, url }) => {
  const u = sessionUser(locals);
  if (!u || !u.isServiceAdmin) {
    return json({ error: "forbidden" }, { status: 403 });
  }

  const email = decodeURIComponent(params.email ?? "");
  if (!email) {
    return json({ error: "missing_email" }, { status: 400 });
  }

  // Default is SILENT — deleting test/spam entries shouldn't email anyone. The operator
  // opts in to notifying the applicant via ?notify=1.
  const notify = url.searchParams.get("notify") === "1";

  const result = await deleteFoundersAccess(email);
  if (!result.ok) {
    return json(
      { error: result.code, message: result.message },
      { status: result.code === "not_found" ? 404 : 500 }
    );
  }

  // The row is gone: drop all memoized hook auth statuses so any access this email had is
  // revoked on the affected user's next request.
  invalidateSessionAuthCache();

  // Only notify when the operator opted in. FAIL-OPEN: the delete is already committed, so
  // an email/SMTP failure must never fail this request or surface as an operator error.
  if (notify) {
    try {
      await sendFoundersDeletedEmail({
        to: result.email,
        name: result.applicantName,
      });
    } catch (e) {
      // Log only an opaque error code/name — an SMTP error message can echo the recipient
      // address (PII per the security baseline: Founders Circle data must not hit logs).
      const code =
        (e as { code?: string })?.code ?? (e instanceof Error ? e.name : "unknown");
      console.error("[founders-deleted-email] send failed:", String(code).slice(0, 40));
    }
  }

  return json({ ok: true });
};
