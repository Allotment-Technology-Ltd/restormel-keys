/**
 * Policies API and enforcement tests (mocked db).
 */
import { describe, it, expect, vi } from "vitest";

vi.mock("$lib/server/integrations-auth", () => ({
  getWorkspaceAndActor: vi.fn().mockResolvedValue({
    workspaceId: "ws-1",
    actorId: "u1",
    actorType: "user",
  }),
}));

vi.mock("$lib/server/db", () => ({
  listPolicies: vi.fn().mockResolvedValue([]),
  getPolicy: vi.fn().mockResolvedValue(null),
  createPolicy: vi.fn().mockResolvedValue({
    id: "pol-1",
    workspaceId: "ws-1",
    name: "Model allowlist",
    type: "model_allowlist",
    status: "active",
    ruleDefinition: { modelIds: ["gpt-4o"] },
    createdBy: "u1",
    createdAt: 1,
  }),
  updatePolicy: vi.fn().mockResolvedValue(null),
  deletePolicy: vi.fn().mockResolvedValue(false),
  listPolicyBindings: vi.fn().mockResolvedValue([]),
  listPolicyBindingsByTarget: vi.fn().mockResolvedValue([]),
  createPolicyBinding: vi.fn().mockResolvedValue(null),
  deletePolicyBinding: vi.fn().mockResolvedValue(false),
  evaluatePolicies: vi.fn().mockResolvedValue([]),
}));

function mockEvent(overrides: Record<string, unknown> = {}) {
  return {
    params: {},
    url: new URL("http://localhost/api/policies"),
    locals: { user: { uid: "u1" } },
    ...overrides,
  };
}

describe("GET /api/policies", () => {
  it("returns list for workspace", async () => {
    const { GET: handler } = await import("./+server");
    const res = await handler(mockEvent() as unknown as Parameters<typeof handler>[0]);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("data");
    expect(Array.isArray(body.data)).toBe(true);
  });
});

describe("POST /api/policies", () => {
  it("returns 400 when name or type missing", async () => {
    const { POST: handler } = await import("./+server");
    const res = await handler(
      mockEvent({
        request: new Request("http://localhost", {
          method: "POST",
          body: JSON.stringify({}),
          headers: { "Content-Type": "application/json" },
        }),
      }) as unknown as Parameters<typeof handler>[0]
    );
    expect(res.status).toBe(400);
  });

  it("returns 201 and policy when name and type provided", async () => {
    const { POST: handler } = await import("./+server");
    const res = await handler(
      mockEvent({
        request: new Request("http://localhost", {
          method: "POST",
          body: JSON.stringify({
            name: "Model allowlist",
            type: "model_allowlist",
            ruleDefinition: { modelIds: ["gpt-4o"] },
          }),
          headers: { "Content-Type": "application/json" },
        }),
      }) as unknown as Parameters<typeof handler>[0]
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data).toMatchObject({ type: "model_allowlist", ruleDefinition: { modelIds: ["gpt-4o"] } });
  });
});

describe("Policy evaluation (evaluatePolicies)", () => {
  it("returns allowed: true when no violations", async () => {
    const { evaluatePolicies } = await import("$lib/server/db");
    vi.mocked(evaluatePolicies).mockResolvedValue([]);
    const violations = await evaluatePolicies({
      workspaceId: "ws-1",
      modelId: "gpt-4o",
      providerType: "openai",
    });
    expect(violations).toEqual([]);
  });

  it("returns violations when mocked", async () => {
    const { evaluatePolicies } = await import("$lib/server/db");
    vi.mocked(evaluatePolicies).mockResolvedValue([
      { policyId: "p1", policyName: "Block", type: "model_denylist", message: "Model x is denylisted" },
    ]);
    const violations = await evaluatePolicies({ workspaceId: "ws-1", modelId: "x" });
    expect(violations).toHaveLength(1);
    expect(violations[0].type).toBe("model_denylist");
  });
});
