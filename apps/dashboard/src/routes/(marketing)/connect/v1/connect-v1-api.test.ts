/**
 * Knowledge v1 REST route wiring tests.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { philosophyRetrievalConfig } from "@restormel/graphrag-core";

// Retrieve now delegates to the orchestrator, which resolves a per-workspace domain pack.
// Mock the resolver so the wiring tests don't depend on the domain-pack DB layer.
vi.mock("$lib/server/connect-v1/workspace-retrieval-config", () => ({
  resolveWorkspaceRetrievalConfig: vi.fn(),
}));

vi.mock("$lib/server/db", () => ({
  getProject: vi.fn(),
  getProjectInWorkspace: vi.fn(),
  listEnvironments: vi.fn().mockResolvedValue([{ id: "env-1", name: "Production" }]),
}));

vi.mock("$lib/server/route-resolver", () => ({
  resolveRouteForExecution: vi.fn(),
}));

vi.mock("$lib/server/runtime-invoke", () => ({
  findDecryptedApiKeyForResolvedProvider: vi.fn(),
}));

vi.mock("$lib/server/connect-ingest-jobs", () => ({
  insertConnectIngestJob: vi.fn().mockResolvedValue(undefined),
  listConnectIngestJobsForWorkspace: vi.fn().mockResolvedValue([]),
  getConnectIngestJobForWorkspace: vi.fn().mockResolvedValue(null),
}));

vi.mock("$lib/server/neon", () => ({
  getConnectGraphTargetForWorkspace: vi.fn().mockResolvedValue(null),
}));

const workspaceId = "550e8400-e29b-41d4-a716-446655440000";
const projectId = "660e8400-e29b-41d4-a716-446655440001";

describe("POST /connect/v1/retrieve", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    // Default: workspace has a domain pack configured (philosophy preset stands in).
    const { resolveWorkspaceRetrievalConfig } = await import(
      "$lib/server/connect-v1/workspace-retrieval-config"
    );
    vi.mocked(resolveWorkspaceRetrievalConfig).mockResolvedValue(philosophyRetrievalConfig);
  });

  it("returns 401 without auth", async () => {
    const { POST } = await import("./retrieve/+server");
    const res = await POST({
      request: new Request("http://localhost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspace_id: workspaceId,
          query: "What is virtue ethics?",
        }),
      }),
      locals: {},
    } as unknown as Parameters<typeof POST>[0]);
    expect(res.status).toBe(401);
  });

  it("returns retrieve envelope for authorized gateway key", async () => {
    const { getProject } = await import("$lib/server/db");
    vi.mocked(getProject).mockResolvedValue({
      id: projectId,
      userId: "u1",
      workspaceId,
    } as Awaited<ReturnType<typeof getProject>>);

    const { POST } = await import("./retrieve/+server");
    const res = await POST({
      request: new Request("http://localhost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspace_id: workspaceId,
          project_id: projectId,
          query: "What is virtue ethics?",
        }),
      }),
      locals: {
        user: {
          uid: "u1",
          authType: "gateway_key",
          projectIdForKey: projectId,
          keyId: "k1",
        },
      },
    } as unknown as Parameters<typeof POST>[0]);

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.contract_version).toBe("2026-06-01");
    expect(data.context_block).toBeDefined();
    expect(data.metadata.retrieval_degraded).toBe(true);
    expect(data.metadata.retrieval_degraded_code).toBe("graph_target_not_configured");
  });

  it("returns 422 domain_pack_required when no domain pack is configured", async () => {
    const { getProject } = await import("$lib/server/db");
    vi.mocked(getProject).mockResolvedValue({
      id: projectId,
      userId: "u1",
      workspaceId,
    } as Awaited<ReturnType<typeof getProject>>);

    const { resolveWorkspaceRetrievalConfig } = await import(
      "$lib/server/connect-v1/workspace-retrieval-config"
    );
    vi.mocked(resolveWorkspaceRetrievalConfig).mockResolvedValue(null);

    const { POST } = await import("./retrieve/+server");
    const res = await POST({
      request: new Request("http://localhost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspace_id: workspaceId,
          project_id: projectId,
          query: "What is virtue ethics?",
        }),
      }),
      locals: {
        user: { uid: "u1", authType: "gateway_key", projectIdForKey: projectId, keyId: "k1" },
      },
    } as unknown as Parameters<typeof POST>[0]);

    expect(res.status).toBe(422);
    const data = await res.json();
    expect(data.error).toBe("domain_pack_required");
    expect(res.headers.get("Deprecation")).toBe("true");
  });
});

describe("POST /connect/v1/verify", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 for invalid body", async () => {
    const { POST } = await import("./verify/+server");
    const res = await POST({
      request: new Request("http://localhost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspace_id: workspaceId }),
      }),
      locals: {
        user: {
          uid: "u1",
          authType: "gateway_key",
          projectIdForKey: projectId,
          keyId: "k1",
        },
      },
    } as unknown as Parameters<typeof POST>[0]);
    expect(res.status).toBe(400);
  });
});

describe("POST /connect/v1/ingest/jobs", () => {
  it("creates a pending ingest job for authorized gateway key", async () => {
    const { getProject } = await import("$lib/server/db");
    const { insertConnectIngestJob } = await import("$lib/server/connect-ingest-jobs");
    vi.mocked(getProject).mockResolvedValue({
      id: projectId,
      userId: "u1",
      workspaceId,
    } as Awaited<ReturnType<typeof getProject>>);

    const { POST } = await import("./ingest/jobs/+server");
    const res = await POST({
      request: new Request("http://localhost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspace_id: workspaceId,
          project_id: projectId,
          sources: [{ text: "Sample corpus excerpt for smoke test." }],
          label: "smoke",
        }),
      }),
      locals: {
        user: {
          uid: "u1",
          authType: "gateway_key",
          projectIdForKey: projectId,
          keyId: "k1",
        },
      },
    } as unknown as Parameters<typeof POST>[0]);
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.contract_version).toBe("2026-06-01");
    expect(data.job.status).toBe("pending");
    expect(data.job.workspace_id).toBe(workspaceId);
    expect(insertConnectIngestJob).toHaveBeenCalledOnce();
  });
});
