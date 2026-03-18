/**
 * JWT `aud` must match Zudoku's configured OpenID clientId exactly.
 * Zudoku sends `client_id` on /authorize; we mirror it into the signed token.
 */
const CLIENT_ID_RE = /^[a-zA-Z0-9._-]{1,128}$/;

export function isValidOidcClientId(value: string | null | undefined): value is string {
  return typeof value === "string" && CLIENT_ID_RE.test(value.trim());
}

/** Audience for portal JWT: OAuth client_id from request, else env, else Zuplo doc default. */
export function resolvePortalJwtAudience(clientIdFromOAuth: string | null | undefined): string {
  const fromOAuth = clientIdFromOAuth?.trim() ?? "";
  if (isValidOidcClientId(fromOAuth)) return fromOAuth;
  const configured = process.env.RESTORMEL_OIDC_CLIENT_ID?.trim() ?? "";
  if (isValidOidcClientId(configured)) return configured;
  return "restormel-keys-portal";
}
