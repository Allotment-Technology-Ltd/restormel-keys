import { describe, it, expect, vi } from "vitest";

vi.mock("$lib/server/integrations-auth", () => ({
  getWorkspaceAndActor: vi.fn(),
}));

vi.mock("$lib/server/db", () => ({
  aggregateRequestLogsToUsage: vi.fn(),
  listRequestLogs: vi.fn(),
  getRequestLogCountsByUtcDay: vi.fn(),
  getEstimatedCostUsdByModel: vi.fn(),
}));

describe("/keys/dashboard/analytics load", () => {
  it("returns empty state data when there is no usage yet", async () => {
    const { getWorkspaceAndActor } = await import("$lib/server/integrations-auth");
    const db = await import("$lib/server/db");
    vi.mocked(getWorkspaceAndActor).mockResolvedValue({ workspaceId: "ws1", actorId: "u1", actorType: "user" });
    vi.mocked(db.aggregateRequestLogsToUsage).mockResolvedValue([]);
    vi.mocked(db.listRequestLogs).mockResolvedValue([]);
    vi.mocked(db.getRequestLogCountsByUtcDay).mockResolvedValue([]);
    vi.mocked(db.getEstimatedCostUsdByModel).mockResolvedValue([]);

    const mod = await import("./+page.server");
    const res = (await mod.load({
      url: new URL("http://localhost/keys/dashboard/analytics?days=7"),
      locals: { user: { uid: "u1" } },
    } as any)) as any;

    expect(res.error).toBeNull();
    expect(res.aggregates).toEqual([]);
    expect(res.recentLogs).toEqual([]);
    expect(res.usageCharts).not.toBeNull();
    expect(res.usageCharts?.dailyRequests.length).toBe(30);
  });

  it("does not throw when workspace resolution fails (returns error)", async () => {
    const { getWorkspaceAndActor } = await import("$lib/server/integrations-auth");
    vi.mocked(getWorkspaceAndActor).mockRejectedValue(new Error("boom"));

    const mod = await import("./+page.server");
    const res = (await mod.load({
      url: new URL("http://localhost/keys/dashboard/analytics?days=7"),
      locals: { user: { uid: "u1" } },
    } as any)) as any;

    expect(res.error).toBeTruthy();
    expect(res.aggregates).toEqual([]);
    expect(res.usageCharts).toBeNull();
  });
});

