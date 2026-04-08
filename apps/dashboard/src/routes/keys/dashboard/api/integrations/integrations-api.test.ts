/**
 * Provider Integrations API: creation, verification, binding (mocked db).
 */
import { describe, it, expect, vi } from "vitest";

vi.mock("$lib/server/integrations-auth", () => ({
  getWorkspaceAndActor: vi.fn().mockResolvedValue({
    workspaceId: "ws-1",
    actorId: "u1",
    actorType: "user",
  }),
}));

const mockIntegration = {
  id: "int-1",
  workspaceId: "ws-1",
  providerType: "openai",
  displayName: null,
  status: "active",
  verificationStatus: null,
  credentialRef: null,
  createdBy: "u1",
  createdAt: 1,
  lastVerifiedAt: null,
  metadata: null,
  region: null,
};

vi.mock("$lib/server/db", () => ({
  listProviderIntegrations: vi.fn().mockResolvedValue([]),
  createProviderIntegration: vi.fn().mockResolvedValue(mockIntegration),
  getWorkspace: vi.fn(),
}));

vi.mock("$lib/server/testing-bootstrap", () => ({
  bootstrapRestormelTestingIntegration: vi.fn().mockResolvedValue(undefined),
}));

function mockEvent(overrides: Record<string, unknown> = {}) {
  return {
    params: {},
    request: new Request("http://localhost/api/integrations"),
    locals: { user: { uid: "u1" } },
    fetch: globalThis.fetch,
    getClientAddress: () => "",
    setHeaders: vi.fn(),
    isDataRequest: false,
    platform: undefined,
    route: { id: "/api/integrations" },
    url: new URL("http://localhost/api/integrations"),
    cookies: {},
    ...overrides,
  };
}

describe("GET /api/integrations", () => {
  it("returns list from workspace", async () => {
    const { GET: handler } = await import("./+server");
    const res = await handler(mockEvent() as unknown as Parameters<typeof handler>[0]);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty("data");
    expect(Array.isArray(data.data)).toBe(true);
  });
});

describe("POST /api/integrations", () => {
  it("creates integration with providerType", async () => {
    const { POST: handler } = await import("./+server");
    const res = await handler(
      mockEvent({
        request: new Request("http://localhost/api/integrations", {
          method: "POST",
          body: JSON.stringify({ providerType: "openai", displayName: "My OpenAI" }),
          headers: { "Content-Type": "application/json" },
        }),
      }) as unknown as Parameters<typeof handler>[0]
    );
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.data).toMatchObject({ providerType: "openai", status: "active" });
  });

  it("returns 400 when providerType missing", async () => {
    const { POST: handler } = await import("./+server");
    const res = await handler(
      mockEvent({
        request: new Request("http://localhost/api/integrations", {
          method: "POST",
          body: JSON.stringify({}),
          headers: { "Content-Type": "application/json" },
        }),
      }) as unknown as Parameters<typeof handler>[0]
    );
    expect(res.status).toBe(400);
  });

  it("accepts apiKey in body for hosted credential flow", async () => {
    const { POST: handler } = await import("./+server");
    const res = await handler(
      mockEvent({
        request: new Request("http://localhost/api/integrations", {
          method: "POST",
          body: JSON.stringify({
            providerType: "openai",
            displayName: "Prod",
            apiKey: "sk-test-placeholder-not-real",
          }),
          headers: { "Content-Type": "application/json" },
        }),
      }) as unknown as Parameters<typeof handler>[0]
    );
    expect(res.status).toBe(201);
  });
});
