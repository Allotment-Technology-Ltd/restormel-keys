/**
 * Bearer token extraction for API auth. Used by hooks to resolve Gateway/Management keys.
 * No secrets or raw keys logged; parse only.
 */

export function getBearerToken(request: Request): string | null {
  const auth = request.headers.get("Authorization");
  if (!auth || !auth.startsWith("Bearer ")) return null;
  const token = auth.slice(7).trim();
  return token || null;
}
