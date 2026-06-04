/**
 * POST …/runtime/invoke — hosted runtime pipeline (OpenAI-compatible).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  RESOLVE_SIMULATE_CONTRACT_VERSION,
  RUNTIME_INVOKE_CONTRACT_VERSION,
} from "$lib/server/resolve-response";
import { RUNTIME_SWITCH_EVAL_VERSION } from "$lib/server/runtime-switch-eval";
import { KEYS_API_TEST_MODULE_FLAGS } from "$lib/module-flags-types";
import type { ResolvedRouteResult } from "$lib/server/route-resolver";

const mockProject = {
  id: "p1",
  name: "Proj",
  userId: "u1",
  workspaceId: "ws1",
  createdAt: 1,
};

const mockRoute = {
  id: "route-1",
  projectId: "p1",
  environmentId: "env-1",
  name: "Default",
  description: null,
  defaultModelId: "gpt-4o",
  billingMode: null,
  routeMode: null,
  workload: null as string | null,
  stage: null as string | null,
  enabled: true,
  version: 1,
  publishedVersion: 1,
  status: "active",
  createdBy: "u1",
  createdAt: 1,
  updatedAt: 1,
};

const mockStep = {
  id: "step-1",
  routeId: "route-1",
  orderIndex: 0,
  providerPreference: "openai",
  modelId: "gpt-4o",
  conditionBlock: null,
  fallbackOn: null,
  timeoutMs: null,
  enabled: true,
  createdAt: new Date(1).toISOString(),
  updatedAt: new Date(1).toISOString(),
};

vi.mock("$lib/server/db", () => ({
  getProject: vi.fn().mockResolvedValue(mockProject),
  getProjectInWorkspace: vi.fn(),
  getOrCreateDefaultWorkspace: vi.fn().mockResolvedValue({
    id: "ws1",
    name: "Default",
    slug: "default",
    ownerUserId: "u1",
    createdAt: 0,
    plan: "free",
    planExpiresAt: null,
  }),
  insertRequestLog: vi.fn().mockResolvedValue(undefined),
  aggregateRequestLogsToUsage: vi.fn().mockResolvedValue([]),
  getProjectDefaultEnvironmentId: vi.fn().mockResolvedValue("env-1"),
  listProviderBindingsByProject: vi.fn().mockResolvedValue([
    {
      id: "pb1",
      providerIntegrationId: "int1",
      projectId: "p1",
      environmentId: null,
      status: "active",
      usageMode: null,
      createdAt: 1,
      integration: {
        id: "int1",
        workspaceId: "ws1",
        providerType: "openai",
        displayName: "OpenAI",
        status: "active",
        verificationStatus: null,
        credentialRef: null,
        createdBy: "u1",
        createdAt: 1,
        lastVerifiedAt: null,
        metadata: null,
        region: null,
      },
    },
  ]),
  getProviderIntegrationSecretRow: vi.fn().mockResolvedValue({
    providerType: "openai",
    credentialCiphertext: "x",
    credentialIv: "x",
    credentialAuthTag: "x",
    credentialEncryptionVersion: 1,
  }),
}));

vi.mock("$lib/server/entitlements", () => ({
  getWorkspaceEntitlements: vi.fn().mockResolvedValue(null),
}));

vi.mock("$lib/server/credential-crypto", () => ({
  decryptProviderSecret: vi.fn().mockReturnValue({ ok: true, secret: "sk-test" }),
}));

vi.mock("$lib/server/runtime-invoke-chain", () => ({
  runRuntimeInvokePipeline: vi.fn(),
}));

function mockEvent(
  body: Record<string, unknown>,
  locals: App.Locals = {
    user: { uid: "u1" },
    moduleFlags: KEYS_API_TEST_MODULE_FLAGS,
  } as App.Locals
) {
  return {
    params: { id: "p1", routeId: "route-1" },
    request: new Request("http://localhost/api/projects/p1/routes/route-1/runtime/invoke", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    locals,
  } as any;
}

function resolvedOpenAi(): ResolvedRouteResult {
  return {
    workspaceId: "ws1",
    projectId: "p1",
    environmentId: "env-1",
    route: mockRoute,
    steps: [mockStep],
    selectedStep: mockStep,
    selectedStepId: mockStep.id,
    selectedOrderIndex: 0,
    providerType: "openai",
    modelId: "gpt-4o",
    explanation: "ok",
    stepChain: [],
    fallbackCandidates: [],
  };
}

describe("POST …/runtime/invoke", () => {
  beforeEach(async () => {
    const { runRuntimeInvokePipeline } = await import("$lib/server/runtime-invoke-chain");
    vi.mocked(runRuntimeInvokePipeline).mockReset();
  });

  it("returns 401 when user missing", async () => {
    const { POST } = await import("./+server");
    const res = await POST(
      mockEvent({ environmentId: "env-1", messages: [{ role: "user", content: "hi" }] }, {
        user: undefined,
        moduleFlags: KEYS_API_TEST_MODULE_FLAGS,
      } as App.Locals)
    );
    expect(res.status).toBe(401);
  });

  it("returns 400 when messages missing", async () => {
    const { POST } = await import("./+server");
    const res = await POST(mockEvent({ environmentId: "env-1" }));
    expect(res.status).toBe(400);
  });

  it("returns 200 with content and runtimeContractVersion when pipeline succeeds", async () => {
    const { runRuntimeInvokePipeline } = await import("$lib/server/runtime-invoke-chain");
    vi.mocked(runRuntimeInvokePipeline).mockResolvedValue({
      ok: true,
      finalContent: "Hello from model",
      aggregatedUsage: { promptTokens: 5, completionTokens: 10, totalTokens: 15 },
      estimatedCostUsdTotal: 0.01,
      runtimeSteps: [
        {
          routeStepId: "step-1",
          orderIndex: 0,
          providerType: "openai",
          modelId: "gpt-4o",
          promptTokens: 5,
          completionTokens: 10,
          totalTokens: 15,
        },
      ],
      resolvedForContract: resolvedOpenAi(),
    });

    const { POST } = await import("./+server");
    const res = await POST(
      mockEvent({
        environmentId: "env-1",
        messages: [{ role: "user", content: "Hello" }],
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.runtimeContractVersion).toBe(RUNTIME_INVOKE_CONTRACT_VERSION);
    expect(body.data.runtimeSwitchEvalVersion).toBe(RUNTIME_SWITCH_EVAL_VERSION);
    expect(body.data.content).toBe("Hello from model");
    expect(body.data.contractVersion).toBe(RESOLVE_SIMULATE_CONTRACT_VERSION);
    expect(body.data.usage.totalTokens).toBe(15);
    expect(body.data.runtimeSteps).toHaveLength(1);
  });

  it("returns 422 resolve_incomplete when pipeline cannot execute any step (e.g. unsupported providers)", async () => {
    const { runRuntimeInvokePipeline } = await import("$lib/server/runtime-invoke-chain");
    vi.mocked(runRuntimeInvokePipeline).mockResolvedValue({
      ok: false,
      httpStatus: 422,
      error: "resolve_incomplete",
      message: "No step produced output",
      routeId: "route-1",
    });

    const { POST } = await import("./+server");
    const res = await POST(
      mockEvent({
        environmentId: "env-1",
        messages: [{ role: "user", content: "Hello" }],
      })
    );
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toBe("resolve_incomplete");
  });
});
