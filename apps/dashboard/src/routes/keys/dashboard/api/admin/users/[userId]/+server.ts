import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { setUserServiceOwnerMembership } from "$lib/server/admin-users";

export const config = { runtime: "nodejs20.x" as const };

type Body = { serviceOwner?: boolean };

export const PATCH: RequestHandler = async ({ locals, params, request }) => {
  const u = locals.user;
  if (!u || u.authType !== "session" || !u.isServiceAdmin) {
    return json({ error: "forbidden" }, { status: 403 });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return json({ error: "invalid_json" }, { status: 400 });
  }
  if (typeof body.serviceOwner !== "boolean") {
    return json({ error: "serviceOwner_boolean_required" }, { status: 400 });
  }

  const targetUserId = params.userId;
  if (!targetUserId) {
    return json({ error: "missing_user_id" }, { status: 400 });
  }

  const result = await setUserServiceOwnerMembership({
    actorUserId: u.uid,
    targetUserId,
    enabled: body.serviceOwner,
  });

  if (!result.ok) {
    const status =
      result.code === "not_found"
        ? 404
        : result.code === "db_error"
          ? 500
          : 403;
    return json({ error: result.code, message: result.message }, { status });
  }

  return json({ ok: true });
};
