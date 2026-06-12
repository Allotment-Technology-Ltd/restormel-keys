/**
 * W2.6 — Overview becomes the verified-context home.
 *
 * Tests:
 *  1. ConnectCompletionSignals derivation (pure milestone logic — no DB).
 *  2. trustStrip shape (load returns a streaming Promise, not a plain value).
 *  3. Trust strip sources scorecard service only — no second formula in the
 *     load function (the Overview quotes, never recomputes).
 *  4. Signed-out guard — no user → empty/null defaults.
 */
import { describe, expect, it, vi } from "vitest";

// ── Module-level mocks — hoisted by Vitest before any import ──────────

vi.mock("$lib/server/db", () => ({
  listProjects: vi.fn().mockResolvedValue([]),
  countApiKeysByWorkspace: vi.fn().mockResolvedValue(0),
  listProviderIntegrations: vi.fn().mockResolvedValue([]),
  getOrCreateDefaultWorkspace: vi.fn().mockResolvedValue({ id: "ws-1", createdAt: Date.now() }),
  aggregateRequestLogsToUsage: vi.fn().mockResolvedValue([]),
  listRoutes: vi.fn().mockResolvedValue([]),
  listRequestLogs: vi.fn().mockResolvedValue([]),
  listPolicyBindingsForWorkspace: vi.fn().mockResolvedValue([]),
}));

// R2: the relocated hub-home panel loads are mocked at their boundary — this
// test only covers the Overview half of /home. Post-K4/R7 the real module
// pulls in workspace-infrastructure → apply-recommended-routes and the full
// readiness chain, none of which is under test here.
vi.mock("$lib/server/connect/connect-hub-load", () => ({
  loadConnectHubPage: vi.fn().mockResolvedValue(null),
  loadConnectGraphPulse: vi.fn().mockResolvedValue(null),
  loadConnectTrustScorecardPanel: vi.fn().mockResolvedValue(null),
  loadConnectQualityHistoryPanel: vi.fn().mockResolvedValue([]),
}));

vi.mock("$lib/server/entitlements", () => ({
  getWorkspaceEntitlements: vi.fn().mockResolvedValue(null),
}));

vi.mock("$lib/server/connect/trust-scorecard-service", () => ({
  loadConnectTrustScorecard: vi.fn().mockResolvedValue(null),
}));

vi.mock("$lib/server/connect/graph-target-service", () => ({
  getGraphTargetForUi: vi.fn().mockResolvedValue(null),
}));

vi.mock("$lib/server/neon", () => ({
  listConnectIngestJobsForWorkspace: vi.fn().mockResolvedValue([]),
}));

// K4: the Overview only QUOTES the readiness summary — the compute is mocked here;
// its matrix lives in $lib/server/connect/verified-readiness.test.ts.
vi.mock("$lib/server/connect/verified-readiness", () => ({
  computeConnectVerifiedReadiness: vi.fn().mockResolvedValue({
    rows: [],
    ready: 4,
    total: 6,
    status: "warn",
    checkedAt: new Date().toISOString(),
    models: { modelsReady: false, hasChatRoute: false, hasEmbeddingRoute: false },
  }),
}));

// ── Type for casting the load return through the SvelteKit void union ─
type LoadResult = {
  workspaceId: string | null;
  connectCompletion: {
    storeConnected: boolean;
    firstRunStarted: boolean;
    firstRunCompleted: boolean;
    agentReady: boolean;
  };
  trustStrip: Promise<unknown>;
};

// ── 1. ConnectCompletionSignals derivation ─────────────────────────────

/**
 * Pure helper extracted to keep the test independent of the SvelteKit load
 * runner.  The logic is verbatim from the load function in +page.server.ts —
 * if the load changes, update this mirror.
 */
function deriveConnectCompletion(input: {
  target: { status: string } | null;
  latestJob: { status: string } | null;
}) {
  return {
    storeConnected: Boolean(input.target && input.target.status === "ok"),
    firstRunStarted: Boolean(input.latestJob),
    firstRunCompleted: Boolean(input.latestJob && input.latestJob.status === "completed"),
    agentReady: Boolean(
      input.target &&
      input.target.status === "ok" &&
      input.latestJob &&
      input.latestJob.status === "completed",
    ),
  };
}

describe("ConnectCompletionSignals derivation", () => {
  it("all false when nothing configured", () => {
    const r = deriveConnectCompletion({ target: null, latestJob: null });
    expect(r.storeConnected).toBe(false);
    expect(r.firstRunStarted).toBe(false);
    expect(r.firstRunCompleted).toBe(false);
    expect(r.agentReady).toBe(false);
  });

  it("storeConnected true only when target.status is 'ok'", () => {
    expect(deriveConnectCompletion({ target: { status: "ok" }, latestJob: null }).storeConnected).toBe(true);
    expect(deriveConnectCompletion({ target: { status: "error" }, latestJob: null }).storeConnected).toBe(false);
    expect(deriveConnectCompletion({ target: { status: "pending" }, latestJob: null }).storeConnected).toBe(false);
  });

  it("firstRunStarted true as soon as any job exists, regardless of status", () => {
    expect(deriveConnectCompletion({
      target: null,
      latestJob: { status: "running" },
    }).firstRunStarted).toBe(true);
    expect(deriveConnectCompletion({
      target: null,
      latestJob: { status: "failed" },
    }).firstRunStarted).toBe(true);
  });

  it("firstRunCompleted true only for completed status", () => {
    expect(deriveConnectCompletion({
      target: { status: "ok" },
      latestJob: { status: "completed" },
    }).firstRunCompleted).toBe(true);
    expect(deriveConnectCompletion({
      target: { status: "ok" },
      latestJob: { status: "running" },
    }).firstRunCompleted).toBe(false);
    expect(deriveConnectCompletion({
      target: { status: "ok" },
      latestJob: { status: "failed" },
    }).firstRunCompleted).toBe(false);
  });

  it("agentReady requires store ok + job completed (running job is NOT agent-ready)", () => {
    // Not ready: store ok, job running
    expect(deriveConnectCompletion({
      target: { status: "ok" },
      latestJob: { status: "running" },
    }).agentReady).toBe(false);

    // Not ready: store error, job completed
    expect(deriveConnectCompletion({
      target: { status: "error" },
      latestJob: { status: "completed" },
    }).agentReady).toBe(false);

    // Ready: store ok, job completed
    expect(deriveConnectCompletion({
      target: { status: "ok" },
      latestJob: { status: "completed" },
    }).agentReady).toBe(true);
  });

  it("agentReady is false when store is null even with a completed job", () => {
    expect(deriveConnectCompletion({ target: null, latestJob: { status: "completed" } }).agentReady).toBe(false);
  });
});

// ── 2. trustStrip streaming shape ─────────────────────────────────────

describe("trustStrip load shape — streaming promise", () => {
  it("trustStrip is a Promise (not a plain resolved value) so SvelteKit can stream it", async () => {
    const { load } = await import("./+page.server");
    const rawResult = await load({
      locals: { user: { uid: "u-1", authType: "session" } },
    } as never);
    const result = rawResult as LoadResult;

    // trustStrip must be a streaming Promise — SvelteKit defers rendering until resolved.
    expect(result.trustStrip).toBeInstanceOf(Promise);
    // Resolve it to confirm it settles (null = no graph yet, matching the mock).
    const strip = await result.trustStrip;
    expect(strip === null || typeof strip === "object").toBe(true);
  });

  it("trustStrip resolves to null when scorecard service returns null (no graph)", async () => {
    const { load } = await import("./+page.server");
    const rawResult = await load({
      locals: { user: { uid: "u-2", authType: "session" } },
    } as never);
    const result = rawResult as LoadResult;

    expect(await result.trustStrip).toBe(null);
  });

  it("trustStrip quotes the scorecard service — loadConnectTrustScorecard called with statsMode: peek", async () => {
    // Import the mock so we can spy on it.
    const { loadConnectTrustScorecard } = await import(
      "$lib/server/connect/trust-scorecard-service"
    );
    const spy = vi.mocked(loadConnectTrustScorecard);
    spy.mockClear();
    spy.mockResolvedValue({
      trust_score: 87,
      g2: { ok: 220, weak: 15, unsupported: 5, ok_pct: 92, unsupported_pct: 2 },
      targets: { ok_pct_min: 90, unsupported_pct_max: 2 },
      units: 240,
      relations: 300,
      verification_states: { supported: 200, unverified: 40 },
      evidence: { bound: 200, unbound: 30, no_evidence: 10, bound_pct: 83 },
      coverage: { validator_gaps: null, remediation_drops: null },
      embedding: { embedded: 200, units: 240, pct: 83 },
      trust_formula: "test",
      score_factors: [],
      store: "postgres",
      schema_version: "1.0",
      generated_at: "2026-06-10T12:00:00.000Z",
      last_verified_at: "2026-06-10T12:00:00.000Z",
    } as import("@restormel/contracts").ConnectTrustScorecard);

    // Also update the workspace mock to produce a stable ID.
    const { getOrCreateDefaultWorkspace } = await import("$lib/server/db");
    vi.mocked(getOrCreateDefaultWorkspace).mockResolvedValue({ id: "ws-3", createdAt: Date.now() } as never);

    const { load } = await import("./+page.server");
    const rawResult = await load({
      locals: { user: { uid: "u-3", authType: "session" } },
    } as never);
    // Await the trustStrip to drain the promise (ensures loadConnectTrustScorecard was called).
    await (rawResult as LoadResult).trustStrip.catch(() => null);

    // The scorecard service was called exactly once per page load.
    expect(spy).toHaveBeenCalledTimes(1);
    // statsMode must be "peek" so the Overview never triggers a full graph scan.
    expect(spy).toHaveBeenCalledWith("ws-3", expect.objectContaining({ statsMode: "peek" }));
  });

  it("trustStrip resolves to null (not rejected) when scorecard service throws", async () => {
    const { loadConnectTrustScorecard } = await import(
      "$lib/server/connect/trust-scorecard-service"
    );
    vi.mocked(loadConnectTrustScorecard).mockRejectedValueOnce(new Error("store unavailable"));

    const { load } = await import("./+page.server");
    const rawResult = await load({
      locals: { user: { uid: "u-4", authType: "session" } },
    } as never);
    const result = rawResult as LoadResult;

    // The page shell must not fail when the scorecard service is unavailable.
    await expect(result.trustStrip).resolves.toBe(null);
  });
});

// ── 3. Signed-out guard ───────────────────────────────────────────────

describe("load signed-out guard", () => {
  it("returns null trustStrip and zero connectCompletion when no user", async () => {
    const { load } = await import("./+page.server");
    const rawResult = await load({ locals: {} } as never);
    const result = rawResult as LoadResult;

    expect(result.workspaceId).toBeNull();
    expect(result.connectCompletion.storeConnected).toBe(false);
    expect(result.connectCompletion.agentReady).toBe(false);
    await expect(result.trustStrip).resolves.toBe(null);
  });
});
