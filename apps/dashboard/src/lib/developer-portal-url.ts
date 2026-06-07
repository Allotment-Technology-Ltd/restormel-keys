/**
 * Canonical API reference (Scalar, rendered from the live OpenAPI spec), served
 * in-site at /keys/docs/api-reference. Previously the Zuplo-hosted zudoku portal,
 * which is retired as a docs surface. Override with PUBLIC_KEYS_DEVELOPER_PORTAL_URL
 * only if the reference is ever hosted elsewhere.
 */
export function developerPortalUrl(): string {
  const raw = import.meta.env.PUBLIC_KEYS_DEVELOPER_PORTAL_URL;
  if (typeof raw === "string" && raw.trim()) return raw.trim().replace(/\/$/, "");
  return "/keys/docs/api-reference";
}
