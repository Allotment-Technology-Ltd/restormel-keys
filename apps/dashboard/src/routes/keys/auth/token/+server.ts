import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { verifyJwtRs256 } from "$lib/server/oidc";
import { portalCorsHeaders, withPortalCors } from "$lib/server/portal-cors";

export const POST: RequestHandler = async ({ request }) => {
  const cors = portalCorsHeaders(request, { allowMethods: ["POST", "OPTIONS"] });
  const body = await request.formData().catch(() => null);
  const code = body?.get("code");
  if (typeof code !== "string") return json({ error: "invalid_request" }, withPortalCors({ status: 400 }, cors));

  try {
    const { payload } = verifyJwtRs256(code);
    const now = Math.floor(Date.now() / 1000);
    const exp = typeof payload?.exp === "number" ? payload.exp : now + 3600;
    const expires_in = Math.max(1, exp - now);
    return json(
      {
      access_token: code,
      id_token: code,
      token_type: "Bearer",
      expires_in,
      },
      withPortalCors({}, cors)
    );
  } catch {
    return json({ error: "invalid_grant" }, withPortalCors({ status: 400 }, cors));
  }
};

export const OPTIONS: RequestHandler = async ({ request }) => {
  const cors = portalCorsHeaders(request, { allowMethods: ["POST", "OPTIONS"] });
  if (!cors) return new Response(null, { status: 204 });
  return new Response(null, withPortalCors({ status: 204 }, cors));
};

