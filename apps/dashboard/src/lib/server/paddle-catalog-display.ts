/**
 * Read-only Paddle price display for marketing pages (server load).
 * Uses PADDLE_API_KEY; never expose keys to the client.
 */

function getPaddleApiBase(): string {
  const env = (process.env.PADDLE_ENVIRONMENT ?? "").trim().toLowerCase();
  return env === "production" ? "https://api.paddle.com" : "https://sandbox-api.paddle.com";
}

export function formatMinorAmount(amountMinor: number, currency: "GBP" | "USD"): string {
  const amount = amountMinor / 100;
  const locale = currency === "GBP" ? "en-GB" : "en-US";
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export async function getPaddleDisplayPrice(
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
