/**
 * POST /api/billing/checkout — create Paddle transaction for overlay (Phase 3 C3).
 * Requires auth. Body: { priceId, tier?, billingPeriod? }. Returns { transactionId }.
 */
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { createCheckoutTransaction } from "$lib/server/billing/paddle";

export const POST: RequestHandler = async ({ locals, request, url }) => {
  const uid = locals.user?.uid;
  const email = locals.user?.email ?? null;
  if (!uid) {
    return json({ error: "Authentication required" }, { status: 401 });
  }

  let body: { priceId?: string; tier?: string; billingPeriod?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const priceId = body.priceId?.trim();
  if (!priceId) {
    return json({ error: "priceId is required" }, { status: 400 });
  }

  const origin = url.origin;
  const successUrl = `${origin}/keys/dashboard?billing=success`;
  const cancelUrl = `${origin}/keys/pricing`;

  try {
    const result = await createCheckoutTransaction({
      priceId,
      customerEmail: email,
      successUrl,
      cancelUrl,
      customData: { uid, tier: body.tier ?? null, billingPeriod: body.billingPeriod ?? null },
    });

    return json({
      transactionId: result.transactionId,
      ...(result.checkoutUrl ? { checkout_url: result.checkoutUrl } : {}),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Checkout failed.";
    return json({ error: message }, { status: 502 });
  }
};
