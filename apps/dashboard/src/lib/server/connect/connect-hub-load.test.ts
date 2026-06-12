/**
 * W2.3 — One Trust Ledger: hub-load single-source-of-truth tests.
 *
 * Ensures:
 * 1. loadConnectGraphPulse propagates the scorecard trust score (not an independent
 *    recomputation), so the pulse band and scorecard panel always show the same number.
 * 2. loadConnectQualityHistoryPanel forwards source_run_id for W3.4 cross-links.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock("$lib/server/connect/graph-explorer-service", () => ({
  peekConnectGraphStatsForView: vi.fn(),
  resolveConnectGraphStats: vi.fn(),
  resolveSurrealGraphReadContext: vi.fn(),
  surrealCountWhere: vi.fn(),
}));

vi.mock("$lib/server/connect/trust-scorecard-service", () => ({
  loadConnectTrustScorecard: vi.fn(),
}));

vi.mock("$lib/server/neon", () => ({
  listConnectIngestJobsForWorkspace: vi.fn(),
  listConnectEvalVerdicts: vi.fn(),
  countConnectVersionedUnitsPostgres: vi.fn(),
  getConnectClaimVersionBreakdownPostgres: vi.fn(),
  getConnectGraphCoverageCountsPostgres: vi.fn(),
  listProviderIntegrations: vi.fn(),
}));

vi.mock("$lib/server/connect/workspace-cache", () => ({
  requireConnectWorkspace: vi.fn(),
}));

vi.mock("$lib/server/connect/graph-target-service", () => ({
  getGraphTargetForUi: vi.fn(),
}));

vi.mock("$lib/server/connect/domain-pack-service", () => ({
  listDomainPacksForUi: vi.fn(),
}));

vi.mock("$lib/server/connect/source-documents", () => ({
  listSourceDocuments: vi.fn(),
}));

vi.mock("$lib/server/connect/connections-service", () => ({
  listConnections: vi.fn(),
}));

vi.mock("$lib/server/connect/llm-generate", () => ({
  isLlmConfigured: vi.fn(() => false),
}));

vi.mock("$lib/server/credential-crypto", () => ({
  isCredentialEncryptionConfigured: vi.fn(() => true),
}));

vi.mock("$lib/server/connect/stage-routing", () => ({
  computeConnectModelsReady: vi.fn(),
}));

// K4: the readiness compute is mocked so the hub-load tests stay focused; its
// own matrix lives in verified-readiness.test.ts.
vi.mock("$lib/server/connect/verified-readiness", () => ({
  computeConnectVerifiedReadiness: vi.fn().mockResolvedValue(null),
}));

vi.mock("$lib/server/connect/starter-corpus", () => ({
  listStarterCorpusDocuments: vi.fn(),
}));

vi.mock("$lib/server/connect/kg-audit-summary", () => ({
  graphStatsToHealthSummary: vi.fn(),
}));

vi.mock("$lib/server/db", () => ({
  listProviderIntegrations: vi.fn(),
}));

vi.mock("$lib/debug/server-perf", () => ({
  perfSpan: vi.fn(() => vi.fn()),
}));

// R7: the workspace-infrastructure module's default deps pull the real data layer
// (via apply-recommended-routes) — mock it so this unit test stays hermetic.
vi.mock("$lib/server/connect/workspace-infrastructure", () => ({
  getRoutingProjectLedgerRow: vi.fn(async () => null),
  ensureWorkspaceInfrastructureRouting: vi.fn(),
}));

// ── Fixtures ──────────────────────────────────────────────────────────────────

const WS_ID = "ws-test-1";

function makeEvent() {
  return {
    locals: {
      user: { uid: "user-1", authType: "session" } as never,
      connectStatsRequestMemo: new Map() as Map<string, Promise<never>>,
    },
    parent: async () => ({ connectWorkspace: { id: WS_ID, userId: "user-1" } }),
    depends: vi.fn(),
  };
}

const SAMPLE_STATS = {
  units: 120,
  relations: 200,
  groups: 4,
  embedded: 110,
  validation: { ok: 100, weak: 10, unsupported: 5, unvalidated: 5, awaiting_triage: 5, unsupported_untriaged: 2 },
};

const SAMPLE_SCORECARD = {
  trust_score: 81,
  trust_formula: "score = 100 − penalties",
  generated_at: "2026-06-12T10:00:00.000Z",
  schema_version: "1.0",
  store: "postgres" as const,
  units: 120,
  relations: 200,
  g2: { ok: 100, weak: 10, unsupported: 5, ok_pct: 83, unsupported_pct: 4 },
  targets: { ok_pct_min: 90, unsupported_pct_max: 2 },
  embedding: { embedded: 110, units: 120, pct: 92 },
  evidence: { bound: 80, unbound: 30, no_evidence: 10, bound_pct: 67 },
  verification_states: { supported: 60, unverified: 60 },
  temporal: { versioned: 90, units: 120, pct: 75 },
  coverage: { validator_gaps: 2, remediation_drops: 1 },
  last_verified_at: "2026-06-10T08:00:00.000Z",
  score_factors: [],
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("loadConnectGraphPulse — W2.3 single source of truth", () => {
  beforeEach(() => vi.clearAllMocks());

  it("propagates the scorecard trust score so the pulse band quotes the same number as the scorecard panel", async () => {
    const explorer = await import("$lib/server/connect/graph-explorer-service");
    const scorecard = await import("$lib/server/connect/trust-scorecard-service");
    const workspace = await import("$lib/server/connect/workspace-cache");
    const kgAudit = await import("$lib/server/connect/kg-audit-summary");
    const { loadConnectGraphPulse } = await import("./connect-hub-load");

    vi.mocked(workspace.requireConnectWorkspace).mockResolvedValue({ id: WS_ID, userId: "user-1" } as never);
    vi.mocked(explorer.resolveConnectGraphStats).mockResolvedValue(SAMPLE_STATS as never);
    vi.mocked(scorecard.loadConnectTrustScorecard).mockResolvedValue(SAMPLE_SCORECARD as never);
    vi.mocked(kgAudit.graphStatsToHealthSummary).mockReturnValue({
      trust_score: 78, // intentionally different to prove we quote the scorecard
      total_issues: 1,
      formula: "old-formula",
      ok_pct: 83,
      issues: [],
    });

    const pulse = await loadConnectGraphPulse(makeEvent());

    expect(pulse).not.toBeNull();
    // The pulse band must use the scorecard's value (81), NOT the graphHealth recomputation (78).
    expect(pulse!.scorecardTrustScore).toBe(81);
    expect(pulse!.trustFormula).toBe("score = 100 − penalties");
    // graphHealth is still populated (for ok_pct etc.) but its trust_score should not be displayed.
    expect(pulse!.graphHealth).not.toBeNull();
  });

  it("sets scorecardTrustScore to null when the scorecard load fails gracefully", async () => {
    const explorer = await import("$lib/server/connect/graph-explorer-service");
    const scorecard = await import("$lib/server/connect/trust-scorecard-service");
    const workspace = await import("$lib/server/connect/workspace-cache");
    const kgAudit = await import("$lib/server/connect/kg-audit-summary");
    const { loadConnectGraphPulse } = await import("./connect-hub-load");

    vi.mocked(workspace.requireConnectWorkspace).mockResolvedValue({ id: WS_ID, userId: "user-1" } as never);
    vi.mocked(explorer.resolveConnectGraphStats).mockResolvedValue(SAMPLE_STATS as never);
    vi.mocked(scorecard.loadConnectTrustScorecard).mockRejectedValue(new Error("store down"));
    vi.mocked(kgAudit.graphStatsToHealthSummary).mockReturnValue({
      trust_score: 78, total_issues: 0, formula: "f", ok_pct: 83, issues: [],
    });

    const pulse = await loadConnectGraphPulse(makeEvent());

    expect(pulse).not.toBeNull();
    // Scorecard failure degrades gracefully — pulse still loads, trust score is null.
    expect(pulse!.scorecardTrustScore).toBeNull();
    expect(pulse!.trustFormula).toBeNull();
    // Stats are still present.
    expect(pulse!.stats).not.toBeNull();
  });

  it("returns null (not an error) when the user is not signed in", async () => {
    const { loadConnectGraphPulse } = await import("./connect-hub-load");
    const event = makeEvent();
    (event.locals.user as never as null | unknown) = null;
    // @ts-expect-error intentional null for test
    event.locals.user = null;
    const pulse = await loadConnectGraphPulse(event as never);
    expect(pulse).toBeNull();
  });
});

describe("loadConnectQualityHistoryPanel — W3.4 source_run_id cross-link", () => {
  beforeEach(() => vi.clearAllMocks());

  it("forwards source_run_id from the DB row so the history component can cross-link to the run console", async () => {
    const neon = await import("$lib/server/neon");
    const workspace = await import("$lib/server/connect/workspace-cache");
    const { loadConnectQualityHistoryPanel } = await import("./connect-hub-load");

    vi.mocked(workspace.requireConnectWorkspace).mockResolvedValue({ id: WS_ID, userId: "user-1" } as never);
    vi.mocked(neon.listConnectEvalVerdicts).mockResolvedValue([
      {
        id: "v-1",
        workspaceId: WS_ID,
        source: "ingest_run",
        evaluatedAt: "2026-06-10T08:00:00.000Z",
        pass: true,
        verdictSchema: "1.0",
        verdict: {
          schema_version: "1.0",
          evaluated_at: "2026-06-10T08:00:00.000Z",
          g2: { ok: 100, weak: 10, unsupported: 5, ok_pct: 83, unsupported_pct: 4 },
          trust_score: 81,
          pass: true,
          reasons: [],
          coverage_gaps: null,
        },
        diff: null,
        recordedAt: "2026-06-10T08:01:00.000Z",
        sourceRunId: "run-abc123",
      },
      {
        id: "v-2",
        workspaceId: WS_ID,
        source: "cli",
        evaluatedAt: "2026-06-09T12:00:00.000Z",
        pass: false,
        verdictSchema: "1.0",
        verdict: {
          schema_version: "1.0",
          evaluated_at: "2026-06-09T12:00:00.000Z",
          g2: { ok: 70, weak: 20, unsupported: 10, ok_pct: 70, unsupported_pct: 10 },
          trust_score: 55,
          pass: false,
          reasons: ["G2 ok_pct 70% below 90% target"],
          coverage_gaps: null,
        },
        diff: null,
        recordedAt: "2026-06-09T12:01:00.000Z",
        sourceRunId: null,
      },
    ] as never);

    const entries = await loadConnectQualityHistoryPanel(makeEvent());

    expect(entries).toHaveLength(2);
    // ingest_run entry: source_run_id is forwarded.
    expect(entries[0].source_run_id).toBe("run-abc123");
    expect(entries[0].source).toBe("ingest_run");
    // CLI entry: source_run_id is null (no run to link to).
    expect(entries[1].source_run_id).toBeNull();
    expect(entries[1].source).toBe("cli");
  });
});
