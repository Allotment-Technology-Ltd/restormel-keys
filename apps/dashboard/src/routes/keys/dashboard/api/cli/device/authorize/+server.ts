import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { authorizeCliDeviceSession } from "$lib/server/cli-device-sessions";

export const POST: RequestHandler = async ({ request, locals }) => {
  if (!locals.user?.uid) return json({ error: "Unauthorized" }, { status: 401 });
  if (locals.user.authType === "gateway_key" || locals.user.authType === "management_key") {
    return json({ error: "Forbidden" }, { status: 403 });
  }
  let userCode = "";
  let projectId = "";
  try {
    const body = (await request.json()) as { userCode?: string; projectId?: string };
    userCode = typeof body.userCode === "string" ? body.userCode : "";
    projectId = typeof body.projectId === "string" ? body.projectId : "";
  } catch {
    return json({ error: "invalid_request" }, { status: 400 });
  }
  if (!projectId) return json({ error: "invalid_request" }, { status: 400 });

  const result = await authorizeCliDeviceSession(userCode, locals.user.uid, projectId);
  if (!result.ok) {
    const status =
      result.error === "forbidden"
        ? 403
        : result.error === "session_race" || result.error === "key_create_failed"
          ? 409
          : 400;
    return json({ error: result.error }, { status });
  }
  return json({ ok: true });
};
