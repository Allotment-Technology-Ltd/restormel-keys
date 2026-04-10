import type { PageServerLoad } from "./$types";
import { SUITE_PRICING_FALLBACK_GBP } from "$lib/suite-pricing-display";
import { formatMinorAmount, getPaddleDisplayPrice } from "$lib/server/paddle-catalog-display";

export const load: PageServerLoad = async () => {
  const platformGbpId = (process.env.PADDLE_PRICE_PLATFORM_MONTHLY_GBP ?? "").trim();
  const platformUsdId = (process.env.PADDLE_PRICE_PLATFORM_MONTHLY_USD ?? "").trim();
  const keysProGbpId = (
    process.env.PADDLE_PRICE_KEYS_PRO_MONTHLY_GBP ??
    process.env.PADDLE_PRICE_KEYS_PRO_MONTHLY ??
    ""
  ).trim();

  const [gbpRow, usdRow, keysProGbpRow] = await Promise.all([
    platformGbpId ? getPaddleDisplayPrice(platformGbpId) : Promise.resolve(null),
    platformUsdId ? getPaddleDisplayPrice(platformUsdId) : Promise.resolve(null),
    keysProGbpId ? getPaddleDisplayPrice(keysProGbpId) : Promise.resolve(null),
  ]);

  const gbpDisplay =
    gbpRow && gbpRow.currency === "GBP"
      ? formatMinorAmount(gbpRow.amountMinor, "GBP")
      : SUITE_PRICING_FALLBACK_GBP.platformMonthly;
  const usdDisplay =
    usdRow && usdRow.currency === "USD" ? formatMinorAmount(usdRow.amountMinor, "USD") : null;
  const keysProDisplayGbp =
    keysProGbpRow && keysProGbpRow.currency === "GBP"
      ? formatMinorAmount(keysProGbpRow.amountMinor, "GBP")
      : SUITE_PRICING_FALLBACK_GBP.keysProMonthly;

  return {
    platformMonthlyDisplayGbp: gbpDisplay,
    platformMonthlyDisplayUsd: usdDisplay,
    keysProDisplayGbp,
  };
};
