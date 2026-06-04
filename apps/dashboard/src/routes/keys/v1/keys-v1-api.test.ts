/**
 * /keys/v1/* route wiring — param mapping and auth delegation.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("$lib/server/db", () => ({
  evaluatePolicies: vi.fn().mockResolvedValue([]),
  getOrCreateDefaultWorkspace: vi.fn().mockResolvedValue({
    id: "ws-1",
    name: "Default",
    slug: "default",
    ownerUserId: "u1",
    createdAt: 0,
    plan: "free",
    planExpiresAt: null,
  }),
  getProject: vi.fn().mockResolvedValue({
    id: "proj-1",
    userId: "u1",
    workspaceId: "ws-1",
  }),
  getProjectInWorkspace: vi.fn(),
  insertRequestLog: vi.fn(),
  aggregateRequestLogsToUsage: vi.fn().mockResolvedValue([]),
}));

vi.mock("$lib/server/route-resolver", () => ({
  resolveRouteForExecution: vi.fn().mockResolvedValue({
    ok: false,
    failure: { code: "route_not_found", message: "not found" },
  }),
}));

vi.mock("$lib/server/entitlements", () => ({
  getWorkspaceEntitlements: vi.fn().mockResolvedValue(null),
}));

const jsonReq = (body: unknown) =>
  new Request("http://localhost", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

describe("POST /keys/v1/projects/{projectId}/resolve", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    const { POST } = await import("./projects/[projectId]/resolve/+server");
    const res = await POST({
      params: { projectId: "proj-1" },
      request: jsonReq({ environmentId: "env-1" }),
      locals: {},
    } as unknown as Parameters<typeof POST>[0]);
    expect(res.status).toBe(401);
  });

  it("maps projectId path param to resolve scope", async () => {
    const { POST } = await import("./projects/[projectId]/resolve/+server");
    const res = await POST({
      params: { projectId: "proj-other" },
      request: jsonReq({ environmentId: "env-1" }),
      locals: {
        user: { uid: "u1", authType: "gateway_key", projectIdForKey: "proj-other", keyId: "k1" },
      },
    } as unknown as Parameters<typeof POST>[0]);
    expect(res.status).toBe(404);
  });
});

describe("POST /keys/v1/policies/evaluate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("delegates to dashboard evaluate handler", async () => {
    const { POST } = await import("./policies/evaluate/+server");
    const { evaluatePolicies } = await import("$lib/server/db");

    const res = await POST({
      request: jsonReq({ projectId: "proj-1", modelId: "gpt-4o" }),
      locals: { user: { uid: "u1", authType: "gateway_key", projectIdForKey: "proj-1", keyId: "k1" } },
    } as unknown as Parameters<typeof POST>[0]);

    expect(res.status).toBe(200);
    expect(vi.mocked(evaluatePolicies)).toHaveBeenCalled();
  });
});
