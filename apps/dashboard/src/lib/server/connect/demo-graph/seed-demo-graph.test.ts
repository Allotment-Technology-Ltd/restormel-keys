/**
 * Phase 3 Stage 0 — demo-graph seed: corpus loading, idempotency, swappability.
 * The Postgres writers are mocked so this stays a hermetic unit test.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const findLatestConnectGraphSourceByKeyPostgres = vi.fn();
const insertConnectGraphSourcePostgres = vi.fn();
const storeExtractedGraphPostgres = vi.fn();
const upsertConnectGraphTarget = vi.fn();
const listConnectGraphTargetsForWorkspace = vi.fn();
const getConnectGraphStats = vi.fn();

vi.mock("$lib/server/neon", () => ({
  findLatestConnectGraphSourceByKeyPostgres: (...a: unknown[]) =>
    findLatestConnectGraphSourceByKeyPostgres(...a),
  insertConnectGraphSourcePostgres: (...a: unknown[]) => insertConnectGraphSourcePostgres(...a),
  storeExtractedGraphPostgres: (...a: unknown[]) => storeExtractedGraphPostgres(...a),
  upsertConnectGraphTarget: (...a: unknown[]) => upsertConnectGraphTarget(...a),
  listConnectGraphTargetsForWorkspace: (...a: unknown[]) =>
    listConnectGraphTargetsForWorkspace(...a),
  getConnectGraphStats: (...a: unknown[]) => getConnectGraphStats(...a),
}));

import {
  loadDemoGraphSeed,
  demoGraphSuggestedQuestions,
  activeDemoGraphSeedId,
  seedDemoGraph,
  DEFAULT_DEMO_GRAPH_SEED_ID,
} from "./seed-demo-graph";

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.CONNECT_DEMO_GRAPH_SEED;
  upsertConnectGraphTarget.mockResolvedValue({ id: "tgt-1" });
  listConnectGraphTargetsForWorkspace.mockResolvedValue([]);
  insertConnectGraphSourcePostgres.mockImplementation(async () => `src-${Math.random()}`);
  storeExtractedGraphPostgres.mockImplementation(async (p: { units: unknown[]; relations: unknown[] }) => ({
    units: (p.units as unknown[]).map((_, i) => ({ id: `u-${i}`, text: "t", type: "claim" })),
    relations: (p.relations as unknown[]).length,
  }));
});

describe("demo-graph seed corpus", () => {
  it("loads the default philosophy seed with sources and an abstention question", () => {
    const seed = loadDemoGraphSeed();
    expect(seed.id).toBe(DEFAULT_DEMO_GRAPH_SEED_ID);
    expect(seed.sources.length).toBeGreaterThanOrEqual(3);
    // Every source carries a stable cross-run key (drives idempotency).
    for (const s of seed.sources) expect(s.key).toMatch(/^demo:/);
    // First-run UX needs at least one answerable and one abstention question.
    const qs = demoGraphSuggestedQuestions();
    expect(qs.some((q) => q.type === "answerable")).toBe(true);
    expect(qs.some((q) => q.type === "abstention")).toBe(true);
  });

  it("is swappable by id via CONNECT_DEMO_GRAPH_SEED (defaults to shipped corpus)", () => {
    expect(activeDemoGraphSeedId()).toBe(DEFAULT_DEMO_GRAPH_SEED_ID);
    process.env.CONNECT_DEMO_GRAPH_SEED = DEFAULT_DEMO_GRAPH_SEED_ID;
    expect(activeDemoGraphSeedId()).toBe(DEFAULT_DEMO_GRAPH_SEED_ID);
    process.env.CONNECT_DEMO_GRAPH_SEED = "does-not-exist-corpus";
    expect(() => loadDemoGraphSeed()).toThrow(/not found/);
  });
});

describe("seedDemoGraph", () => {
  it("writes a postgres graph target + sources + units when not yet seeded", async () => {
    findLatestConnectGraphSourceByKeyPostgres.mockResolvedValue(null);
    const result = await seedDemoGraph("ws-1");

    expect(result.already_seeded).toBe(false);
    expect(result.sourcesSeeded).toBeGreaterThanOrEqual(3);
    expect(result.unitsSeeded).toBeGreaterThan(0);

    // Registers a dashboard-Postgres graph target with status ok (zero external setup).
    expect(upsertConnectGraphTarget).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: "postgres",
        useDashboardDatabase: true,
        status: "ok",
      }),
    );
    // Uses the canonical pipeline writer for units/relations.
    expect(storeExtractedGraphPostgres).toHaveBeenCalled();
  });

  it("is idempotent: a no-op (no writes) once the demo source key exists", async () => {
    // Probe key already present → early-return.
    findLatestConnectGraphSourceByKeyPostgres.mockResolvedValue({ id: "existing", contentHash: "x" });
    const result = await seedDemoGraph("ws-1");

    expect(result.already_seeded).toBe(true);
    expect(result.sourcesSeeded).toBe(0);
    expect(insertConnectGraphSourcePostgres).not.toHaveBeenCalled();
    expect(storeExtractedGraphPostgres).not.toHaveBeenCalled();
  });
});
