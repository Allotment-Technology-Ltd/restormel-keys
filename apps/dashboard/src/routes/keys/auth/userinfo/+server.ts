import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { verifyJwtRs256 } from "$lib/server/oidc";
import { portalCorsHeaders, withPortalCors } from "$lib/server/portal-cors";

export const GET: RequestHandler = async ({ request }) => {
  const cors = portalCorsHeaders(request, { allowMethods: ["GET", "OPTIONS"] });
  const auth = request.headers.get("authorization") ?? "";
  const token = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
  if (!token) return json({ error: "unauthorized" }, withPortalCors({ status: 401 }, cors));

  try {
    const { payload } = verifyJwtRs256(token);
    return json(
      {
      sub: payload.sub,
      email: payload.email,
      name: payload.name,
      picture: payload.picture,
      },
      withPortalCors({}, cors)
    );
  } catch {
    return json({ error: "unauthorized" }, withPortalCors({ status: 401 }, cors));
  }
};

export const OPTIONS: RequestHandler = async ({ request }) => {
  const cors = portalCorsHeaders(request, { allowMethods: ["GET", "OPTIONS"] });
  if (!cors) return new Response(null, { status: 204 });
  return new Response(null, withPortalCors({ status: 204 }, cors));
};

