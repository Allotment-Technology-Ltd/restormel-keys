/**
 * Paddle.js checkout for Keys pricing page.
 * Subscribe buttons call dashboard /api/billing/checkout then open overlay; success → redirect to dashboard.
 */

const PADDLE_SCRIPT_URL = "https://cdn.paddle.com/paddle/v2/paddle.js";

const DASHBOARD_SUCCESS_PATH = "/keys/dashboard?billing=success";

export type PriceIdMap = Partial<Record<string, Partial<Record<"monthly" | "annual", string>>>>;

export type PaddleCheckoutConfig = {
  token: string;
  dashboardUrl: string;
  sandboxPriceId?: string;
  priceIdMap?: PriceIdMap;
  messageContainerId?: string;
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

function showMessage(containerId: string | undefined, message: string, isError: boolean): void {
  if (!containerId) return;
  const el = document.getElementById(containerId);
  if (!el) return;
  el.textContent = message;
  el.setAttribute("role", "alert");
  el.className = isError ? "checkout-message checkout-message-error" : "checkout-message";
  el.hidden = false;
}

function clearMessage(containerId: string | undefined): void {
  if (!containerId) return;
  const el = document.getElementById(containerId);
  if (el) {
    el.textContent = "";
    el.hidden = true;
  }
}

export function initPaddleCheckout(config: PaddleCheckoutConfig): void {
  const { token, dashboardUrl, sandboxPriceId, priceIdMap, messageContainerId } = config;

  if (!token || typeof token !== "string") {
    return;
  }

  loadScript(PADDLE_SCRIPT_URL)
    .then(() => {
      if (!window.Paddle) {
        showMessage(messageContainerId, "Checkout could not be loaded. Please try again later.", true);
        return;
      }

      window.Paddle.Initialize({
        token,
        eventCallback: (data: PaddleEventData) => {
          if (data?.name === "checkout.completed") {
            window.location.href = new URL(DASHBOARD_SUCCESS_PATH, window.location.origin).href;
          }
          if (data?.name === "checkout.closed" || data?.name === "checkout.cancelled") {
            clearMessage(messageContainerId);
          }
        },
      });

      bindSubscribeButtons(dashboardUrl, sandboxPriceId, priceIdMap ?? {}, messageContainerId);
    })
    .catch(() => {
      showMessage(messageContainerId, "Checkout could not be loaded. Please try again later.", true);
    });
}

function bindSubscribeButtons(
  dashboardUrl: string,
  sandboxPriceId: string | undefined,
  priceIdMap: PriceIdMap,
  messageContainerId: string | undefined,
): void {
  document.querySelectorAll<HTMLButtonElement>("[data-paddle-checkout]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      clearMessage(messageContainerId);
      const fromButton = btn.getAttribute("data-price-id")?.trim() || undefined;
      const tier = btn.getAttribute("data-tier") || undefined;
      const billingPeriod = (btn.getAttribute("data-billing-period") as "monthly" | "annual") || "monthly";
      const fromMap =
        tier && priceIdMap[tier]?.[billingPeriod] ? priceIdMap[tier][billingPeriod]! : undefined;
      const priceId = fromButton || fromMap;

      if (dashboardUrl) {
        if (!priceId) {
          showMessage(
            messageContainerId,
            "This plan is not configured for checkout yet. Set Paddle price IDs for this tier and period.",
            true,
          );
          return;
        }
        try {
          const res = await fetch(`${dashboardUrl.replace(/\/$/, "")}/api/billing/checkout`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ priceId, tier, billingPeriod }),
          });
          const json = await res.json().catch(() => ({}));
          if (res.status === 401) {
            showMessage(
              messageContainerId,
              "Please sign in first. Open the Dashboard and sign in with GitHub, then try again.",
              true,
            );
            return;
          }
          if (!res.ok) {
            const msg = json?.error ?? (typeof json === "string" ? json : "Checkout request failed.");
            showMessage(messageContainerId, String(msg), true);
            return;
          }
          const transactionId = json?.data?.transactionId ?? json?.transactionId;
          if (transactionId && window.Paddle?.Checkout) {
            window.Paddle.Checkout.open({ transactionId });
          } else {
            showMessage(messageContainerId, "Checkout could not be opened. Please try again.", true);
          }
        } catch {
          showMessage(
            messageContainerId,
            "Unable to reach the billing service. Check your connection and try again.",
            true,
          );
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
          showMessage(
            messageContainerId,
            "Checkout is not configured. Set PUBLIC_KEYS_DASHBOARD_URL or add Paddle price IDs.",
            true,
          );
        }
      }
    });
  });
}
