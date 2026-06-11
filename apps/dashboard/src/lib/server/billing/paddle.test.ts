/**
 * Unit tests for Paddle billing client helpers.
 * These exercise logic without real network calls (global fetch is mocked).
 */
import { afterEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Minimal fetch mock helpers
// ---------------------------------------------------------------------------
function mockFetchOnce(status: number, body: unknown) {
  const mockFn = vi.fn().mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? "OK" : "Error",
    json: () => Promise.resolve(body),
  } as unknown as Response);
  vi.stubGlobal("fetch", mockFn);
  return mockFn;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
  // Clean up env mutations
  delete process.env.PADDLE_API_KEY;
  delete process.env.PADDLE_ENVIRONMENT;
});

// ---------------------------------------------------------------------------
// createCheckoutTransaction
// ---------------------------------------------------------------------------
describe("createCheckoutTransaction", () => {
  it("returns transactionId from Paddle response", async () => {
    process.env.PADDLE_API_KEY = "test-key";
    process.env.PADDLE_ENVIRONMENT = "sandbox";

    mockFetchOnce(200, {
      data: { id: "txn_123", checkout: { url: "https://checkout.paddle.com/checkout/123" } },
    });

    const { createCheckoutTransaction } = await import("./paddle");
    const result = await createCheckoutTransaction({ priceId: "pri_abc" });

    expect(result.transactionId).toBe("txn_123");
    expect(result.checkoutUrl).toBe("https://checkout.paddle.com/checkout/123");
  });

  it("throws when Paddle API responds with an error", async () => {
    process.env.PADDLE_API_KEY = "test-key";
    process.env.PADDLE_ENVIRONMENT = "sandbox";

    mockFetchOnce(400, { error: { detail: "price not found" } });

    const { createCheckoutTransaction } = await import("./paddle");
    await expect(createCheckoutTransaction({ priceId: "bad_price" })).rejects.toThrow(
      /price not found/
    );
  });

  it("throws when PADDLE_API_KEY is not set", async () => {
    delete process.env.PADDLE_API_KEY;
    vi.resetModules();
    const { createCheckoutTransaction } = await import("./paddle");
    await expect(createCheckoutTransaction({ priceId: "pri_x" })).rejects.toThrow(
      /PADDLE_API_KEY/
    );
  });
});

// ---------------------------------------------------------------------------
// createCustomerPortalUrl
// ---------------------------------------------------------------------------
describe("createCustomerPortalUrl", () => {
  it("constructs a sandbox portal URL from the auth token", async () => {
    process.env.PADDLE_API_KEY = "test-key";
    process.env.PADDLE_ENVIRONMENT = "sandbox";

    mockFetchOnce(200, { data: { customer_auth_token: "tok_abc123" } });

    const { createCustomerPortalUrl } = await import("./paddle");
    const url = await createCustomerPortalUrl("ctm_xyz");

    expect(url).toContain("sandbox-customer.paddle.com");
    expect(url).toContain("tok_abc123");
  });

  it("constructs a production portal URL when environment is production", async () => {
    process.env.PADDLE_API_KEY = "live-key";
    process.env.PADDLE_ENVIRONMENT = "production";

    mockFetchOnce(200, { data: { customer_auth_token: "tok_live" } });

    const { createCustomerPortalUrl } = await import("./paddle");
    const url = await createCustomerPortalUrl("ctm_live");

    expect(url).toContain("customer.paddle.com");
    expect(url).not.toContain("sandbox-");
    expect(url).toContain("tok_live");
  });

  it("throws when customer auth token is absent in the response", async () => {
    process.env.PADDLE_API_KEY = "test-key";
    process.env.PADDLE_ENVIRONMENT = "sandbox";

    mockFetchOnce(200, { data: {} }); // no customer_auth_token

    const { createCustomerPortalUrl } = await import("./paddle");
    await expect(createCustomerPortalUrl("ctm_x")).rejects.toThrow(/auth token missing/);
  });

  it("throws on non-2xx Paddle response", async () => {
    process.env.PADDLE_API_KEY = "test-key";
    process.env.PADDLE_ENVIRONMENT = "sandbox";

    mockFetchOnce(404, { error: { detail: "customer not found" } });

    const { createCustomerPortalUrl } = await import("./paddle");
    await expect(createCustomerPortalUrl("ctm_bad")).rejects.toThrow(/customer not found/);
  });
});

// ---------------------------------------------------------------------------
// verifyPaddleWebhookSignature
// ---------------------------------------------------------------------------
describe("verifyPaddleWebhookSignature", () => {
  it("returns false when secret is set but signature is null", async () => {
    process.env.PADDLE_WEBHOOK_SECRET = "super-secret";
    const { verifyPaddleWebhookSignature } = await import("./paddle");
    expect(verifyPaddleWebhookSignature("{}", null)).toBe(false);
  });

  it("returns false when PADDLE_ALLOW_UNSIGNED_WEBHOOKS is not true and no secret", async () => {
    delete process.env.PADDLE_WEBHOOK_SECRET;
    delete process.env.PADDLE_SECRET;
    process.env.PADDLE_ALLOW_UNSIGNED_WEBHOOKS = "false";
    const { verifyPaddleWebhookSignature } = await import("./paddle");
    expect(verifyPaddleWebhookSignature("{}", null)).toBe(false);
  });

  it("returns true when PADDLE_ALLOW_UNSIGNED_WEBHOOKS=true and no secret", async () => {
    delete process.env.PADDLE_WEBHOOK_SECRET;
    delete process.env.PADDLE_SECRET;
    process.env.PADDLE_ALLOW_UNSIGNED_WEBHOOKS = "true";
    const { verifyPaddleWebhookSignature } = await import("./paddle");
    expect(verifyPaddleWebhookSignature("{}", null)).toBe(true);
  });
});
