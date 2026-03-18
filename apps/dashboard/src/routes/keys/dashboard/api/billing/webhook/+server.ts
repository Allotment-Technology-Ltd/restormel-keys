/**
 * POST /api/billing/webhook — Paddle webhook (Phase 3 C2/C3).
 * Verifies paddle-signature, parses event, acks. No persistence in Phase 3 gate.
 */
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import {
  verifyPaddleWebhookSignature,
  parsePaddleWebhook,
  type PaddleWebhookEvent,
} from "$lib/server/billing/paddle";
import { getOrCreateDefaultWorkspace, setWorkspacePlan } from "$lib/server/db";

function asString(x: unknown): string | null {
  return typeof x === "string" && x.trim() ? x.trim() : null;
}

function getCustomData(event: PaddleWebhookEvent): Record<string, unknown> {
  const data = event.data ?? {};
  const custom =
    (data.custom_data as Record<string, unknown> | undefined) ??
    (data.customData as Record<string, unknown> | undefined) ??
    {};
  return custom && typeof custom === "object" ? custom : {};
}

async function handleWebhookEvent(event: PaddleWebhookEvent): Promise<{ ok: boolean; message: string }> {
  const type = (event.event_type ?? "").toLowerCase();
  if (!type) return { ok: true, message: "ignored" };

  // Minimal v1 billing: treat a completed checkout as Pro activation for the user's workspace.
  // We use custom_data from checkout creation (uid, tier, billingPeriod).
  if (type === "transaction.completed" || type === "checkout.completed") {
    const custom = getCustomData(event);
    const uid = asString(custom.uid);
    const tier = asString(custom.tier)?.toLowerCase();
    const transactionId = asString((event.data as any)?.id) ?? asString((event.data as any)?.transaction_id);

    if (uid && tier === "pro") {
      const ws = await getOrCreateDefaultWorkspace(uid);
      await setWorkspacePlan({
        workspaceId: ws.id,
        plan: "pro",
        planExpiresAt: null,
        paddleTransactionId: transactionId,
        paddleSubscriptionStatus: "active",
      });
      return { ok: true, message: "plan_updated" };
    }
  }

  return { ok: true, message: "received" };
}

export const POST: RequestHandler = async ({ request }) => {
  const rawBody = await request.text();
  const signature = request.headers.get("paddle-signature");

  if (!verifyPaddleWebhookSignature(rawBody, signature)) {
    return json({ error: "Invalid webhook signature" }, { status: 401 });
  }

  let event: PaddleWebhookEvent;
  try {
    event = parsePaddleWebhook(rawBody);
  } catch {
    return json({ error: "Invalid webhook payload" }, { status: 400 });
  }

  const outcome = await handleWebhookEvent(event);
  return json(outcome);
};
