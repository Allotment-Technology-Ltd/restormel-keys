/**
 * Trust scorecard service (Stage 1.2): pure composition semantics (fail-safe EBV
 * folding, clamped percentages, coverage unknowns) and store-aware loading.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { ConnectTrustScorecardSchema } from "@restormel/contracts";

vi.mock("$lib/server/neon", () => ({
  countConnectVersionedUnitsPostgres: vi.fn(),
  getConnectClaimVersionBreakdownPostgres: vi.fn(),
  getConnectGraphCoverageCountsPostgres: vi.fn(),
  listConnectIngestJobsForWorkspace: vi.fn(),
}));

vi.mock("$lib/server/connect/graph-explorer-service", () => ({
  peekConnectGraphStats: vi.fn(),
  resolveConnectGraphStats: vi.fn(),
  resolveSurrealGraphReadContext: vi.fn(),
  surrealCountWhere: vi.fn(),
}));

vi.mock("$lib/server/connect/graph-writer", () => ({
  REMOVED_VALIDATION_STATUS: "removed",
}));

const STATS = {
  units: 200,
  relations: 320,
  groups: 8,
  embedded: 190,
  validation: {
    ok: 180,
    weak: 12,
    unsupported: 4,
    unvalidated: 4,
    awaiting_triage: 10,
    unsupported_untriaged: 4,
  },
};

const EBV = {
  verificationStates: { supported: 150, inferred: 20, contradicted: 2, excluded: 4 },
  evidenceStatuses: { bound: 160, unbound: 30, no_evidence: 10 },
  validatorGaps: 3,
  remediationDrops: 4,
  lastJudgedAt: "2026-06-09T18:30:00.000Z",
  versionedUnits: 150,
};

describe("composeTrustScorecard", () => {
  it("produces a contract-valid scorecard from stats + EBV inputs", async () => {
    const { composeTrustScorecard } = await import("./trust-scorecard-service");
    const card = composeTrustScorecard({
      store: "surreal",
      stats: STATS,
      ebv: EBV,
      lastAssessedAt: "2026-06-08T10:00:00.000Z",
      now: new Date("2026-06-10T12:00:00.000Z"),
    });
    expect(() => ConnectTrustScorecardSchema.parse(card)).not.toThrow();
    expect(card.store).toBe("surreal");
    expect(card.units).toBe(200);
    expect(card.generated_at).toBe("2026-06-10T12:00:00.000Z");
    // G2 over the validated denominator (180+12+4): 92% ok, 2% unsupported.
    expect(card.g2).toEqual({ ok: 180, weak: 12, unsupported: 4, ok_pct: 92, unsupported_pct: 2 });
    expect(card.targets).toEqual({ ok_pct_min: 90, unsupported_pct_max: 2 });
    expect(card.embedding).toEqual({ embedded: 190, units: 200, pct: 95 });
    // Evidence: bound 160/200 = 80%.
    expect(card.evidence).toEqual({ bound: 160, unbound: 30, no_evidence: 10, bound_pct: 80 });
    // EBV states: 150+20+2+4 counted, 24 unaccounted units fold into unverified.
    expect(card.verification_states).toEqual({
      supported: 150,
      inferred: 20,
      contradicted: 2,
      excluded: 4,
      unverified: 24,
    });
    expect(card.coverage).toEqual({ validator_gaps: 3, remediation_drops: 4 });
    // Temporal coverage (Stage 3.3): 150/200 units carry validity windows.
    expect(card.temporal).toEqual({ versioned: 150, units: 200, pct: 75 });
    // Judgment timestamp wins over the run assessment fallback.
    expect(card.last_verified_at).toBe("2026-06-09T18:30:00.000Z");
    // Factor breakdown covers the full kg-audit formula.
    expect(card.score_factors.map((f) => f.id)).toEqual([
      "embedding_coverage",
      "verification_coverage",
      "orphan_rate",
      "vector_index",
      "relation_health",
      "issue_penalty",
    ]);
    expect(card.trust_score).toBeGreaterThan(0);
    expect(card.trust_score).toBeLessThanOrEqual(100);
  });

  it("matches the hub pulse trust score exactly (same kg-audit inputs)", async () => {
    const { composeTrustScorecard } = await import("./trust-scorecard-service");
    const { graphStatsToHealthSummary } = await import("$lib/connect/graph-health-summary");
    const card = composeTrustScorecard({
      store: "postgres",
      stats: STATS,
      ebv: EBV,
      lastAssessedAt: null,
    });
    expect(card.trust_score).toBe(graphStatsToHealthSummary(STATS)!.trust_score);
  });

  it("folds legacy verification vocabularies into unverified — never silently verified", async () => {
    const { composeTrustScorecard } = await import("./trust-scorecard-service");
    const card = composeTrustScorecard({
      store: "surreal",
      stats: { ...STATS, units: 100 },
      ebv: {
        ...EBV,
        verificationStates: { validated: 60, flagged: 10, supported: 20 },
        evidenceStatuses: {},
      },
      lastAssessedAt: null,
    });
    // Only the EBV "supported" count survives; legacy states + the rest are unverified.
    expect(card.verification_states).toEqual({ supported: 20, unverified: 80 });
    // No evidence_status data at all ⇒ everything unbound (fail-safe), 0% bound.
    expect(card.evidence).toEqual({ bound: 0, unbound: 100, no_evidence: 0, bound_pct: 0 });
  });

  it("clamps stale EBV counts so percentages never exceed 100", async () => {
    const { composeTrustScorecard } = await import("./trust-scorecard-service");
    const card = composeTrustScorecard({
      store: "postgres",
      stats: { ...STATS, units: 50, embedded: 80 },
      ebv: { ...EBV, evidenceStatuses: { bound: 70, no_evidence: 10 } },
      lastAssessedAt: null,
    });
    expect(card.evidence.bound).toBe(50);
    expect(card.evidence.bound_pct).toBe(100);
    expect(card.embedding.pct).toBe(100);
    expect(() => ConnectTrustScorecardSchema.parse(card)).not.toThrow();
  });

  it("reports unanswerable coverage counts as null (unknown), never zero", async () => {
    const { composeTrustScorecard } = await import("./trust-scorecard-service");
    const card = composeTrustScorecard({
      store: "surreal",
      stats: STATS,
      ebv: { ...EBV, validatorGaps: null, remediationDrops: null, versionedUnits: null },
      lastAssessedAt: null,
    });
    expect(card.coverage).toEqual({ validator_gaps: null, remediation_drops: null });
    // Temporal coverage unknown is null, never 0% (Stage 3.3).
    expect(card.temporal).toEqual({ versioned: null, units: 200, pct: null });
  });

  it("falls back to the latest run assessment when no judgment timestamp exists", async () => {
    const { composeTrustScorecard } = await import("./trust-scorecard-service");
    const card = composeTrustScorecard({
      store: "postgres",
      stats: STATS,
      ebv: { ...EBV, lastJudgedAt: null },
      lastAssessedAt: "2026-06-08T10:00:00.000Z",
    });
    expect(card.last_verified_at).toBe("2026-06-08T10:00:00.000Z");
  });
});

describe("loadConnectTrustScorecard", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns null (empty state) when there are no graph stats or zero units", async () => {
    const explorer = await import("$lib/server/connect/graph-explorer-service");
    const { loadConnectTrustScorecard } = await import("./trust-scorecard-service");

    vi.mocked(explorer.resolveConnectGraphStats).mockResolvedValue(null);
    expect(await loadConnectTrustScorecard("ws-1")).toBeNull();

    vi.mocked(explorer.resolveConnectGraphStats).mockResolvedValue({ ...STATS, units: 0 } as never);
    expect(await loadConnectTrustScorecard("ws-1")).toBeNull();
  });

  it("reads EBV aggregates from the Surreal unit table for a BYO graph", async () => {
    const explorer = await import("$lib/server/connect/graph-explorer-service");
    const neon = await import("$lib/server/neon");
    const { loadConnectTrustScorecard } = await import("./trust-scorecard-service");

    const query = vi.fn(async (sql: string) => {
      if (sql.includes("GROUP BY verification_state")) {
        return [
          { verification_state: "supported", count: 150 },
          { verification_state: "inferred", count: 30 },
          { verification_state: null, count: 20 },
        ];
      }
      if (sql.includes("GROUP BY evidence_status")) {
        return [
          { evidence_status: "bound", count: 140 },
          { evidence_status: "no_evidence", count: 10 },
        ];
      }
      if (sql.includes("connect_claim_judgment")) {
        return [{ judged_at: "2026-06-09T18:30:00.000Z" }];
      }
      return [];
    });
    vi.mocked(explorer.resolveConnectGraphStats).mockResolvedValue(STATS as never);
    vi.mocked(explorer.resolveSurrealGraphReadContext).mockResolvedValue({
      store: { query } as never,
      pack: { id: "pack-1" } as never,
      unitTable: "claim",
    });
    vi.mocked(explorer.surrealCountWhere)
      .mockResolvedValueOnce(3) // coverage_gap notes
      .mockResolvedValueOnce(4) // remediation drops
      .mockResolvedValueOnce(120); // units stamped with valid_from (Stage 3.3)
    vi.mocked(neon.listConnectIngestJobsForWorkspace).mockResolvedValue([]);

    const card = await loadConnectTrustScorecard("ws-1");
    expect(card).not.toBeNull();
    expect(card!.store).toBe("surreal");
    expect(card!.verification_states).toEqual({ supported: 150, inferred: 30, unverified: 20 });
    expect(card!.evidence.bound).toBe(140);
    expect(card!.coverage).toEqual({ validator_gaps: 3, remediation_drops: 4 });
    expect(card!.temporal).toEqual({ versioned: 120, units: 200, pct: 60 });
    expect(card!.last_verified_at).toBe("2026-06-09T18:30:00.000Z");
    // Temporal coverage on Surreal counts the writers' opportunistic valid_from stamps.
    const temporalWhere = vi.mocked(explorer.surrealCountWhere).mock.calls[2]![2];
    expect(temporalWhere).toContain("valid_from != NONE");
    // The drop count targets remediation soft-excludes, not just any removed unit.
    const dropWhere = vi.mocked(explorer.surrealCountWhere).mock.calls[1]![2];
    expect(dropWhere).toContain("validation_status = 'removed'");
    expect(dropWhere).toContain("Remediation (");
    // Postgres EBV readers must not be touched on the Surreal path.
    expect(neon.getConnectClaimVersionBreakdownPostgres).not.toHaveBeenCalled();
  });

  it("reads connect_claim_versions aggregates for the Postgres spine", async () => {
    const explorer = await import("$lib/server/connect/graph-explorer-service");
    const neon = await import("$lib/server/neon");
    const { loadConnectTrustScorecard } = await import("./trust-scorecard-service");

    vi.mocked(explorer.resolveConnectGraphStats).mockResolvedValue(STATS as never);
    vi.mocked(explorer.resolveSurrealGraphReadContext).mockResolvedValue(null);
    vi.mocked(neon.getConnectClaimVersionBreakdownPostgres).mockResolvedValue({
      verificationStates: { supported: 100, unverified: 50 },
      evidenceStatuses: { bound: 90, unbound: 60, no_evidence: 50 },
      lastJudgedAt: null,
    });
    vi.mocked(neon.getConnectGraphCoverageCountsPostgres).mockResolvedValue({
      validatorGaps: 1,
      remediationDrops: 0,
    });
    vi.mocked(neon.countConnectVersionedUnitsPostgres).mockResolvedValue(160);
    vi.mocked(neon.listConnectIngestJobsForWorkspace).mockResolvedValue([
      {
        id: "job-2",
        status: "running",
        progress: null,
        updatedAt: Date.parse("2026-06-10T09:00:00.000Z"),
      },
      {
        id: "job-1",
        status: "completed",
        progress: { quality_report: { ok_pct: 92 } },
        updatedAt: Date.parse("2026-06-08T10:00:00.000Z"),
      },
    ] as never);

    const card = await loadConnectTrustScorecard("ws-1");
    expect(card).not.toBeNull();
    expect(card!.store).toBe("postgres");
    expect(card!.verification_states).toEqual({ supported: 100, unverified: 100 });
    expect(card!.coverage).toEqual({ validator_gaps: 1, remediation_drops: 0 });
    // Temporal coverage from connect_claim_versions current rows: 160/200 = 80%.
    expect(card!.temporal).toEqual({ versioned: 160, units: 200, pct: 80 });
    // last_verified_at falls back to the latest COMPLETED job carrying a quality report.
    expect(card!.last_verified_at).toBe("2026-06-08T10:00:00.000Z");
  });

  it("degrades to unknown coverage / unverified states when the spine readers fail", async () => {
    const explorer = await import("$lib/server/connect/graph-explorer-service");
    const neon = await import("$lib/server/neon");
    const { loadConnectTrustScorecard } = await import("./trust-scorecard-service");

    vi.mocked(explorer.resolveConnectGraphStats).mockResolvedValue(STATS as never);
    vi.mocked(explorer.resolveSurrealGraphReadContext).mockResolvedValue(null);
    vi.mocked(neon.getConnectClaimVersionBreakdownPostgres).mockRejectedValue(new Error("down"));
    vi.mocked(neon.getConnectGraphCoverageCountsPostgres).mockRejectedValue(new Error("down"));
    vi.mocked(neon.countConnectVersionedUnitsPostgres).mockRejectedValue(new Error("down"));
    vi.mocked(neon.listConnectIngestJobsForWorkspace).mockRejectedValue(new Error("down"));

    const card = await loadConnectTrustScorecard("ws-1");
    expect(card).not.toBeNull();
    expect(card!.verification_states).toEqual({ unverified: 200 });
    expect(card!.coverage).toEqual({ validator_gaps: null, remediation_drops: null });
    expect(card!.temporal).toEqual({ versioned: null, units: 200, pct: null });
    expect(card!.last_verified_at).toBeNull();
  });

  it("peek mode never resolves (recomputes) stats — cached reads only", async () => {
    const explorer = await import("$lib/server/connect/graph-explorer-service");
    const { loadConnectTrustScorecard } = await import("./trust-scorecard-service");

    vi.mocked(explorer.peekConnectGraphStats).mockResolvedValue(null);
    expect(await loadConnectTrustScorecard("ws-1", { statsMode: "peek" })).toBeNull();
    expect(explorer.peekConnectGraphStats).toHaveBeenCalledWith("ws-1");
    expect(explorer.resolveConnectGraphStats).not.toHaveBeenCalled();
  });
});
