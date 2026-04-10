import type { PageServerLoad } from "./$types";
import { formatMinorAmount, getPaddleDisplayPrice } from "$lib/server/paddle-catalog-display";

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

  const [gbpPrice, usdPrice] = await Promise.all([
    getPaddleDisplayPrice(proPriceIdMonthlyGbp),
    getPaddleDisplayPrice(proPriceIdMonthlyUsd),
  ]);

  const proMonthlyPriceDisplayGbp =
    gbpPrice && gbpPrice.currency === "GBP" ? formatMinorAmount(gbpPrice.amountMinor, "GBP") : "£10";
  const proMonthlyPriceDisplayUsd =
    usdPrice && usdPrice.currency === "USD" ? formatMinorAmount(usdPrice.amountMinor, "USD") : "$24";

  return {
    dashboardUrl,
    paddleToken,
    proPriceIdMonthlyGbp,
    proPriceIdMonthlyUsd,
    proMonthlyPriceDisplayGbp,
    proMonthlyPriceDisplayUsd,
  };
};
