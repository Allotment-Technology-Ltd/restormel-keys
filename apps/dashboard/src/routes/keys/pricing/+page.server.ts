import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ url }) => {
  const dashboardUrl = `${url.origin}/keys/dashboard`;
  const paddleToken = process.env.PUBLIC_PADDLE_CLIENT_TOKEN ?? "";

  // Pro price ID is configured server-side (safe to expose to client).
  // Use Paddle sandbox/production price IDs depending on env setup.
  const proPriceIdMonthlyGbp =
    process.env.PADDLE_PRICE_KEYS_PRO_MONTHLY_GBP ??
    process.env.PADDLE_PRICE_KEYS_PRO_MONTHLY ??
    "";
  const proPriceIdMonthlyUsd = process.env.PADDLE_PRICE_KEYS_PRO_MONTHLY_USD ?? "";

  return { dashboardUrl, paddleToken, proPriceIdMonthlyGbp, proPriceIdMonthlyUsd };
};
