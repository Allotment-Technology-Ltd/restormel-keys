import { json } from "@sveltejs/kit";
import { env as publicEnv } from "$env/dynamic/public";
import type { RequestHandler } from "./$types";
import { setFoundersAccessStatus, type FoundersAccessStatus } from "$lib/server/founders-access";
import { sendFoundersApprovedEmail } from "$lib/server/email/founders-approved-email";
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
  }

  return json({ ok: true });
};
