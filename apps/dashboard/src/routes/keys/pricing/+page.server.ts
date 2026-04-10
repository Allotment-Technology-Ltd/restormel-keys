import type { PageServerLoad } from "./$types";
import {
  SUITE_PRICING_FALLBACK_GBP,
  SUITE_PRICING_FALLBACK_USD,
} from "$lib/suite-pricing-display";
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
  const teamPriceIdMonthlyGbp = (process.env.PADDLE_PRICE_KEYS_TEAM_MONTHLY_GBP ?? "").trim();
  const platformPriceIdMonthlyGbp = (process.env.PADDLE_PRICE_PLATFORM_MONTHLY_GBP ?? "").trim();

  const [gbpPrice, usdPrice, teamGbp, platformGbp] = await Promise.all([
    getPaddleDisplayPrice(proPriceIdMonthlyGbp),
    getPaddleDisplayPrice(proPriceIdMonthlyUsd),
    teamPriceIdMonthlyGbp ? getPaddleDisplayPrice(teamPriceIdMonthlyGbp) : Promise.resolve(null),
    platformPriceIdMonthlyGbp ? getPaddleDisplayPrice(platformPriceIdMonthlyGbp) : Promise.resolve(null),
  ]);

  const proMonthlyPriceDisplayGbp =
    gbpPrice && gbpPrice.currency === "GBP"
      ? formatMinorAmount(gbpPrice.amountMinor, "GBP")
      : SUITE_PRICING_FALLBACK_GBP.keysProMonthly;
  const proMonthlyPriceDisplayUsd =
    usdPrice && usdPrice.currency === "USD"
      ? formatMinorAmount(usdPrice.amountMinor, "USD")
      : SUITE_PRICING_FALLBACK_USD.keysProMonthly;
  const teamMonthlyDisplayGbp =
    teamGbp && teamGbp.currency === "GBP"
      ? formatMinorAmount(teamGbp.amountMinor, "GBP")
      : SUITE_PRICING_FALLBACK_GBP.teamMonthly;
  const platformMonthlyDisplayGbp =
    platformGbp && platformGbp.currency === "GBP"
      ? formatMinorAmount(platformGbp.amountMinor, "GBP")
      : SUITE_PRICING_FALLBACK_GBP.platformMonthly;

  return {
    dashboardUrl,
    paddleToken,
    proPriceIdMonthlyGbp,
    proPriceIdMonthlyUsd,
    proMonthlyPriceDisplayGbp,
    proMonthlyPriceDisplayUsd,
    teamPriceIdMonthlyGbp,
    platformPriceIdMonthlyGbp,
    teamMonthlyDisplayGbp,
    platformMonthlyDisplayGbp,
  };
};
