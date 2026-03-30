import { afterEach, describe, expect, it, vi } from "vitest";

type MockUser = {
  uid: string;
  email?: string | null;
  authType?: "session" | "gateway_key" | "management_key";
};

function mockEvent(overrides: Record<string, unknown> = {}) {
  return {
    locals: {
      user: { uid: "user-1", email: "user@example.com" } as MockUser,
    },
    request: new Request("http://localhost/keys/dashboard/api/feedback", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: "Title",
        description: "Something happened.",
        category: "bug",
      }),
    }),
    ...overrides,
  };
}

describe("POST /api/feedback", () => {
  const originalToken = process.env.FEEDBACK_GITHUB_TOKEN;
  const originalRepo = process.env.FEEDBACK_GITHUB_REPO;

  afterEach(() => {
    process.env.FEEDBACK_GITHUB_TOKEN = originalToken;
    process.env.FEEDBACK_GITHUB_REPO = originalRepo;
    vi.unstubAllGlobals();
  });

  it("returns 401 when session is missing", async () => {
    const { POST } = await import("./+server");
    const res = await POST(mockEvent({ locals: { user: undefined } }) as unknown as Parameters<typeof POST>[0]);
    expect(res.status).toBe(401);
  });

  it("returns 400 when body is invalid", async () => {
    const { POST } = await import("./+server");
    const res = await POST(
      mockEvent({
        request: new Request("http://localhost/keys/dashboard/api/feedback", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ title: "", description: "", category: "invalid" }),
        }),
      }) as unknown as Parameters<typeof POST>[0]
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.fieldErrors).toBeDefined();
  });

  it("returns 200 when valid and token not configured", async () => {
    process.env.FEEDBACK_GITHUB_TOKEN = "";
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { POST } = await import("./+server");
    const res = await POST(mockEvent() as unknown as Parameters<typeof POST>[0]);
    expect(res.status).toBe(200);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns 200 and calls GitHub API when valid and token configured", async () => {
    process.env.FEEDBACK_GITHUB_TOKEN = "test_feedback_token";
    process.env.FEEDBACK_GITHUB_REPO = "restormel-keys/restormel-keys";
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: 123 }), { status: 201, headers: { "content-type": "application/json" } })
    );
    vi.stubGlobal("fetch", fetchMock);

    const { POST } = await import("./+server");
    const res = await POST(mockEvent() as unknown as Parameters<typeof POST>[0]);

    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.github.com/repos/restormel-keys/restormel-keys/issues",
      expect.objectContaining({ method: "POST" })
    );
  });
});
