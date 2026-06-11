/**
 * POST /api/billing/portal-session — generate a Paddle customer-portal auth token and return
 * the portal URL. Requires session auth and a Paddle customer ID on the workspace.
 *
 * Returns { url } on success, or { error, code } on failure.
 * code="no_customer_id"  — workspace has no Paddle customer ID yet (user never checked out)
 * code="paddle_key_missing" — PADDLE_API_KEY is not configured (owner action needed)
 */
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { createCustomerPortalUrl } from "$lib/server/billing/paddle";
import { getWorkspaceBillingState } from "$lib/server/db";
import { getOrCreateDefaultWorkspace } from "$lib/server/db";

export const POST: RequestHandler = async ({ locals }) => {
  const uid = locals.user?.uid;
  if (!uid) {
    return json({ error: "Authentication required" }, { status: 401 });
  }
  if (locals.user?.authType === "gateway_key" || locals.user?.authType === "management_key") {
    return json({ error: "Portal session requires session auth" }, { status: 403 });
  }
  if (!process.env.PADDLE_API_KEY?.trim()) {
    return json(
      { error: "Billing portal is not configured on this deployment.", code: "paddle_key_missing" },
      { status: 503 }
    );
  }

  const workspace = await getOrCreateDefaultWorkspace(uid);
  const billing = await getWorkspaceBillingState(workspace.id);
  const customerId = billing?.paddleCustomerId;
  if (!customerId) {
    return json(
      {
        error:
          "No billing account found for this workspace. Subscribe to Pro to create a billing account.",
        code: "no_customer_id",
      },
      { status: 404 }
    );
  }

  // Retry up to 3 times for transient Paddle API failures.
  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const url = await createCustomerPortalUrl(customerId);
      return json({ url });
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < 3) {
        await new Promise((r) => setTimeout(r, 300 * attempt));
      }
    }
  }
  return json(
    { error: lastError?.message ?? "Failed to generate billing portal session." },
    { status: 502 }
  );
};
