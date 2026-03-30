/**
 * POST /api/billing/webhook — Paddle webhook lifecycle automation.
 * Verifies signature, parses event payloads, and keeps workspace plan/subscription state in sync.
 */
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import {
  verifyPaddleWebhookSignature,
  parsePaddleWebhook,
  type PaddleWebhookEvent,
} from "$lib/server/billing/paddle";
import {
  getOrCreateDefaultWorkspace,
  findWorkspaceByPaddleSubscriptionId,
  findWorkspaceByPaddleCustomerId,
  applyPaddleLifecycleUpdate,
} from "$lib/server/db";

function asString(x: unknown): string | null {
  return typeof x === "string" && x.trim() ? x.trim() : null;
}

function asRecord(x: unknown): Record<string, unknown> {
  return x && typeof x === "object" ? (x as Record<string, unknown>) : {};
}

function normalizeStatus(x: unknown): string | null {
  const s = asString(x);
  return s ? s.toLowerCase() : null;
}

function extractRefs(event: PaddleWebhookEvent): {
  custom: Record<string, unknown>;
  transactionId: string | null;
  subscriptionId: string | null;
  customerId: string | null;
  status: string | null;
} {
  const data = asRecord(event.data);
  const subscription = asRecord(data.subscription);
  const customer = asRecord(data.customer);
  const transaction = asRecord(data.transaction);

  const custom =
    asRecord(data.custom_data).uid || asRecord(data.custom_data).workspaceId
      ? asRecord(data.custom_data)
      : asRecord(data.customData);

  const transactionId =
    asString(data.id) ?? asString(data.transaction_id) ?? asString(transaction.id);
  const subscriptionId =
    asString(data.subscription_id) ?? asString(subscription.id) ?? asString(transaction.subscription_id);
  const customerId =
    asString(data.customer_id) ?? asString(customer.id) ?? asString(transaction.customer_id);
  const status =
    normalizeStatus(data.subscription_status) ??
    normalizeStatus(subscription.status) ??
    normalizeStatus(data.status);

  return { custom, transactionId, subscriptionId, customerId, status };
}

async function resolveWorkspaceId(input: {
  custom: Record<string, unknown>;
  subscriptionId: string | null;
  customerId: string | null;
}): Promise<string | null> {
  if (input.subscriptionId) {
    const ws = await findWorkspaceByPaddleSubscriptionId(input.subscriptionId);
    if (ws) return ws.id;
  }
  if (input.customerId) {
    const ws = await findWorkspaceByPaddleCustomerId(input.customerId);
    if (ws) return ws.id;
  }
  const workspaceId = asString(input.custom.workspaceId);
  if (workspaceId) return workspaceId;
  const uid = asString(input.custom.uid);
  if (!uid) return null;
  const ws = await getOrCreateDefaultWorkspace(uid);
  return ws.id;
}

async function handleWebhookEvent(event: PaddleWebhookEvent): Promise<{ ok: boolean; message: string }> {
  const type = (event.event_type ?? "").toLowerCase();
  if (!type) return { ok: true, message: "ignored" };

  const refs = extractRefs(event);
  const tier = asString(refs.custom.tier)?.toLowerCase();
  const workspaceId = await resolveWorkspaceId({
    custom: refs.custom,
    subscriptionId: refs.subscriptionId,
    customerId: refs.customerId,
  });
  if (!workspaceId) return { ok: true, message: "workspace_unresolved" };

  const activationEvents = new Set([
    "transaction.completed",
    "transaction.paid",
    "checkout.completed",
    "subscription.created",
    "subscription.activated",
    "subscription.trialing",
    "subscription.resumed",
  ]);
  const downgradeEvents = new Set([
    "subscription.canceled",
    "subscription.cancelled",
    "subscription.past_due",
    "subscription.paused",
  ]);
  const isActivation = activationEvents.has(type);
  const isDowngrade = downgradeEvents.has(type);

  if (isActivation) {
    if (tier && tier !== "pro") return { ok: true, message: "ignored_non_pro_tier" };
    await applyPaddleLifecycleUpdate({
      workspaceId,
      plan: "pro",
      paddleCustomerId: refs.customerId,
      paddleTransactionId: refs.transactionId,
      paddleSubscriptionId: refs.subscriptionId,
      paddleSubscriptionStatus: refs.status ?? "active",
      markPlanEndedNow: false,
    });
    return { ok: true, message: "pro_activated" };
  }

  if (isDowngrade) {
    const statusFromType = type.split(".")[1] ?? "canceled";
    await applyPaddleLifecycleUpdate({
      workspaceId,
      plan: "free",
      paddleCustomerId: refs.customerId,
      paddleSubscriptionId: refs.subscriptionId,
      paddleSubscriptionStatus: refs.status ?? statusFromType,
      markPlanEndedNow: true,
    });
    return { ok: true, message: "pro_downgraded" };
  }

  if (type === "subscription.updated") {
    const status = refs.status;
    if (status === "active" || status === "trialing") {
      await applyPaddleLifecycleUpdate({
        workspaceId,
        plan: "pro",
        paddleCustomerId: refs.customerId,
        paddleSubscriptionId: refs.subscriptionId,
        paddleSubscriptionStatus: status,
        markPlanEndedNow: false,
      });
      return { ok: true, message: "subscription_active" };
    }
    if (status === "canceled" || status === "cancelled" || status === "past_due" || status === "paused") {
      await applyPaddleLifecycleUpdate({
        workspaceId,
        plan: "free",
        paddleCustomerId: refs.customerId,
        paddleSubscriptionId: refs.subscriptionId,
        paddleSubscriptionStatus: status,
        markPlanEndedNow: true,
      });
      return { ok: true, message: "subscription_downgraded" };
    }
    await applyPaddleLifecycleUpdate({
      workspaceId,
      plan: "pro",
      paddleCustomerId: refs.customerId,
      paddleSubscriptionId: refs.subscriptionId,
      paddleSubscriptionStatus: status ?? "active",
      markPlanEndedNow: false,
    });
    return { ok: true, message: "subscription_updated" };
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
