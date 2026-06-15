/**
 * Policy for server-side connections to workspace-configured Surreal endpoints (SSRF mitigation).
 * Accepts https/wss (secure) and http/ws (insecure). Local dev may use http/ws on localhost;
 * production requires a secure endpoint (https:// or wss://) and blocks private/metadata targets.
 *
 * This is now a thin wrapper over the shared outbound-URL guard
 * (`outbound-url-guard.ts`, the generalised egress allow-list, REC-PLAN-010 §B2).
 * The block-list / scheme rules live in ONE place; this keeps only the
 * Surreal-specific error wording via the `"surreal"` family. The Surreal family
 * accepts the SurrealDB scheme set — http/https for the HTTP API and ws/wss for
 * the native WebSocket protocol (PR #57): production requires a secure scheme
 * (https/wss); cleartext (http/ws) is allowed in dev only to localhost. Do NOT
 * re-implement the IP/host/scheme checks here — extend the shared guard so there
 * is exactly ONE validator.
 */
import { validateOutboundUrl } from "$lib/server/connect/outbound-url-guard";

export function validateOutboundSurrealEndpoint(
  endpoint: string,
): { ok: true } | { ok: false; message: string } {
  return validateOutboundUrl(endpoint, "surreal");
}
