/**
 * Connect v1 retrieve — verified-claim envelope pass-through (Stage 1.1).
 *
 * The orchestrator service owns enrichment; the retrieve mapping must carry the
 * envelopes and per-state summary into the legacy ConnectRetrieveResponse without
 * dropping non-supported states (flagged, never silently blended).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ConnectGraphOpResponse } from "@restormel/contracts/connect";
import { ConnectRetrieveResponseSchema } from "@restormel/contracts/connect";

vi.mock("./graph-orchestrator-service.js", () => ({
  executeConnectGraphOp: vi.fn(),
}));

vi.mock("$lib/server/neon", () => ({
  getConnectGraphTargetForWorkspace: vi.fn().mockResolvedValue(null),
}));

const workspaceId = "550e8400-e29b-41d4-a716-446655440000";
const auth = {
  workspaceId,
  projectId: "660e8400-e29b-41d4-a716-446655440001",
  userId: "u1",
} as unknown as import("./auth.js").ConnectV1AuthScope;

const subgraphClaim = {
  id: "claim:a",
  text: "Virtue is a mean between extremes.",
  claim_type: "thesis",
  domain: "ethics",
  source_title: "Nicomachean Ethics",
  confidence: 0.9,
  verification_state: "supported",
  trust_score: 88,
};

const verifiedClaims = [
  {
    claim: { id: "claim:a", text: "Virtue is a mean between extremes." },
    state: "supported" as const,
    evidence: [
      {
        quote: "virtue is a mean",
        offsets: [10, 26] as [number, number],
        source_ref: "source:ethics",
        source_hash: "h".repeat(64),
        match: "exact" as const,
      },
    ],
    judge: {
      model: "gemini-2.0-flash",
      prompt_version: 1,
      confidence: 0.92,
      at: "2026-06-10T12:00:00.000Z",
    },
    citation: "Nicomachean Ethics",
    trace_ref: "/connect/v1/traces/trace-1",
    trust_score: 88,
  },
  {
    claim: { id: "claim:b", text: "An unverified aside." },
    state: "unverified" as const,
    evidence: [],
    citation: null,
    trace_ref: "/connect/v1/traces/trace-1",
    trust_score: null,
  },
];

function graphOpBody(): ConnectGraphOpResponse {
  return {
    contract_version: "2026-06-01",
    request_id: "req-1",
    trace_id: "trace-1",
    operation: "retrieve_context",
    context_block: "context",
    subgraph: {
      claims: [
        subgraphClaim,
        { ...subgraphClaim, id: "claim:b", text: "An unverified aside.", verification_state: "unverified", trust_score: null },
      ],
      relations: [],
      arguments: [],
      seed_claim_ids: ["claim:a"],
    },
    verified_claims: verifiedClaims,
    trace: {
      operation: "retrieve_context",
      seed_count: 1,
      hops: 1,
      claim_count: 2,
      relation_count: 0,
      tokens_used: 50,
      nodes_dropped: 0,
    },
    metadata: { verification_summary: { supported: 1, unverified: 1 } },
  };
}

describe("executeConnectRetrieve — verified-claim envelopes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("carries verified_claims and verification_summary through to the retrieve response", async () => {
    const { executeConnectGraphOp } = await import("./graph-orchestrator-service.js");
    vi.mocked(executeConnectGraphOp).mockResolvedValue({ ok: true, body: graphOpBody() });

    const { executeConnectRetrieve } = await import("./retrieve-service.js");
    const outcome = await executeConnectRetrieve({
      auth,
      request: { workspace_id: workspaceId, query: "What is virtue?" } as never,
      requestId: "req-1",
    });

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(() => ConnectRetrieveResponseSchema.parse(outcome.body)).not.toThrow();
    expect(outcome.body.trace_id).toBe("trace-1");
    expect(outcome.body.verified_claims).toEqual(verifiedClaims);
    // Non-supported units are flagged via state + summary, never silently blended.
    expect(outcome.body.verified_claims?.map((v) => v.state)).toContain("unverified");
    expect(outcome.body.metadata.verification_summary).toEqual({ supported: 1, unverified: 1 });
    expect(outcome.body.metadata.retrieval_degraded).toBe(false);
  });

  it("passes as_of/include_superseded to the orchestrator and carries temporal metadata back (Stage 3.3)", async () => {
    const body = graphOpBody();
    body.metadata.temporal = {
      as_of: "2026-06-01T12:00:00.000Z",
      applied: true,
      include_superseded: true,
      excluded_claims: 0,
      substituted_claims: 1,
      superseded_claims_returned: 1,
      unversioned_claims: 0,
    };
    const { executeConnectGraphOp } = await import("./graph-orchestrator-service.js");
    vi.mocked(executeConnectGraphOp).mockResolvedValue({ ok: true, body });

    const { executeConnectRetrieve } = await import("./retrieve-service.js");
    const outcome = await executeConnectRetrieve({
      auth,
      request: {
        workspace_id: workspaceId,
        query: "What is virtue?",
        as_of: "2026-06-01T12:00:00.000Z",
        include_superseded: true,
      } as never,
      requestId: "req-3",
    });

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(() => ConnectRetrieveResponseSchema.parse(outcome.body)).not.toThrow();
    expect(vi.mocked(executeConnectGraphOp).mock.calls[0][0].request).toMatchObject({
      as_of: "2026-06-01T12:00:00.000Z",
      include_superseded: true,
    });
    expect(outcome.body.metadata.temporal).toEqual(body.metadata.temporal);
  });

  it("treats an as_of projection that excluded every claim as empty, not degraded", async () => {
    const body = graphOpBody();
    body.subgraph = { claims: [], relations: [], arguments: [], seed_claim_ids: [] };
    delete body.verified_claims;
    delete body.metadata.verification_summary;
    body.metadata.temporal = {
      as_of: "2020-01-01T00:00:00.000Z",
      applied: true,
      include_superseded: false,
      excluded_claims: 2,
      substituted_claims: 0,
      superseded_claims_returned: 0,
      unversioned_claims: 0,
    };
    const { executeConnectGraphOp } = await import("./graph-orchestrator-service.js");
    vi.mocked(executeConnectGraphOp).mockResolvedValue({ ok: true, body });

    const { executeConnectRetrieve } = await import("./retrieve-service.js");
    const outcome = await executeConnectRetrieve({
      auth,
      request: {
        workspace_id: workspaceId,
        query: "What is virtue?",
        as_of: "2020-01-01T00:00:00.000Z",
      } as never,
      requestId: "req-4",
    });

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    // "Nothing was valid at that instant" is a legitimate temporal answer.
    expect(outcome.body.metadata.retrieval_degraded).toBe(false);
    expect(outcome.body.metadata.temporal?.excluded_claims).toBe(2);
  });

  it("surfaces the explicit Surreal degrade — as_of is never silently ignored", async () => {
    const body = graphOpBody();
    body.metadata.temporal = {
      as_of: "2026-06-01T12:00:00.000Z",
      applied: false,
      include_superseded: false,
      degraded_reason: "surreal_version_chains_unavailable",
    };
    const { executeConnectGraphOp } = await import("./graph-orchestrator-service.js");
    vi.mocked(executeConnectGraphOp).mockResolvedValue({ ok: true, body });

    const { executeConnectRetrieve } = await import("./retrieve-service.js");
    const outcome = await executeConnectRetrieve({
      auth,
      request: {
        workspace_id: workspaceId,
        query: "What is virtue?",
        as_of: "2026-06-01T12:00:00.000Z",
      } as never,
      requestId: "req-5",
    });

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.body.metadata.temporal).toMatchObject({
      applied: false,
      degraded_reason: "surreal_version_chains_unavailable",
    });
  });

  it("omits envelopes (no fabrication) when the orchestrator returned none", async () => {
    const body = graphOpBody();
    delete body.verified_claims;
    delete body.metadata.verification_summary;
    const { executeConnectGraphOp } = await import("./graph-orchestrator-service.js");
    vi.mocked(executeConnectGraphOp).mockResolvedValue({ ok: true, body });

    const { executeConnectRetrieve } = await import("./retrieve-service.js");
    const outcome = await executeConnectRetrieve({
      auth,
      request: { workspace_id: workspaceId, query: "What is virtue?" } as never,
      requestId: "req-2",
    });

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.body.verified_claims).toBeUndefined();
    expect(outcome.body.metadata.verification_summary).toBeUndefined();
  });
});
