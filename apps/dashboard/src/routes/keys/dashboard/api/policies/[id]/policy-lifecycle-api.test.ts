import { describe, expect, it, vi } from "vitest";

vi.mock("$lib/server/integrations-auth", () => ({
  getWorkspaceAndActor: vi.fn().mockResolvedValue({ workspaceId: "ws1", actorId: "u1", actorType: "user" }),
}));

vi.mock("$lib/server/db", () => ({
  getPolicy: vi.fn().mockResolvedValue({
    id: "pol1",
    name: "Budget",
    type: "budget_cap",
    status: "active",
    ruleDefinition: { limit: 10 },
  }),
  listPolicyVersionEvents: vi.fn().mockResolvedValue([{ version: 1 }]),
  insertPolicyVersionEvent: vi.fn().mockResolvedValue({ id: "ev1", version: 2 }),
  getPolicyVersionEventByVersion: vi.fn().mockResolvedValue({
    version: 1,
    policySnapshot: { name: "Budget v1", type: "budget_cap", status: "active", ruleDefinition: { limit: 5 } },
  }),
  updatePolicy: vi.fn().mockResolvedValue({
    id: "pol1",
    name: "Budget",
    type: "budget_cap",
    status: "active",
    ruleDefinition: { limit: 10 },
  }),
}));

describe("Policy lifecycle endpoints", () => {
  it("returns history", async () => {
    const { GET } = await import("./history/+server");
    const res = await GET({ params: { id: "pol1" }, url: new URL("https://x.test"), locals: {} } as any);
    expect(res.status).toBe(200);
  });

  it("publishes policy version", async () => {
    const { POST } = await import("./publish/+server");
    const res = await POST({ params: { id: "pol1" }, locals: {} } as any);
    expect(res.status).toBe(200);
  });

  it("rolls back policy", async () => {
    const { POST } = await import("./rollback/+server");
    const res = await POST({
      params: { id: "pol1" },
      request: new Request("https://x.test", { method: "POST", body: JSON.stringify({ toVersion: 1 }) }),
      locals: {},
    } as any);
    expect(res.status).toBe(200);
  });

  it("returns policy diff", async () => {
    const { POST } = await import("./diff/+server");
    const res = await POST({
      params: { id: "pol1" },
      request: new Request("https://x.test", { method: "POST", body: JSON.stringify({ fromVersion: 1 }) }),
      locals: {},
    } as any);
    expect(res.status).toBe(200);
  });
});
