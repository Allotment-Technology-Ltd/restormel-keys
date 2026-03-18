import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

const ISSUER = "https://restormel.dev/keys/auth";

export const GET: RequestHandler = async () => {
  return json({
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
  });
};

