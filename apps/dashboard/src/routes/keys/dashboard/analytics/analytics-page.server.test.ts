import { describe, it, expect, vi } from "vitest";

vi.mock("$lib/server/integrations-auth", () => ({
  getWorkspaceAndActor: vi.fn(),
}));

vi.mock("$lib/server/db", () => ({
  aggregateRequestLogsToUsage: vi.fn(),
  listRequestLogs: vi.fn(),
  getRequestLogCountsByUtcDay: vi.fn(),
  getEstimatedCostUsdByModel: vi.fn(),
  getProjectInWorkspace: vi.fn(),
  listProjects: vi.fn(),
  listProjectsByWorkspace: vi.fn(),
}));

vi.mock("$lib/server/connect/verification-economics-source", () => ({
  loadVerificationEconomicsByCorpus: vi.fn(),
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
    vi.mocked(db.listProjects).mockResolvedValue([]);

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

/**
 * RES-113 PR-8 (copy pack §2.8; placement spec §5 item 9): verification-economics
 * data is fetched ONLY behind the `m1PlugPoints` flag — flag OFF, the payload is
 * null and the source helper is never called (the flag-OFF byte-identical
 * invariant on the load path).
 */
describe("/keys/dashboard/analytics load — §2.8 verification economics", () => {
  async function loadWith(locals: Record<string, unknown>) {
    const { getWorkspaceAndActor } = await import("$lib/server/integrations-auth");
    const db = await import("$lib/server/db");
    vi.mocked(getWorkspaceAndActor).mockResolvedValue({
      workspaceId: "ws1",
      actorId: "u1",
      actorType: "user",
    } as never);
    vi.mocked(db.aggregateRequestLogsToUsage).mockResolvedValue([] as never);
    vi.mocked(db.listRequestLogs).mockResolvedValue([] as never);
    vi.mocked(db.getRequestLogCountsByUtcDay).mockResolvedValue([] as never);
    vi.mocked(db.getEstimatedCostUsdByModel).mockResolvedValue([] as never);
    vi.mocked(db.listProjects).mockResolvedValue([] as never);
    const mod = await import("./+page.server");
    return (await mod.load({
      url: new URL("http://localhost/keys/dashboard/analytics?days=7"),
      locals,
    } as never)) as Record<string, unknown>;
  }

  it("flag OFF: verificationEconomics is null and the source is never queried", async () => {
    const { loadVerificationEconomicsByCorpus } = await import(
      "$lib/server/connect/verification-economics-source"
    );
    vi.mocked(loadVerificationEconomicsByCorpus).mockClear();
    const res = await loadWith({ user: { uid: "u1" } });
    expect(res.verificationEconomics).toBeNull();
    expect(loadVerificationEconomicsByCorpus).not.toHaveBeenCalled();
  });

  it("flag ON: returns the per-corpus measurements from the source helper", async () => {
    const { loadVerificationEconomicsByCorpus } = await import(
      "$lib/server/connect/verification-economics-source"
    );
    vi.mocked(loadVerificationEconomicsByCorpus).mockResolvedValue([
      { corpus: "Contracts", facts_checked: 12 },
    ]);
    const res = await loadWith({
      user: { uid: "u1" },
      moduleFlags: { m1PlugPoints: true },
    });
    expect(res.verificationEconomics).toEqual([{ corpus: "Contracts", facts_checked: 12 }]);
  });

  it("flag ON, empty measurements: an empty list (the section earns no pixels)", async () => {
    const { loadVerificationEconomicsByCorpus } = await import(
      "$lib/server/connect/verification-economics-source"
    );
    vi.mocked(loadVerificationEconomicsByCorpus).mockResolvedValue([]);
    const res = await loadWith({
      user: { uid: "u1" },
      moduleFlags: { m1PlugPoints: true },
    });
    expect(res.verificationEconomics).toEqual([]);
  });
});

