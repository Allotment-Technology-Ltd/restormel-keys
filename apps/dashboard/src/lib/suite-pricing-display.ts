/**
 * Marketing fallbacks when Paddle catalog lookup fails or env price IDs are unset.
 * Keep Keys `/keys/pricing` and suite `/pricing` aligned.
 */
export const SUITE_PRICING_FALLBACK_GBP = {
  keysProMonthly: "£10",
  teamMonthly: "£35",
  platformMonthly: "£35",
} as const;

export const SUITE_PRICING_FALLBACK_USD = {
  keysProMonthly: "$24",
} as const;
