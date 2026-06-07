import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("$lib/server/neon", () => ({
  getConnectGraphTargetForWorkspace: vi.fn(),
  getConnectGraphStatsCache: vi.fn(),
  setConnectGraphStatsCache: vi.fn(),
  getConnectGraphStats: vi.fn(),
  getConnectGraphExplorer: vi.fn(),
  getConnectDomainPackById: vi.fn(),
  listConnectDomainPacksForWorkspace: vi.fn(),
  listConnectIngestJobsForWorkspace: vi.fn(),
}));

vi.mock("$lib/server/connect/surreal-graph-store", () => ({
  buildWorkspaceGraphStore: vi.fn(),
}));

vi.mock("$lib/server/connect/domain-pack-service", () => ({
  domainPackRecordToApi: vi.fn(),
  getSelectedDomainPackId: vi.fn(),
}));

const surrealTarget = {
  id: "gt-1",
  provider: "surreal",
  endpoint: "https://x.surreal.cloud",
  namespace: "ns",
  database: "db",
  status: "ok",
};

const STATS = {
  units: 30000,
  relations: 30000,
  groups: 12,
  embedded: 30000,
  validation: { ok: 1, weak: 0, unsupported: 0, unvalidated: 0, awaiting_triage: 0, unsupported_untriaged: 0 },
};

describe("resolveConnectGraphStats caching", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns fresh cached stats without touching the graph store", async () => {
    const neon = await import("$lib/server/neon");
    const surreal = await import("$lib/server/connect/surreal-graph-store");
    vi.mocked(neon.getConnectGraphTargetForWorkspace).mockResolvedValue(surrealTarget as never);
    vi.mocked(neon.getConnectGraphStatsCache).mockResolvedValue({
      stats: STATS,
      domainPackId: "pack-1",
      computedAt: Date.now(), // fresh
    });

    const { resolveConnectGraphStats } = await import("./graph-explorer-service");
    const result = await resolveConnectGraphStats("ws-1");

    expect(result).toEqual(STATS);
    // The whole point: no store scan on a cache hit.
    expect(surreal.buildWorkspaceGraphStore).not.toHaveBeenCalled();
    expect(neon.setConnectGraphStatsCache).not.toHaveBeenCalled();
  });

  it("recomputes when the cache is stale and writes it back", async () => {
    const neon = await import("$lib/server/neon");
    const surreal = await import("$lib/server/connect/surreal-graph-store");
    vi.mocked(neon.getConnectGraphTargetForWorkspace).mockResolvedValue(surrealTarget as never);
    vi.mocked(neon.getConnectGraphStatsCache).mockResolvedValue({
      stats: STATS,
      domainPackId: "pack-1",
      computedAt: Date.now() - 60 * 60_000, // an hour old → stale
    });
    // Store unavailable → compute returns null → falls back to the stale cache.
    vi.mocked(surreal.buildWorkspaceGraphStore).mockResolvedValue(null);

    const { resolveConnectGraphStats } = await import("./graph-explorer-service");
    const result = await resolveConnectGraphStats("ws-1");

    expect(surreal.buildWorkspaceGraphStore).toHaveBeenCalled();
    // Compute failed, so we serve the stale cache rather than nothing.
    expect(result).toEqual(STATS);
  });

  it("recomputes when the cache is fresh but reports zero units", async () => {
    const neon = await import("$lib/server/neon");
    const surreal = await import("$lib/server/connect/surreal-graph-store");
    vi.mocked(neon.getConnectGraphTargetForWorkspace).mockResolvedValue(surrealTarget as never);
    vi.mocked(neon.getConnectGraphStatsCache).mockResolvedValue({
      stats: { ...STATS, units: 0 },
      domainPackId: "pack-1",
      computedAt: Date.now(),
    });
    vi.mocked(surreal.buildWorkspaceGraphStore).mockResolvedValue(null);

    const { resolveConnectGraphStats } = await import("./graph-explorer-service");
    await resolveConnectGraphStats("ws-1");

    expect(surreal.buildWorkspaceGraphStore).toHaveBeenCalled();
  });

  it("forceRefresh bypasses a fresh cache", async () => {
    const neon = await import("$lib/server/neon");
    const surreal = await import("$lib/server/connect/surreal-graph-store");
    vi.mocked(neon.getConnectGraphTargetForWorkspace).mockResolvedValue(surrealTarget as never);
    vi.mocked(neon.getConnectGraphStatsCache).mockResolvedValue({
      stats: STATS,
      domainPackId: "pack-1",
      computedAt: Date.now(),
    });
    vi.mocked(surreal.buildWorkspaceGraphStore).mockResolvedValue(null);

    const { resolveConnectGraphStats } = await import("./graph-explorer-service");
    await resolveConnectGraphStats("ws-1", { forceRefresh: true });

    expect(surreal.buildWorkspaceGraphStore).toHaveBeenCalled();
  });
});
