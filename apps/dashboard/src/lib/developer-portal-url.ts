/**
 * Zuplo-hosted Developer Portal (Gateway API reference, Try it, consumer key).
 * Set PUBLIC_KEYS_DEVELOPER_PORTAL_URL in env if the portal host changes.
 */
export function developerPortalUrl(): string {
  const raw = import.meta.env.PUBLIC_KEYS_DEVELOPER_PORTAL_URL;
  if (typeof raw === "string" && raw.trim()) return raw.trim().replace(/\/$/, "");
  return "https://restormel-keys-gateway-main-bc13eba.zuplo.site";
}
