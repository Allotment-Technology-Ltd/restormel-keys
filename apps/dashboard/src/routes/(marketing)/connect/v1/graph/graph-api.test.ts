/**
 * Integration test for POST /connect/v1/graph — the RetrievalOrchestrator MCP/REST surface.
 * Mocks the workspace graph store + embedder; asserts response shape, the orchestrator dispatch,
 * and the default supported-only verification filtering (the trust promise).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { GraphStore } from "@restormel/graphrag-core";

vi.mock("$lib/server/db", () => ({
  getProject: vi.fn(),
  getProjectInWorkspace: vi.fn(),
}));

vi.mock("$lib/server/neon", () => ({
  getConnectGraphTargetForWorkspace: vi
    .fn()
    .mockResolvedValue({ provider: "surreal", status: "ok" }),
}));

vi.mock("$lib/server/connect/stage-route-generate", () => ({
  buildGraphRagEmbedder: vi.fn().mockResolvedValue({ embedQuery: async () => [1, 0, 0] }),
}));

const seed = (id: string, verification_state: string | null, embedding: number[]) => ({
  id,
  text: `claim ${id}`,
  claim_type: "thesis",
  domain: "ethics",
  confidence: 0.9,
  embedding,
  position_in_source: 0,
  review_state: undefined,
  verification_state,
  trust_score: verification_state === "validated" ? 90 : 50,
  section_context: null,
  source_id: `source:${id}`,
  source_url: null,
  source_source_type: null,
  source_title: `Source ${id}`,
  source_author: ["A"],
});

const mockStore: GraphStore = {
  async query<T>(sql: string): Promise<T> {
    const out = (rows: unknown[]): T => rows as unknown as T;
    if (sql.includes("count() AS count")) return out([{ count: 0 }]);
    if (sql.includes("FROM passage")) return out([{ id: "passage:1" }]);
    if (sql.includes("WHERE embedding <")) {
      return out([seed("s1", "validated", [1, 0, 0]), seed("w1", null, [0.8, 0.2, 0])]);
    }
    return out([]);
  },
  isDatabaseUnavailable() {
    return false;
  },
};

vi.mock("$lib/server/connect/surreal-graph-store", () => ({
  buildWorkspaceGraphStore: vi.fn().mockResolvedValue(mockStore),
}));

const workspaceId = "550e8400-e29b-41d4-a716-446655440000";
const projectId = "660e8400-e29b-41d4-a716-446655440001";

const gatewayLocals = {
  user: { uid: "u1", authType: "gateway_key", projectIdForKey: projectId, keyId: "k1" },
};

async function post(body: unknown, locals: unknown) {
  const { POST } = await import("./+server");
  return POST({
    request: new Request("http://localhost", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    locals,
  } as unknown as Parameters<typeof POST>[0]);
}

describe("POST /connect/v1/graph", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { getProject } = await import("$lib/server/db");
    vi.mocked(getProject).mockResolvedValue({
      id: projectId,
      userId: "u1",
      workspaceId,
    } as Awaited<ReturnType<typeof getProject>>);
  });

  it("returns 401 without auth", async () => {
    const res = await post(
      { workspace_id: workspaceId, operation: "retrieve_context", query: "x" },
      {},
    );
    expect(res.status).toBe(401);
  });

  it("retrieve_context returns a curated subgraph filtered to supported-only by default", async () => {
    const res = await post(
      {
        workspace_id: workspaceId,
        project_id: projectId,
        operation: "retrieve_context",
        query: "what is virtue?",
      },
      gatewayLocals,
    );
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data.contract_version).toBe("2026-06-01");
    expect(data.operation).toBe("retrieve_context");
    expect(Array.isArray(data.subgraph.claims)).toBe(true);
    // default policy: only the validated (supported) seed survives; the weak one is excluded
    expect(data.subgraph.claims.map((c: { id: string }) => c.id)).toEqual(["s1"]);
    expect(data.subgraph.claims[0].verification_category).toBe("supported");
    expect(data.trace.verification.include).toEqual(["supported"]);
    expect(data.trace.verification.excluded.weak).toBe(1);
    expect(typeof data.context_block).toBe("string");
  });

  it("opting into weak claims widens the result", async () => {
    const res = await post(
      {
        workspace_id: workspaceId,
        project_id: projectId,
        operation: "retrieve_context",
        query: "what is virtue?",
        verification_policy: { include: ["supported", "weak"] },
      },
      gatewayLocals,
    );
    const data = await res.json();
    expect(data.subgraph.claims.map((c: { id: string }) => c.id).sort()).toEqual(["s1", "w1"]);
  });

  it("rejects an invalid operation payload", async () => {
    const res = await post(
      { workspace_id: workspaceId, project_id: projectId, operation: "retrieve_context" },
      gatewayLocals,
    );
    expect(res.status).toBe(400);
  });
});
