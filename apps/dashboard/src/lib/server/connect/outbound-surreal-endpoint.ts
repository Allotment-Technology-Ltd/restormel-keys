/**
 * Policy for server-side fetch to workspace-configured Surreal HTTP endpoints (SSRF mitigation).
 * Local dev may use http://localhost; production requires HTTPS and blocks private/metadata targets.
 *
 * This is now a thin wrapper over the shared outbound-URL guard
 * (`outbound-url-guard.ts`, the generalised egress allow-list, REC-PLAN-010 §B2).
 * The block-list / scheme rules live in one place; this keeps the Surreal-specific
 * error wording and the http/https-only scheme family. Do NOT re-implement the
 * IP/host checks here — extend the shared guard.
 */
import { validateOutboundUrl } from "$lib/server/connect/outbound-url-guard";

export function validateOutboundSurrealEndpoint(
  endpoint: string,
): { ok: true } | { ok: false; message: string } {
  return validateOutboundUrl(endpoint, "surreal");
}
