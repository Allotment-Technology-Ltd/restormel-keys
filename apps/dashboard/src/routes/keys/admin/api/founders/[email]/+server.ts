import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { setFoundersAccessStatus, type FoundersAccessStatus } from "$lib/server/founders-access";
import { invalidateSessionAuthCache } from "$lib/server/session-auth-cache";
import { sessionUser } from "$lib/server/session-user";

export const config = { runtime: "nodejs22.x" as const };

type Body = { status?: FoundersAccessStatus };

export const PATCH: RequestHandler = async ({ locals, params, request }) => {
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

  return json({ ok: true });
};
