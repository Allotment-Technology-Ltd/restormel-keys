/**
 * Paddle.js checkout for Keys pricing page (Prompt 3.3).
 * Loads Paddle from CDN, initializes with client token, eventCallback for success/cancel.
 * Subscribe buttons call dashboard /api/billing/checkout then open overlay; success → redirect to dashboard.
 */

const PADDLE_SCRIPT_URL = "https://cdn.paddle.com/paddle/v2/paddle.js";

/** Post-checkout redirect (same-origin). */
const DASHBOARD_SUCCESS_PATH = "/keys/dashboard?billing=success";

export type PaddleCheckoutConfig = {
  token: string;
  dashboardUrl: string;
  /** Optional: sandbox price ID to open checkout directly when dashboard API is not available */
  sandboxPriceId?: string;
};

declare global {
  interface Window {
    Paddle?: {
      Initialize: (opts: { token: string; eventCallback?: (data: PaddleEventData) => void }) => void;
      Checkout: { open: (opts: { transactionId?: string; items?: Array<{ priceId: string; quantity: number }> }) => void };
      Environment?: { set: (env: "sandbox" | "production") => void };
    };
  }
}

type PaddleEventData = {
  name?: string;
  data?: { id?: string; status?: string };
};

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(script);
  });
}

/**
 * Initialize Paddle and wire Subscribe buttons.
 * Call once when the pricing page loads.
 */
export function initPaddleCheckout(config: PaddleCheckoutConfig): void {
  const { token, dashboardUrl, sandboxPriceId } = config;

  if (!token || typeof token !== "string") {
    console.warn("[Paddle] No client token; checkout disabled.");
    return;
  }

  loadScript(PADDLE_SCRIPT_URL)
    .then(() => {
      if (!window.Paddle) {
        console.error("[Paddle] Paddle.js did not attach to window.");
        return;
      }

      window.Paddle.Initialize({
        token,
        eventCallback: (data: PaddleEventData) => {
          const name = data?.name;
          if (name === "checkout.completed") {
            window.location.href = new URL(DASHBOARD_SUCCESS_PATH, window.location.origin).href;
          }
          if (name === "checkout.closed" || name === "checkout.cancelled") {
            // Stay on pricing page; no redirect
          }
        },
      });

      bindSubscribeButtons(dashboardUrl, sandboxPriceId);
    })
    .catch((err) => {
      console.error("[Paddle] Failed to load Paddle.js", err);
    });
}

function bindSubscribeButtons(dashboardUrl: string, sandboxPriceId?: string): void {
  document.querySelectorAll<HTMLButtonElement>("[data-paddle-checkout]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const priceId = btn.getAttribute("data-price-id") || undefined;
      const tier = btn.getAttribute("data-tier") || undefined;
      const billingPeriod = (btn.getAttribute("data-billing-period") as "monthly" | "annual") || "monthly";

      if (dashboardUrl) {
        try {
          const res = await fetch(`${dashboardUrl.replace(/\/$/, "")}/api/billing/checkout`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ priceId, tier, billingPeriod }),
          });
          if (!res.ok) {
            const text = await res.text();
            console.error("[Paddle] Checkout API error", res.status, text);
            return;
          }
          const json = await res.json();
          const transactionId = json?.data?.transactionId ?? json?.transactionId;
          if (transactionId && window.Paddle?.Checkout) {
            window.Paddle.Checkout.open({ transactionId });
          } else {
            console.error("[Paddle] No transactionId in response", json);
          }
        } catch (e) {
          console.error("[Paddle] Checkout API request failed", e);
        }
        return;
      }

      if (sandboxPriceId || priceId) {
        const id = priceId || sandboxPriceId;
        if (id && window.Paddle?.Checkout) {
          window.Paddle.Checkout.open({
            items: [{ priceId: id, quantity: 1 }],
          });
        } else {
          console.warn("[Paddle] No dashboard URL and no price ID; set PUBLIC_KEYS_DASHBOARD_URL or PUBLIC_PADDLE_SANDBOX_PRICE_ID.");
        }
      }
    });
  });
}
