import type { PageServerLoad } from "./$types";

function getPaddleApiBase(): string {
  const env = (process.env.PADDLE_ENVIRONMENT ?? "").trim().toLowerCase();
  return env === "production" ? "https://api.paddle.com" : "https://sandbox-api.paddle.com";
}

function formatMinorAmount(amountMinor: number, currency: "GBP" | "USD"): string {
  const amount = amountMinor / 100;
  const locale = currency === "GBP" ? "en-GB" : "en-US";
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

async function getPaddleDisplayPrice(
  priceId: string,
): Promise<{ amountMinor: number; currency: "GBP" | "USD" } | null> {
  const id = priceId.trim();
  const apiKey = (process.env.PADDLE_API_KEY ?? "").trim();
  if (!id || !apiKey) return null;

  const res = await fetch(`${getPaddleApiBase()}/prices/${id}`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Paddle-Version": "1",
    },
  });
  if (!res.ok) return null;

  const payload = (await res.json().catch(() => ({}))) as {
    data?: { unit_price?: { amount?: string; currency_code?: string } };
  };
  const amountRaw = payload?.data?.unit_price?.amount;
  const currencyRaw = payload?.data?.unit_price?.currency_code;
  const amountMinor = Number.parseInt(String(amountRaw ?? ""), 10);
  const currency = currencyRaw === "USD" ? "USD" : currencyRaw === "GBP" ? "GBP" : null;
  if (!Number.isFinite(amountMinor) || !currency) return null;
  return { amountMinor, currency };
}

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
