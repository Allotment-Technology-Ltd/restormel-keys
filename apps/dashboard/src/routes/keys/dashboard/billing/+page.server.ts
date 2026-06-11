import type { PageServerLoad } from "./$types";
import { getWorkspaceEntitlements } from "$lib/server/entitlements";
import { getWorkspaceBillingState } from "$lib/server/db";
import { getOrCreateDefaultWorkspace } from "$lib/server/db";

export const load: PageServerLoad = async ({ locals }) => {
  const entitlements = await getWorkspaceEntitlements(locals);

  // Check whether the Paddle portal can be surfaced. Two conditions must both
  // be true before showing the "Open billing portal" button:
  //   1. PADDLE_API_KEY is present on this deployment (owner-managed secret).
  //   2. The workspace has a paddle_customer_id (recorded after first checkout).
  const uid = locals.user?.uid ?? null;
  let paddleCustomerId: string | null = null;
  let paddleSubscriptionStatus: string | null = null;
  const paddleKeyConfigured = !!process.env.PADDLE_API_KEY?.trim();

  if (uid && entitlements?.workspaceId) {
    const billing = await getWorkspaceBillingState(entitlements.workspaceId).catch(() => null);
    paddleCustomerId = billing?.paddleCustomerId ?? null;
    paddleSubscriptionStatus = billing?.paddleSubscriptionStatus ?? null;
  } else if (uid) {
    try {
      const ws = await getOrCreateDefaultWorkspace(uid);
      const billing = await getWorkspaceBillingState(ws.id).catch(() => null);
      paddleCustomerId = billing?.paddleCustomerId ?? null;
      paddleSubscriptionStatus = billing?.paddleSubscriptionStatus ?? null;
    } catch {
      // Non-fatal: billing state is best-effort
    }
  }

  return {
    entitlements,
    // Whether the server has a Paddle API key (owner-set secret).
    // When false, portal CTA is replaced with honest copy.
    paddleKeyConfigured,
    // Whether this workspace has a recorded Paddle customer ID (has ever checked out).
    hasCustomerId: !!paddleCustomerId,
    // Last-known subscription status from webhook events (e.g. "active", "canceled").
    paddleSubscriptionStatus,
    // Invoices: not available via current plumbing — no webhook-stored invoice rows
    // and Paddle transaction list requires the subscription ID + API key.
    // An honest empty state is returned instead of fabricated data.
    // To enable: implement PADDLE_INVOICE_FETCH (see PR body for owner actions).
    invoices: [] as Array<{ id: string; amount: string; issuedAt: string }>,
  };
};
