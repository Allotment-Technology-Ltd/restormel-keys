/**
 * Tests for GET /connect/v1/graph/scorecard handler (Stage 1.2): auth scoping,
 * the versioned envelope, the null (no graph yet) scorecard, and read failures.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { CONNECT_API_CONTRACT_VERSION } from "@restormel/contracts";

vi.mock("$lib/server/db", () => ({ getProject: vi.fn(), getProjectInWorkspace: vi.fn() }));
vi.mock("$lib/server/connect/trust-scorecard-service", () => ({
  loadConnectTrustScorecard: vi.fn(),
}));

const workspaceId = "550e8400-e29b-41d4-a716-446655440000";
const projectId = "660e8400-e29b-41d4-a716-446655440001";
const gatewayLocals = {
  user: { uid: "u1", authType: "gateway_key", projectIdForKey: projectId, keyId: "k1" },
} as unknown as App.Locals;

const SCORECARD = {
  schema_version: "1.0",
  generated_at: "2026-06-10T12:00:00.000Z",
  store: "surreal",
  units: 100,
  relations: 50,
  trust_score: 82,
  trust_formula: "…",
  score_factors: [],
  g2: { ok: 90, weak: 8, unsupported: 2, ok_pct: 90, unsupported_pct: 2 },
  targets: { ok_pct_min: 90, unsupported_pct_max: 2 },
  embedding: { embedded: 100, units: 100, pct: 100 },
  evidence: { bound: 80, unbound: 15, no_evidence: 5, bound_pct: 80 },
  verification_states: { supported: 80, unverified: 20 },
  coverage: { validator_gaps: 0, remediation_drops: 0 },
  last_verified_at: "2026-06-09T18:30:00.000Z",
};

beforeEach(async () => {
  vi.clearAllMocks();
  const { getProject } = await import("$lib/server/db");
  vi.mocked(getProject).mockResolvedValue({
    id: projectId,
    userId: "u1",
    workspaceId,
  } as Awaited<ReturnType<typeof getProject>>);
});

describe("handleGetTrustScorecard", () => {
  it("400s when workspace_id is missing", async () => {
    const { handleGetTrustScorecard } = await import("./trust-scorecard-handler.js");
    const res = await handleGetTrustScorecard({ locals: gatewayLocals, workspaceId: null });
    expect(res).toMatchObject({ ok: false, status: 400 });
  });

  it("401s without an authenticated user", async () => {
    const { handleGetTrustScorecard } = await import("./trust-scorecard-handler.js");
    const res = await handleGetTrustScorecard({
      locals: { user: null } as unknown as App.Locals,
      workspaceId,
    });
    expect(res).toMatchObject({ ok: false, status: 401 });
  });

  it("403s when the Gateway key project belongs to another workspace", async () => {
    const { getProject } = await import("$lib/server/db");
    vi.mocked(getProject).mockResolvedValue({
      id: projectId,
      userId: "u1",
      workspaceId: "other-workspace",
    } as Awaited<ReturnType<typeof getProject>>);
    const { handleGetTrustScorecard } = await import("./trust-scorecard-handler.js");
    const res = await handleGetTrustScorecard({ locals: gatewayLocals, workspaceId });
    expect(res).toMatchObject({ ok: false, status: 403 });
    const service = await import("$lib/server/connect/trust-scorecard-service");
    expect(service.loadConnectTrustScorecard).not.toHaveBeenCalled();
  });

  it("returns the scorecard in the versioned connect v1 envelope", async () => {
    const service = await import("$lib/server/connect/trust-scorecard-service");
    vi.mocked(service.loadConnectTrustScorecard).mockResolvedValue(SCORECARD as never);
    const { handleGetTrustScorecard } = await import("./trust-scorecard-handler.js");
    const res = await handleGetTrustScorecard({ locals: gatewayLocals, workspaceId });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.body.contract_version).toBe(CONNECT_API_CONTRACT_VERSION);
      expect(res.body.scorecard).toEqual(SCORECARD);
    }
    expect(service.loadConnectTrustScorecard).toHaveBeenCalledWith(workspaceId);
  });

  it("returns a null scorecard (200) when the graph has no units yet", async () => {
    const service = await import("$lib/server/connect/trust-scorecard-service");
    vi.mocked(service.loadConnectTrustScorecard).mockResolvedValue(null);
    const { handleGetTrustScorecard } = await import("./trust-scorecard-handler.js");
    const res = await handleGetTrustScorecard({ locals: gatewayLocals, workspaceId });
    expect(res).toMatchObject({ ok: true, status: 200 });
    if (res.ok) expect(res.body.scorecard).toBeNull();
  });

  it("502s with graph_store_error when the scorecard load throws", async () => {
    const service = await import("$lib/server/connect/trust-scorecard-service");
    vi.mocked(service.loadConnectTrustScorecard).mockRejectedValue(new Error("boom"));
    const { handleGetTrustScorecard } = await import("./trust-scorecard-handler.js");
    const res = await handleGetTrustScorecard({ locals: gatewayLocals, workspaceId });
    expect(res).toMatchObject({ ok: false, status: 502 });
    if (!res.ok) expect(res.body.error).toBe("graph_store_error");
  });
});
