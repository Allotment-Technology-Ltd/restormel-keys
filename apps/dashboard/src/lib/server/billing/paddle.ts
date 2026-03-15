/**
 * Paddle Billing API client and webhook verification (Phase 3).
 * Uses PADDLE_API_KEY and PADDLE_WEBHOOK_SECRET from env (Secret Manager in prod).
 * No raw secrets in repo or logs.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

const SANDBOX_API = "https://sandbox-api.paddle.com";
const PRODUCTION_API = "https://api.paddle.com";

function getPaddleEnvironment(): "sandbox" | "production" {
  const env = (process.env.PADDLE_ENVIRONMENT ?? "").trim().toLowerCase();
  if (env === "production") return "production";
  if (env === "sandbox") return "sandbox";
  return process.env.NODE_ENV === "production" ? "production" : "sandbox";
}

function getApiBase(): string {
  return getPaddleEnvironment() === "production" ? PRODUCTION_API : SANDBOX_API;
}

/** PADDLE_API_KEY (server-side). Injected via Pulumi secret ref in Cloud Run. */
function getPaddleApiKey(): string {
  const key = process.env.PADDLE_API_KEY?.trim();
  if (!key) throw new Error("PADDLE_API_KEY is not set");
  return key;
}

interface PaddleApiResponse<T> {
  data?: T;
  error?: { code?: string; detail?: string; message?: string };
}

interface PaddleTransaction {
  id: string;
  checkout?: { url?: string };
}

/**
 * Create a checkout transaction. Returns transaction id for Paddle overlay.
 */
export async function createCheckoutTransaction(params: {
  priceId: string;
  customerEmail?: string | null;
  successUrl?: string;
  cancelUrl?: string;
  customData?: Record<string, unknown>;
}): Promise<{ transactionId: string; checkoutUrl?: string }> {
  const apiKey = getPaddleApiKey();
  const body = {
    items: [{ price_id: params.priceId, quantity: 1 }],
    customer_email: params.customerEmail ?? undefined,
    custom_data: params.customData ?? {},
    checkout: {
      ...(params.successUrl ? { success_url: params.successUrl } : {}),
      ...(params.cancelUrl ? { cancel_url: params.cancelUrl } : {}),
    },
  };

  const res = await fetch(`${getApiBase()}/transactions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const payload = (await res.json().catch(() => ({}))) as PaddleApiResponse<PaddleTransaction>;
  if (!res.ok) {
    const detail = payload?.error?.detail ?? payload?.error?.message ?? res.statusText;
    throw new Error(`Paddle API error (${res.status}): ${detail}`);
  }

  const data = payload?.data;
  if (!data?.id) throw new Error("Paddle response missing transaction id");

  return {
    transactionId: data.id,
    checkoutUrl: data.checkout?.url,
  };
}

function parseSignatureHeader(signatureHeader: string): { ts: string; h1: string } | null {
  const tokens = signatureHeader.split(";").map((p) => p.trim());
  let ts = "";
  let h1 = "";
  for (const token of tokens) {
    const [k, v] = token.split("=");
    if (k === "ts" && v) ts = v;
    if (k === "h1" && v) h1 = v;
  }
  return ts && h1 ? { ts, h1 } : null;
}

/**
 * Verify Paddle webhook signature (paddle-signature header).
 * Uses PADDLE_WEBHOOK_SECRET (or PADDLE_SECRET for backward compat). If unset, allows unsigned only when PADDLE_ALLOW_UNSIGNED_WEBHOOKS=true.
 */
export function verifyPaddleWebhookSignature(
  rawBody: string,
  signatureHeader: string | null
): boolean {
  const secret = (
    process.env.PADDLE_WEBHOOK_SECRET ?? process.env.PADDLE_SECRET
  )?.trim();
  if (!secret) {
    return (process.env.PADDLE_ALLOW_UNSIGNED_WEBHOOKS ?? "false").toLowerCase() === "true";
  }
  if (!signatureHeader) return false;

  const parsed = parseSignatureHeader(signatureHeader);
  if (!parsed) return false;
  const signedPayload = `${parsed.ts}:${rawBody}`;
  const digest = createHmac("sha256", secret).update(signedPayload, "utf8").digest("hex");

  const incoming = Buffer.from(parsed.h1, "hex");
  const expected = Buffer.from(digest, "hex");
  if (incoming.length !== expected.length) return false;
  return timingSafeEqual(incoming, expected);
}

export interface PaddleWebhookEvent {
  event_id?: string;
  event_type?: string;
  occurred_at?: string;
  data?: Record<string, unknown>;
}

export function parsePaddleWebhook(rawBody: string): PaddleWebhookEvent {
  const parsed = JSON.parse(rawBody) as PaddleWebhookEvent;
  return {
    event_id: typeof parsed.event_id === "string" ? parsed.event_id : undefined,
    event_type: typeof parsed.event_type === "string" ? parsed.event_type : undefined,
    occurred_at: typeof parsed.occurred_at === "string" ? parsed.occurred_at : undefined,
    data: parsed.data && typeof parsed.data === "object" ? parsed.data : {},
  };
}
