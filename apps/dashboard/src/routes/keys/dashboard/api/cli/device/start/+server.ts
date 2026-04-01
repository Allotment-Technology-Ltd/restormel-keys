import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { startCliDeviceSession } from "$lib/server/cli-device-sessions";
import { DASHBOARD_BASE } from "$lib/dashboard-base";

function clientIp(request: Request): string | null {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]?.trim() || null;
  return null;
}

export const POST: RequestHandler = async ({ request, url }) => {
  const ct = request.headers.get("content-type") ?? "";
  if (ct.includes("application/json")) {
    await request.json().catch(() => ({}));
  }
  const ip = clientIp(request);
  const result = await startCliDeviceSession(ip);
  if ("error" in result) {
    if (result.error === "rate_limited") {
      return json({ error: "rate_limited", error_description: "Too many device sessions from this network" }, { status: 429 });
    }
    return json({ error: "server_error", error_description: result.error }, { status: 503 });
  }
  const verificationUri = `${url.origin}${DASHBOARD_BASE}/cli/connect`;
  return json({
    device_code: result.deviceCode,
    user_code: result.userCode,
    verification_uri: verificationUri,
    verification_uri_complete: `${verificationUri}?user_code=${encodeURIComponent(result.userCode)}`,
    expires_in: result.expiresIn,
    interval: result.interval,
  });
};
