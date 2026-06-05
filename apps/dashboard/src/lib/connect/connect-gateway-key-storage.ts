/**
 * Browser session handoff when a Gateway key was just created (Access or MCP)
 * before navigating to MCP setup — Restormel never persists raw keys server-side.
 */

export const RK_PENDING_GATEWAY_KEY_SESSION = "rk_pending_gateway_key_session";

/** Neon issues rk_ + 24 base64url chars (27 characters total). */
export const GATEWAY_KEY_MIN_LENGTH = 27;

export type PendingGatewayKeySession = {
  keyId: string;
  rawKey: string;
  keyPrefix: string;
  projectId: string;
  savedAt: number;
};

export function isGatewayKeyShape(value: string): boolean {
  const v = value.trim();
  return (
    v.startsWith("rk_") && v.length >= GATEWAY_KEY_MIN_LENGTH && /^rk_[A-Za-z0-9_-]+$/.test(v)
  );
}

export function savePendingGatewayKeySession(entry: PendingGatewayKeySession): void {
  if (typeof sessionStorage === "undefined" || !entry.keyId || !isGatewayKeyShape(entry.rawKey)) return;
  sessionStorage.setItem(RK_PENDING_GATEWAY_KEY_SESSION, JSON.stringify(entry));
}

/** Read and clear the pending key from this browser tab session (create → MCP navigation). */
export function consumePendingGatewayKeySession(): PendingGatewayKeySession | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(RK_PENDING_GATEWAY_KEY_SESSION);
    sessionStorage.removeItem(RK_PENDING_GATEWAY_KEY_SESSION);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingGatewayKeySession;
    if (!parsed?.keyId || !isGatewayKeyShape(parsed.rawKey)) return null;
    return parsed;
  } catch {
    return null;
  }
}
