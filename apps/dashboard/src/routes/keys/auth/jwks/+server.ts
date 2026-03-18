import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { jwksFromPublicKey } from "$lib/server/oidc";
import { portalCorsHeaders, withPortalCors } from "$lib/server/portal-cors";

export const GET: RequestHandler = async ({ request }) => {
  const cors = portalCorsHeaders(request);
  try {
    const { keys } = jwksFromPublicKey();
    return json(
      { keys },
      withPortalCors({ headers: { "cache-control": "public, max-age=3600" } }, cors)
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unable to load JWKS";
    return json({ error: "jwks_unavailable", detail: msg }, withPortalCors({ status: 500 }, cors));
  }
};

export const OPTIONS: RequestHandler = async ({ request }) => {
  const cors = portalCorsHeaders(request);
  if (!cors) return new Response(null, { status: 204 });
  return new Response(null, withPortalCors({ status: 204 }, cors));
};

