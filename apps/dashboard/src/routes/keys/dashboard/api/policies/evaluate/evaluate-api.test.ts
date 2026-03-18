/**
 * /api/policies/evaluate auth scope tests.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("$lib/server/db", () => ({
  evaluatePolicies: vi.fn().mockResolvedValue([]),
  getOrCreateDefaultWorkspace: vi.fn().mockResolvedValue({ id: "ws-1" }),
  getProject: vi.fn().mockResolvedValue({
    id: "proj-1",
    userId: "u1",
    workspaceId: "ws-1",
  }),
}));

const jsonReq = (body: unknown) =>
  new Request("http://localhost", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

describe("POST /api/policies/evaluate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    const { POST } = await import("./+server");
    const res = await POST({ request: jsonReq({}), locals: {} } as unknown as Parameters<typeof POST>[0]);
    expect(res.status).toBe(401);
  });

  it("accepts gateway key and forces key project scope", async () => {
    const { POST } = await import("./+server");
    const { evaluatePolicies } = await import("$lib/server/db");

    const res = await POST(
      {
        request: jsonReq({ projectId: "proj-1", modelId: "gpt-4o" }),
        locals: { user: { uid: "u1", authType: "gateway_key", projectIdForKey: "proj-1", keyId: "k1" } },
      } as unknown as Parameters<typeof POST>[0]
    );

    expect(res.status).toBe(200);
    expect(vi.mocked(evaluatePolicies)).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: "ws-1",
        projectId: "proj-1",
        modelId: "gpt-4o",
      })
    );
  });

  it("rejects gateway key when body projectId differs", async () => {
    const { POST } = await import("./+server");
    const res = await POST(
      {
        request: jsonReq({ projectId: "proj-2" }),
        locals: { user: { uid: "u1", authType: "gateway_key", projectIdForKey: "proj-1", keyId: "k1" } },
      } as unknown as Parameters<typeof POST>[0]
    );
    expect(res.status).toBe(403);
  });

  it("rejects deprecated management_key auth", async () => {
    const { POST } = await import("./+server");
    const res = await POST(
      {
        request: jsonReq({ modelId: "gpt-4o" }),
        locals: { user: { uid: "u1", authType: "management_key", workspaceId: "ws-1", keyId: "mk1" } },
      } as unknown as Parameters<typeof POST>[0]
    );
    expect(res.status).toBe(403);
  });
});

