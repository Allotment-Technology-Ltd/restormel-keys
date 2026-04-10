/**
 * Outbound workspace webhooks (MVP). Payloads contain no secrets; signing uses HMAC-SHA256.
 */
import { createHmac, randomBytes } from "node:crypto";
import { listWorkspaceWebhooksForDelivery } from "$lib/server/neon";

export function generateWebhookSigningSecret(): string {
  return `whsec_${randomBytes(32).toString("hex")}`;
}

function signPayload(body: string, secret: string): string {
  return createHmac("sha256", secret).update(body).digest("hex");
}

/**
 * Fire-and-forget POST to each subscribed endpoint. Errors are logged; never throws.
 */
export function deliverWorkspaceWebhookEvent(
  workspaceId: string,
  eventType: string,
  data: Record<string, unknown>,
): void {
  void (async () => {
    let hooks: Awaited<ReturnType<typeof listWorkspaceWebhooksForDelivery>>;
    try {
      hooks = await listWorkspaceWebhooksForDelivery(workspaceId, eventType);
    } catch (e) {
      console.error("[webhook] listWorkspaceWebhooksForDelivery failed:", e);
      return;
    }
    const bodyObj = {
      event: eventType,
      occurred_at: new Date().toISOString(),
      workspace_id: workspaceId,
      data,
    };
    const body = JSON.stringify(bodyObj);
    for (const h of hooks) {
      const sig = signPayload(body, h.signingSecretPlaintext);
      try {
        const ac = AbortSignal.timeout(10_000);
        const res = await fetch(h.url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Restormel-Event": eventType,
            "X-Restormel-Signature": `v1=${sig}`,
            "User-Agent": "Restormel-Webhooks/1",
          },
          body,
          signal: ac,
        });
        if (!res.ok) {
          console.warn("[webhook] non-OK response", h.id, res.status);
        }
      } catch (e) {
        console.error("[webhook] delivery failed", h.id, e);
      }
    }
  })();
}
