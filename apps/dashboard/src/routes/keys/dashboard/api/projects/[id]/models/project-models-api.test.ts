/**
 * Project model index API tests (mocked db).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ModelRecord } from "$lib/server/neon";

const minimalModel: ModelRecord = {
  id: "voyage-3",
  canonicalName: "Voyage 3",
  family: null,
  lifecycleState: null,
  description: null,
  modalities: null,
  capabilities: null,
  contextWindow: null,
  maxOutputTokens: null,
  supportsTools: null,
  supportsStructuredOutput: null,
  supportsMcp: null,
  editorialSummary: null,
  strengths: null,
  weaknesses: null,
  recommendedFor: null,
  avoidFor: null,
  deprecationDate: null,
  retirementDate: null,
  replacementModelId: null,
  sourceLastVerifiedAt: null,
};

const upsertProjectModelBinding = vi.fn();
const listProjectModelBindings = vi.fn();
const replaceProjectModelBindings = vi.fn();
const updateProjectModelBindingEnabled = vi.fn();
const deleteProjectModelBinding = vi.fn();
const getProjectModelBinding = vi.fn();

vi.mock("$lib/server/db", () => ({
  getProject: vi.fn().mockResolvedValue({ id: "p1", name: "P", userId: "u1" }),
  getProjectInWorkspace: vi.fn(),
  getModel: vi.fn().mockImplementation((id: string) =>
    id === "voyage-3" || id === "text-embedding-005" ? { ...minimalModel, id } : null
  ),
  listModels: vi.fn().mockResolvedValue([]),
  listProviderModelVariants: vi.fn().mockImplementation((modelId: string) => {
    if (modelId === "voyage-3") return [{ providerIntegrationType: "voyage" }];
    if (modelId === "text-embedding-005") return [{ providerIntegrationType: "google" }];
    return [];
  }),
  listProjectModelBindings,
  upsertProjectModelBinding,
  replaceProjectModelBindings,
  updateProjectModelBindingEnabled,
  deleteProjectModelBinding,
  getProjectModelBinding,
}));

function mockEvent(
  projectId: string,
  init: RequestInit & { locals?: App.Locals; params?: Record<string, string>; urlSearch?: string } = {}
) {
  const params = init.params ?? { id: projectId };
  const url = new URL(init.urlSearch ? `http://localhost/?${init.urlSearch}` : "http://localhost/");
  return {
    params,
    request: new Request("http://localhost", { method: init.method ?? "GET", body: init.body, headers: init.headers }),
    locals: init.locals ?? { user: { uid: "u1", authType: "session" } },
    url,
  } as Parameters<typeof import("./+server").GET>[0];
}

describe("project models API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listProjectModelBindings.mockResolvedValue([]);
    upsertProjectModelBinding.mockImplementation(async (projectId: string, pt: string, mid: string) => ({
      id: "b1",
      projectId,
      providerType: pt,
      modelId: mid,
      enabled: true,
      createdAt: new Date(1).toISOString(),
      updatedAt: new Date(2).toISOString(),
    }));
    getProjectModelBinding.mockResolvedValue(null);
  });

  it("GET returns project index meta", async () => {
    const { GET } = await import("./+server");
    const res = await GET(mockEvent("p1"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.meta.source).toBe("project");
    expect(body.data).toEqual([]);
  });

  it("POST returns 403 for cross-project Gateway Key", async () => {
    const { POST } = await import("./+server");
    const res = await POST(
      mockEvent("p2", {
        method: "POST",
        body: JSON.stringify({ models: [{ providerType: "voyage", modelId: "voyage-3" }] }),
        headers: { "Content-Type": "application/json" },
        locals: {
          user: { uid: "u1", authType: "gateway_key", projectIdForKey: "p1", keyId: "k1" },
        } as App.Locals,
        params: { id: "p2" },
      })
    );
    expect(res.status).toBe(403);
  });

  it("POST batch adds models (idempotent upsert)", async () => {
    const { POST } = await import("./+server");
    listProjectModelBindings.mockResolvedValueOnce([
      {
        id: "b1",
        projectId: "p1",
        providerType: "voyage",
        modelId: "voyage-3",
        enabled: true,
        createdAt: new Date(1).toISOString(),
        updatedAt: new Date(2).toISOString(),
      },
    ]);
    const res = await POST(
      mockEvent("p1", {
        method: "POST",
        body: JSON.stringify({
          models: [
            { providerType: "voyage", modelId: "voyage-3" },
            { providerType: "vertex", modelId: "text-embedding-005" },
          ],
        }),
        headers: { "Content-Type": "application/json" },
      })
    );
    expect(res.status).toBe(200);
    expect(upsertProjectModelBinding).toHaveBeenCalledTimes(2);
    expect(upsertProjectModelBinding).toHaveBeenCalledWith("p1", "voyage", "voyage-3");
    expect(upsertProjectModelBinding).toHaveBeenCalledWith("p1", "vertex", "text-embedding-005");
  });

  it("POST returns 400 with errors for unknown model", async () => {
    const { POST } = await import("./+server");
    const res = await POST(
      mockEvent("p1", {
        method: "POST",
        body: JSON.stringify({ models: [{ providerType: "openai", modelId: "unknown-xyz" }] }),
        headers: { "Content-Type": "application/json" },
      })
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("project_models_validation_failed");
    expect(Array.isArray(body.errors)).toBe(true);
  });

  it("PUT replaces allowlist", async () => {
    const { PUT } = await import("./+server");
    listProjectModelBindings.mockResolvedValueOnce([]);
    const res = await PUT(
      mockEvent("p1", {
        method: "PUT",
        body: JSON.stringify({
          models: [{ providerType: "voyage", modelId: "voyage-3", enabled: false }],
        }),
        headers: { "Content-Type": "application/json" },
      })
    );
    expect(res.status).toBe(200);
    expect(replaceProjectModelBindings).toHaveBeenCalledWith("p1", [
      { canonicalProviderType: "voyage", modelId: "voyage-3", enabled: false },
    ]);
  });
});

describe("project models binding API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updateProjectModelBindingEnabled.mockResolvedValue({
      id: "b1",
      projectId: "p1",
      providerType: "voyage",
      modelId: "voyage-3",
      enabled: false,
      createdAt: new Date(1).toISOString(),
      updatedAt: new Date(2).toISOString(),
    });
    getProjectModelBinding.mockResolvedValue({
      id: "b1",
      projectId: "p1",
      providerType: "voyage",
      modelId: "voyage-3",
      enabled: false,
      createdAt: new Date(1).toISOString(),
      updatedAt: new Date(2).toISOString(),
    });
  });

  it("PATCH disables binding", async () => {
    const { PATCH } = await import("./[bindingId]/+server");
    const res = await PATCH({
      params: { id: "p1", bindingId: "b1" },
      request: new Request("http://localhost", {
        method: "PATCH",
        body: JSON.stringify({ enabled: false }),
        headers: { "Content-Type": "application/json" },
      }),
      locals: { user: { uid: "u1", authType: "session" } } as App.Locals,
    } as Parameters<typeof PATCH>[0]);
    expect(res.status).toBe(200);
    expect(updateProjectModelBindingEnabled).toHaveBeenCalledWith("b1", "p1", false);
  });

  it("DELETE removes binding", async () => {
    deleteProjectModelBinding.mockResolvedValueOnce(true);
    const { DELETE } = await import("./[bindingId]/+server");
    const res = await DELETE({
      params: { id: "p1", bindingId: "b1" },
      locals: { user: { uid: "u1", authType: "session" } } as App.Locals,
    } as Parameters<typeof DELETE>[0]);
    expect(res.status).toBe(200);
    expect(deleteProjectModelBinding).toHaveBeenCalledWith("b1", "p1");
  });
});
