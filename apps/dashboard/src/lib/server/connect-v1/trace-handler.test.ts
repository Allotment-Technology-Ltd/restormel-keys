/**
 * Tests for the provenance trace GET/export handlers (Stage 4B): workspace scoping, 404 on
 * cross-tenant access, and format validation.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ProvenanceTrace } from "@restormel/contracts/provenance-trace";

vi.mock("$lib/server/connect-traces", () => ({ getProvenanceTraceById: vi.fn() }));
vi.mock("$lib/server/db", () => ({ getProject: vi.fn(), getProjectInWorkspace: vi.fn() }));

const workspaceId = "550e8400-e29b-41d4-a716-446655440000";
const projectId = "660e8400-e29b-41d4-a716-446655440001";
const otherWorkspace = "770e8400-e29b-41d4-a716-446655440002";

const gatewayLocals = {
  user: { uid: "u1", authType: "gateway_key", projectIdForKey: projectId, keyId: "k1" },
} as unknown as App.Locals;

function fixtureTrace(): ProvenanceTrace {
  return {
    schema_version: "1.0",
    trace_id: "trace-1",
    query: "what is virtue?",
    workspace_id: workspaceId,
    domain_pack: "philosophy",
    graph_store_type: "surreal",
    queried_at: "2026-06-08T00:00:00.000Z",
    verification_policy: { included_states: ["supported"], min_trust_score: 0, excluded_flagged: false },
    seeds: [],
    expansion: [],
    result: { claims_retrieved: 1, claims_filtered: 0, tokens_used: 10, token_budget: 0, truncated: false },
    claims: [],
    timing: { seed_ms: 0, expansion_ms: 0, ranking_ms: 0, total_ms: 5 },
  };
}

beforeEach(async () => {
  vi.clearAllMocks();
  const { getProject } = await import("$lib/server/db");
  vi.mocked(getProject).mockResolvedValue({
    id: projectId,
    userId: "u1",
    workspaceId,
  } as Awaited<ReturnType<typeof getProject>>);
});

describe("handleGetProvenanceTrace", () => {
  it("400s when workspace_id is missing", async () => {
    const { handleGetProvenanceTrace } = await import("./trace-handler.js");
    const res = await handleGetProvenanceTrace({ locals: gatewayLocals, traceId: "trace-1", workspaceId: null });
    expect(res).toMatchObject({ ok: false, status: 400 });
  });

  it("404s when the trace does not exist", async () => {
    const { getProvenanceTraceById } = await import("$lib/server/connect-traces");
    vi.mocked(getProvenanceTraceById).mockResolvedValue(null);
    const { handleGetProvenanceTrace } = await import("./trace-handler.js");
    const res = await handleGetProvenanceTrace({ locals: gatewayLocals, traceId: "trace-1", workspaceId });
    expect(res).toMatchObject({ ok: false, status: 404 });
  });

  it("404s for a trace owned by another workspace (no existence leak)", async () => {
    const { getProvenanceTraceById } = await import("$lib/server/connect-traces");
    vi.mocked(getProvenanceTraceById).mockResolvedValue({
      traceId: "trace-1",
      workspaceId: otherWorkspace,
      projectId: null,
      trace: { ...fixtureTrace(), workspace_id: otherWorkspace },
    });
    const { handleGetProvenanceTrace } = await import("./trace-handler.js");
    const res = await handleGetProvenanceTrace({ locals: gatewayLocals, traceId: "trace-1", workspaceId });
    expect(res).toMatchObject({ ok: false, status: 404 });
  });

  it("returns the trace when authorized", async () => {
    const { getProvenanceTraceById } = await import("$lib/server/connect-traces");
    vi.mocked(getProvenanceTraceById).mockResolvedValue({
      traceId: "trace-1",
      workspaceId,
      projectId,
      trace: fixtureTrace(),
    });
    const { handleGetProvenanceTrace } = await import("./trace-handler.js");
    const res = await handleGetProvenanceTrace({ locals: gatewayLocals, traceId: "trace-1", workspaceId });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.status).toBe(200);
      expect(res.trace.trace_id).toBe("trace-1");
      expect(res.trace.schema_version).toBe("1.0");
    }
  });
});

describe("handleExportProvenanceTrace", () => {
  it("400s for an unsupported format", async () => {
    const { handleExportProvenanceTrace } = await import("./trace-handler.js");
    const res = await handleExportProvenanceTrace({
      locals: gatewayLocals,
      traceId: "trace-1",
      workspaceId,
      format: "csv",
    });
    expect(res).toMatchObject({ ok: false, status: 400 });
  });

  it("returns the trace for format=json", async () => {
    const { getProvenanceTraceById } = await import("$lib/server/connect-traces");
    vi.mocked(getProvenanceTraceById).mockResolvedValue({
      traceId: "trace-1",
      workspaceId,
      projectId,
      trace: fixtureTrace(),
    });
    const { handleExportProvenanceTrace } = await import("./trace-handler.js");
    const res = await handleExportProvenanceTrace({
      locals: gatewayLocals,
      traceId: "trace-1",
      workspaceId,
      format: "json",
    });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.trace.trace_id).toBe("trace-1");
  });

  it("defaults to json when format is omitted", async () => {
    const { getProvenanceTraceById } = await import("$lib/server/connect-traces");
    vi.mocked(getProvenanceTraceById).mockResolvedValue({
      traceId: "trace-1",
      workspaceId,
      projectId,
      trace: fixtureTrace(),
    });
    const { handleExportProvenanceTrace } = await import("./trace-handler.js");
    const res = await handleExportProvenanceTrace({
      locals: gatewayLocals,
      traceId: "trace-1",
      workspaceId,
      format: null,
    });
    expect(res.ok).toBe(true);
  });
});
