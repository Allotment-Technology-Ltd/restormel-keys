import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { listUsersForServiceOwnerAdmin } from "$lib/server/admin-users";

export const config = { runtime: "nodejs20.x" as const };

export const GET: RequestHandler = async ({ locals }) => {
  const u = locals.user;
  if (!u || u.authType !== "session" || !u.isServiceAdmin) {
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
