import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * Uses real `@restormel/support` env helpers (no mock) — isolated from support-chat-api.test.ts.
 */
describe("POST /keys/dashboard/api/support-chat (configuration)", () => {
  const prevKey = process.env.OPENAI_API_KEY;
  const prevEnabled = process.env.RESTORMEL_SUPPORT_ENABLED;

  afterEach(() => {
    process.env.OPENAI_API_KEY = prevKey;
    process.env.RESTORMEL_SUPPORT_ENABLED = prevEnabled;
  });

  it("returns 503 when OPENAI_API_KEY missing", async () => {
    vi.resetModules();
    delete process.env.OPENAI_API_KEY;
    delete process.env.RESTORMEL_SUPPORT_ENABLED;
    const { POST } = await import("./+server");
    const res = await POST({
      locals: { user: { uid: "u1", authType: "session" as const } },
      request: new Request("http://localhost/keys/dashboard/api/support-chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: [{ role: "user", content: "hi" }] }),
      }),
    } as unknown as Parameters<typeof POST>[0]);
    expect(res.status).toBe(503);
  });
});
