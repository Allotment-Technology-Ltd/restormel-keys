import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { listUsersForServiceOwnerAdmin } from "$lib/server/admin-users";
import { sessionUser } from "$lib/server/session-user";

export const config = { runtime: "nodejs22.x" as const };

export const GET: RequestHandler = async ({ locals }) => {
  const u = sessionUser(locals);
  if (!u || !u.isServiceAdmin) {
    return json({ error: "forbidden" }, { status: 403 });
  }
  try {
    const users = await listUsersForServiceOwnerAdmin();
    return json({ users });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "load_failed";
    return json({ error: "load_failed", message: msg.slice(0, 120) }, { status: 500 });
  }
};
