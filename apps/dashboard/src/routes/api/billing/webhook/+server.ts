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

function handleWebhookEvent(_event: PaddleWebhookEvent): { ok: boolean; message: string } {
  // Phase 3: acknowledge only. Persist subscription/customer in a later phase.
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

  const outcome = handleWebhookEvent(event);
  return json(outcome);
};
