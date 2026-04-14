/**
 * Steps API stepId operations tests (mocked db).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("$lib/server/db", () => ({
  getRoute: vi.fn().mockResolvedValue({ id: "r1" }),
  listRouteSteps: vi.fn().mockResolvedValue([
    {
      id: "s1",
      routeId: "r1",
      orderIndex: 0,
      providerPreference: "anthropic",
      modelId: null,
      conditionBlock: null,
      fallbackOn: "error",
      timeoutMs: null,
      enabled: true,
      createdAt: new Date(1).toISOString(),
      updatedAt: new Date(1).toISOString(),
    },
  ]),
  updateRouteStep: vi.fn().mockResolvedValue({
    id: "s1",
    routeId: "r1",
    orderIndex: 1,
    providerPreference: "anthropic",
    modelId: null,
    conditionBlock: null,
    fallbackOn: "error",
    timeoutMs: null,
    enabled: true,
    label: null,
    parallelGroupId: null,
    parallelBranchRole: null,
    createdAt: new Date(1).toISOString(),
    updatedAt: new Date(2).toISOString(),
  }),
  deleteRouteStep: vi.fn().mockResolvedValue(true),
  getModel: vi.fn().mockResolvedValue({ id: "gpt-4o" }),
}));

const defaultListSteps = [
  {
    id: "s1",
    routeId: "r1",
    orderIndex: 0,
    providerPreference: "anthropic",
    modelId: null,
    conditionBlock: null,
    fallbackOn: "error",
    timeoutMs: null,
    enabled: true,
    label: null,
    parallelGroupId: null,
    parallelBranchRole: null,
    createdAt: new Date(1).toISOString(),
    updatedAt: new Date(1).toISOString(),
  },
];

const defaultUpdateStepResult = {
  id: "s1",
  routeId: "r1",
  orderIndex: 1,
  providerPreference: "anthropic",
  modelId: null,
  conditionBlock: null,
  fallbackOn: "error",
  timeoutMs: null,
  enabled: true,
  label: null,
  parallelGroupId: null,
  parallelBranchRole: null,
  createdAt: new Date(1).toISOString(),
  updatedAt: new Date(2).toISOString(),
};

describe("PATCH/DELETE /api/projects/:id/routes/:routeId/steps/:stepId", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const db = await import("$lib/server/db");
    vi.mocked(db.listRouteSteps).mockResolvedValue(defaultListSteps as never);
    vi.mocked(db.updateRouteStep).mockResolvedValue(defaultUpdateStepResult as never);
  });

  it("PATCH updates a step", async () => {
    const { PATCH } = await import("./+server");
    const res = await PATCH(
      {
        params: { id: "p1", routeId: "r1", stepId: "s1" },
        locals: { user: { uid: "u1", authType: "gateway_key", projectIdForKey: "p1", keyId: "k1" } },
        request: new Request("http://localhost", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderIndex: 1 }),
        }),
      } as unknown as Parameters<typeof PATCH>[0]
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.orderIndex).toBe(1);
  });

  it("DELETE removes a step", async () => {
    const { DELETE } = await import("./+server");
    const res = await DELETE(
      {
        params: { id: "p1", routeId: "r1", stepId: "s1" },
        locals: { user: { uid: "u1", authType: "gateway_key", projectIdForKey: "p1", keyId: "k1" } },
      } as unknown as Parameters<typeof DELETE>[0]
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });

  it("PATCH duplicate orderIndex returns 409", async () => {
    const { listRouteSteps } = await import("$lib/server/db");
    vi.mocked(listRouteSteps).mockResolvedValue([
      {
        id: "s1",
        routeId: "r1",
        orderIndex: 0,
        providerPreference: "anthropic",
        modelId: null,
        conditionBlock: null,
        fallbackOn: "error",
        timeoutMs: null,
        enabled: true,
        createdAt: new Date(1).toISOString(),
        updatedAt: new Date(1).toISOString(),
      },
      {
        id: "s2",
        routeId: "r1",
        orderIndex: 1,
        providerPreference: "openai",
        modelId: null,
        conditionBlock: null,
        fallbackOn: "error",
        timeoutMs: null,
        enabled: true,
        createdAt: new Date(1).toISOString(),
        updatedAt: new Date(1).toISOString(),
      },
    ]);
    const { PATCH } = await import("./+server");
    const res = await PATCH(
      {
        params: { id: "p1", routeId: "r1", stepId: "s1" },
        locals: { user: { uid: "u1", authType: "gateway_key", projectIdForKey: "p1", keyId: "k1" } },
        request: new Request("http://localhost", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderIndex: 1 }),
        }),
      } as unknown as Parameters<typeof PATCH>[0]
    );
    expect(res.status).toBe(409);
  });

  it("PATCH rejects label longer than max length", async () => {
    const { ROUTE_STEP_LABEL_MAX_LENGTH } = await import("$lib/route-step-label");
    const { PATCH } = await import("./+server");
    const res = await PATCH(
      {
        params: { id: "p1", routeId: "r1", stepId: "s1" },
        locals: { user: { uid: "u1", authType: "gateway_key", projectIdForKey: "p1", keyId: "k1" } },
        request: new Request("http://localhost", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ label: "x".repeat(ROUTE_STEP_LABEL_MAX_LENGTH + 1) }),
        }),
      } as unknown as Parameters<typeof PATCH>[0]
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error?: string };
    expect(body.error).toBe("invalid_step_schema");
  });
});

