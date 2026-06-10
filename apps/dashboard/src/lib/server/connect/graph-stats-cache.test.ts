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

const postgresTarget = {
  id: "gt-pg",
  provider: "postgres",
  useDashboardDatabase: true,
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

describe("resolveConnectGraphStats — per-request memo (F6)", () => {
  beforeEach(() => vi.clearAllMocks());

  /**
   * Core acceptance criterion: resolveConnectGraphStats is invoked at most once per
   * hub request when a shared requestMemo is provided. The second caller reuses the
   * first caller's in-flight Promise — getConnectGraphTargetForWorkspace (the first
   * I/O on the hot path) is called exactly once no matter how many concurrent
   * consumers share the memo.
   */
  it("two concurrent callers sharing a memo produce exactly one stats resolution", async () => {
    const neon = await import("$lib/server/neon");
    vi.mocked(neon.getConnectGraphTargetForWorkspace).mockResolvedValue(surrealTarget as never);
    vi.mocked(neon.getConnectGraphStatsCache).mockResolvedValue({
      stats: STATS,
      domainPackId: "pack-1",
      computedAt: Date.now(),
    });

    const { resolveConnectGraphStats } = await import("./graph-explorer-service");
    const memo = new Map();

    // Simulate the hub load: pulse + scorecard both call resolveConnectGraphStats
    // concurrently with the same shared memo.
    const [r1, r2] = await Promise.all([
      resolveConnectGraphStats("ws-memo-1", { requestMemo: memo }),
      resolveConnectGraphStats("ws-memo-1", { requestMemo: memo }),
    ]);

    expect(r1).toEqual(STATS);
    expect(r2).toEqual(STATS);

    // Despite two concurrent calls, getConnectGraphTargetForWorkspace is called only
    // once — the second call reused the memoised promise.
    expect(neon.getConnectGraphTargetForWorkspace).toHaveBeenCalledTimes(1);
  });

  it("forceRefresh bypasses the memo and issues a fresh resolution", async () => {
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
    const memo = new Map();

    // First call populates memo.
    await resolveConnectGraphStats("ws-force-1", { requestMemo: memo });
    // forceRefresh must bypass the memo entirely.
    await resolveConnectGraphStats("ws-force-1", { requestMemo: memo, forceRefresh: true });

    // getConnectGraphTargetForWorkspace called twice: once for normal, once for force.
    expect(neon.getConnectGraphTargetForWorkspace).toHaveBeenCalledTimes(2);
    // buildWorkspaceGraphStore called for the forced recompute.
    expect(surreal.buildWorkspaceGraphStore).toHaveBeenCalledTimes(1);
  });

  it("different workspace IDs in the same memo resolve independently", async () => {
    const neon = await import("$lib/server/neon");
    vi.mocked(neon.getConnectGraphTargetForWorkspace).mockResolvedValue(surrealTarget as never);
    vi.mocked(neon.getConnectGraphStatsCache).mockResolvedValue({
      stats: STATS,
      domainPackId: "pack-1",
      computedAt: Date.now(),
    });

    const { resolveConnectGraphStats } = await import("./graph-explorer-service");
    const memo = new Map();

    await Promise.all([
      resolveConnectGraphStats("ws-a", { requestMemo: memo }),
      resolveConnectGraphStats("ws-b", { requestMemo: memo }),
    ]);

    // Each workspace triggers its own resolution.
    expect(neon.getConnectGraphTargetForWorkspace).toHaveBeenCalledTimes(2);
    // Both entries are stored in the memo under separate keys.
    expect(memo.size).toBe(2);
  });
});

describe("resolveConnectGraphStats — Postgres spine cache (F6)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("calls getConnectGraphStats only once within the TTL for a Postgres target", async () => {
    const neon = await import("$lib/server/neon");
    vi.mocked(neon.getConnectGraphTargetForWorkspace).mockResolvedValue(postgresTarget as never);
    vi.mocked(neon.getConnectGraphStats).mockResolvedValue(STATS);

    const { resolveConnectGraphStats, invalidateConnectGraphStatsCache } =
      await import("./graph-explorer-service");

    // Evict any stale process-level entry from previous tests.
    invalidateConnectGraphStatsCache("ws-pg-1");

    const [r1, r2] = await Promise.all([
      resolveConnectGraphStats("ws-pg-1"),
      resolveConnectGraphStats("ws-pg-1"),
    ]);

    expect(r1).toEqual(STATS);
    expect(r2).toEqual(STATS);
    // Only one Neon round-trip despite two callers — the spine cache absorbs the second.
    expect(neon.getConnectGraphStats).toHaveBeenCalledTimes(1);
  });
});
