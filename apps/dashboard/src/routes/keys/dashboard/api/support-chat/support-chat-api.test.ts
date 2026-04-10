import { describe, expect, it, vi } from "vitest";

vi.mock("@restormel/support", () => ({
  createSupportRateLimiter: () => ({ tryConsume: () => true }),
  isSupportRuntimeConfigured: () => true,
  parseSupportMessages: (raw: unknown) => {
    if (!Array.isArray(raw) || raw.length === 0) return null;
    return [{ role: "user" as const, content: "hello" }];
  },
  supportChatToTextStreamResponse: vi.fn(() => new Response("ok", { status: 200, headers: { "content-type": "text/plain" } })),
  supportModelFromEnv: () => "gpt-4o-mini",
}));

type MockLocals = { user?: { uid: string; authType?: string } };

function mockEvent(overrides: { locals?: MockLocals; body?: unknown } = {}) {
  const body = overrides.body ?? { messages: [{ role: "user", content: "hello" }] };
  return {
    locals: {
      user: { uid: "user-1", authType: "session" },
      ...overrides.locals,
    },
    request: new Request("http://localhost/keys/dashboard/api/support-chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  };
}

describe("POST /keys/dashboard/api/support-chat", () => {
  it("returns 401 without session user", async () => {
    const { POST } = await import("./+server");
    const res = await POST(
      mockEvent({ locals: { user: undefined } }) as unknown as Parameters<typeof POST>[0]
    );
    expect(res.status).toBe(401);
  });

  it("returns 401 for gateway_key", async () => {
    const { POST } = await import("./+server");
    const res = await POST(
      mockEvent({
        locals: { user: { uid: "u1", authType: "gateway_key" } },
      }) as unknown as Parameters<typeof POST>[0]
    );
    expect(res.status).toBe(401);
  });

  it("returns 400 for invalid messages", async () => {
    const { POST } = await import("./+server");
    const res = await POST(
      mockEvent({ body: { messages: [] } }) as unknown as Parameters<typeof POST>[0]
    );
    expect(res.status).toBe(400);
  });

  it("returns 200 when OpenAI key set and mock streams", async () => {
    const prev = process.env.OPENAI_API_KEY;
    process.env.OPENAI_API_KEY = "sk-test";
    const { POST } = await import("./+server");
    const res = await POST(mockEvent() as unknown as Parameters<typeof POST>[0]);
    process.env.OPENAI_API_KEY = prev;
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("ok");
  });
});
