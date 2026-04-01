import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { pollCliDeviceSession } from "$lib/server/cli-device-sessions";

export const POST: RequestHandler = async ({ request }) => {
  let device_code = "";
  try {
    const body = (await request.json()) as { device_code?: string };
    device_code = typeof body.device_code === "string" ? body.device_code : "";
  } catch {
    return json({ error: "invalid_request" }, { status: 400 });
  }
  if (!device_code) return json({ error: "invalid_request" }, { status: 400 });

  const r = await pollCliDeviceSession(device_code);
  if ("error" in r) {
    return json({ error: r.error }, { status: 400 });
  }
  return json({
    access_token: r.accessToken,
    token_type: r.tokenType,
    project_id: r.projectId,
    key_prefix: r.keyPrefix,
  });
};
