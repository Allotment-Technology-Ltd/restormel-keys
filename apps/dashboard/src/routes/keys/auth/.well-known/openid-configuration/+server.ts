import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { portalCorsHeaders, withPortalCors } from "$lib/server/portal-cors";

const ISSUER = "https://restormel.dev/keys/auth";

export const GET: RequestHandler = async ({ request }) => {
  const cors = portalCorsHeaders(request);
  return json(
    {
    issuer: ISSUER,
    authorization_endpoint: `${ISSUER}/authorize`,
    token_endpoint: `${ISSUER}/token`,
    jwks_uri: `${ISSUER}/jwks`,
    userinfo_endpoint: `${ISSUER}/userinfo`,
    response_types_supported: ["code"],
    subject_types_supported: ["public"],
    id_token_signing_alg_values_supported: ["RS256"],
    scopes_supported: ["openid", "profile", "email"],
    token_endpoint_auth_methods_supported: ["none"],
    claims_supported: ["sub", "email", "name", "picture"],
    },
    withPortalCors({}, cors)
  );
};

export const OPTIONS: RequestHandler = async ({ request }) => {
  const cors = portalCorsHeaders(request);
  if (!cors) return new Response(null, { status: 204 });
  return new Response(null, withPortalCors({ status: 204 }, cors));
};

