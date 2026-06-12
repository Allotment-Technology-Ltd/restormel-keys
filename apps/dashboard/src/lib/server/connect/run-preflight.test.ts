/**
 * Stage K3 matrix tests: buildPreflightProviderRow (binding × credential ×
 * verification states) and computeConnectRunPreflight end-to-end shapes
 * (legacy env key, no routes, pass, blocked, unresolved-model warning).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("$lib/server/runtime-invoke", () => ({
  findDecryptedApiKeyForResolvedProvider: vi.fn(),
}));
vi.mock("$lib/server/db", () => ({
  listProviderBindingsByProject: vi.fn(),
  listProviderIntegrations: vi.fn(),
}));
vi.mock("$lib/server/connect/llm-generate", () => ({
  isLlmConfigured: vi.fn(() => false),
}));
vi.mock("$lib/server/connect/stage-routing", () => ({
  listConnectStageRouteRows: vi.fn(),
  resolveKnowledgeRouteExecutionContext: vi.fn(),
}));

import { findDecryptedApiKeyForResolvedProvider } from "$lib/server/runtime-invoke";
import { listProviderBindingsByProject, listProviderIntegrations } from "$lib/server/db";
import { isLlmConfigured } from "$lib/server/connect/llm-generate";
import {
  listConnectStageRouteRows,
  resolveKnowledgeRouteExecutionContext,
} from "$lib/server/connect/stage-routing";
import {
  buildPreflightProviderRow,
  computeConnectRunPreflight,
  type PreflightCredentialOutcome,
} from "./run-preflight";

const BASE = "/keys/dashboard";
const findKey = vi.mocked(findDecryptedApiKeyForResolvedProvider);
const listBindings = vi.mocked(listProviderBindingsByProject);
const listIntegrations = vi.mocked(listProviderIntegrations);
const llmConfigured = vi.mocked(isLlmConfigured);
const listStageRows = vi.mocked(listConnectStageRouteRows);
const resolveCtx = vi.mocked(resolveKnowledgeRouteExecutionContext);

function stageRow(key: string, provider: string | null, over: Record<string, unknown> = {}) {
  return {
    key,
    label: key,
    help: "",
    ingestionStage: key,
    route: { id: `route-${key}`, name: key, status: "active", isPublished: true, enabled: true },
    visualHref: null,
    activeModel: provider ? { modelId: "m-1", provider } : null,
    ...over,
  };
}

function integration(over: Record<string, unknown> = {}) {
  return {
    id: "int-openai",
    workspaceId: "ws-1",
    providerType: "openai",
    displayName: "OpenAI prod",
    status: "active",
    verificationStatus: "verified",
    credentialRef: null,
    createdBy: null,
    createdAt: 0,
    lastVerifiedAt: null,
    metadata: null,
    region: null,
    hasEncryptedCredential: true,
    credentialMasked: null,
    ...over,
  };
}

function binding(over: Record<string, unknown> = {}) {
  return {
    id: "bind-1",
    providerIntegrationId: "int-openai",
    projectId: "proj-1",
    environmentId: "env-1",
    status: "active",
    usageMode: null,
    createdAt: 0,
    integration: integration(),
    ...over,
  };
}

const CTX = {
  workspaceId: "ws-1",
  userId: "user-1",
  projectId: "proj-1",
  environmentId: "env-1",
  routing: { project_id: "proj-1", environment_id: "env-1" },
};

beforeEach(() => {
  vi.clearAllMocks();
  llmConfigured.mockReturnValue(false);
  listBindings.mockResolvedValue([]);
  listIntegrations.mockResolvedValue([]);
});

describe("buildPreflightProviderRow — matrix", () => {
  const baseArgs = {
    provider: "openai",
    stages: ["extraction"] as never[],
    boundIntegrationId: null as string | null,
    candidates: [] as { id: string; label: string }[],
    base: BASE,
  };

  it("ok: passing row, no issue, no bind action", () => {
    const row = buildPreflightProviderRow({ ...baseArgs, outcome: "ok" });
    expect(row).toMatchObject({ hasBinding: true, credentialExecutable: true, issue: null, bind: null });
  });

  it("no_provider_binding: bind action only when exactly one candidate", () => {
    const none = buildPreflightProviderRow({ ...baseArgs, outcome: "no_provider_binding" });
    expect(none).toMatchObject({ hasBinding: false, issue: "no_provider_binding", bind: null });
    expect(none.fixLabel).toBe("Connect openai");

    const one = buildPreflightProviderRow({
      ...baseArgs,
      outcome: "no_provider_binding",
      candidates: [{ id: "int-1", label: "OpenAI prod" }],
    });
    expect(one.bind).toEqual({ integrationId: "int-1", label: "OpenAI prod" });
    expect(one.fixLabel).toBe("Open Connections");

    const two = buildPreflightProviderRow({
      ...baseArgs,
      outcome: "no_provider_binding",
      candidates: [
        { id: "int-1", label: "A" },
        { id: "int-2", label: "B" },
      ],
    });
    expect(two.bind).toBeNull(); // ambiguous — never guess which key to bind
  });

  it("credential_unavailable: re-enter key on the bound integration's detail page", () => {
    const row = buildPreflightProviderRow({
      ...baseArgs,
      outcome: "credential_unavailable",
      boundIntegrationId: "int-9",
    });
    expect(row).toMatchObject({
      hasBinding: true,
      credentialExecutable: false,
      issue: "credential_unavailable",
      fixHref: `${BASE}/integrations/int-9`,
      fixLabel: "Re-enter key",
    });
  });

  it("verification_failed (K2): blocked with a re-verify path", () => {
    const row = buildPreflightProviderRow({
      ...baseArgs,
      outcome: "verification_failed",
      boundIntegrationId: "int-9",
    });
    expect(row).toMatchObject({
      hasBinding: true,
      credentialExecutable: false,
      issue: "verification_failed",
      fixHref: `${BASE}/integrations/int-9`,
      fixLabel: "Re-verify key",
    });
  });

  it("integration_not_found: rebind from Connections, one-click when unambiguous", () => {
    const row = buildPreflightProviderRow({
      ...baseArgs,
      outcome: "integration_not_found",
      candidates: [{ id: "int-1", label: "OpenAI prod" }],
    });
    expect(row).toMatchObject({
      issue: "integration_not_found",
      bind: { integrationId: "int-1", label: "OpenAI prod" },
      fixHref: `${BASE}/integrations`,
    });
  });

  it("no_provider folds into no_provider_binding (total mapping)", () => {
    const row = buildPreflightProviderRow({ ...baseArgs, outcome: "no_provider" });
    expect(row.issue).toBe("no_provider_binding");
  });

  it("every non-ok outcome produces a non-null issue and an absolute fix href", () => {
    const outcomes: PreflightCredentialOutcome[] = [
      "no_provider",
      "no_provider_binding",
      "integration_not_found",
      "credential_unavailable",
      "verification_failed",
    ];
    for (const outcome of outcomes) {
      const row = buildPreflightProviderRow({ ...baseArgs, outcome });
      expect(row.issue).not.toBeNull();
      expect(row.credentialExecutable).toBe(false);
      expect(row.fixHref.startsWith(BASE)).toBe(true);
    }
  });
});

describe("computeConnectRunPreflight", () => {
  it("no routing config + legacy env key → legacy_env (override-gated, not blocked)", async () => {
    resolveCtx.mockResolvedValue(null);
    llmConfigured.mockReturnValue(true);
    const out = await computeConnectRunPreflight({ workspaceId: "ws-1", userId: "user-1" });
    expect(out.status).toBe("legacy_env");
    expect(out.issues).toEqual(["legacy_env_key"]);
    expect(out.projectId).toBeNull();
  });

  it("no routing config and no env key → blocked with no_stage_routes", async () => {
    resolveCtx.mockResolvedValue(null);
    const out = await computeConnectRunPreflight({ workspaceId: "ws-1", userId: "user-1" });
    expect(out.status).toBe("blocked");
    expect(out.issues).toEqual(["no_stage_routes"]);
  });

  it("routing config but zero published routes behaves like legacy/no-routes", async () => {
    resolveCtx.mockResolvedValue(CTX as never);
    listStageRows.mockResolvedValue([
      stageRow("extraction", "openai", {
        route: { id: "r1", name: "x", status: "draft", isPublished: false, enabled: true },
      }),
    ] as never);
    const out = await computeConnectRunPreflight({ workspaceId: "ws-1", userId: "user-1" });
    expect(out.status).toBe("blocked");
    expect(out.issues).toEqual(["no_stage_routes"]);
    expect(out.projectId).toBe("proj-1");
  });

  it("pass: every stage-route provider resolves an executable, verified credential", async () => {
    resolveCtx.mockResolvedValue(CTX as never);
    listStageRows.mockResolvedValue([
      stageRow("extraction", "openai"),
      stageRow("validation", "openai"),
      stageRow("embedding", "voyage"),
    ] as never);
    findKey.mockResolvedValue({ ok: true, apiKey: "sk-x" });
    listBindings.mockResolvedValue([
      binding(),
      binding({ id: "bind-2", providerIntegrationId: "int-voyage", integration: integration({ id: "int-voyage", providerType: "voyage" }) }),
    ] as never);
    listIntegrations.mockResolvedValue([integration(), integration({ id: "int-voyage", providerType: "voyage" })] as never);

    const out = await computeConnectRunPreflight({ workspaceId: "ws-1", userId: "user-1" });
    expect(out.status).toBe("pass");
    expect(out.issues).toEqual([]);
    const openai = out.providers.find((r) => r.provider === "openai");
    expect(openai?.stages).toEqual(["extraction", "validation"]); // grouped per provider
    expect(out.providers).toHaveLength(2);
  });

  it("blocked: missing binding surfaces the one-click bind candidate", async () => {
    resolveCtx.mockResolvedValue(CTX as never);
    listStageRows.mockResolvedValue([stageRow("extraction", "openai")] as never);
    findKey.mockResolvedValue({ ok: false, code: "no_provider_binding" });
    listIntegrations.mockResolvedValue([integration()] as never);

    const out = await computeConnectRunPreflight({ workspaceId: "ws-1", userId: "user-1" });
    expect(out.status).toBe("blocked");
    expect(out.issues).toEqual(["no_provider_binding:openai"]);
    expect(out.providers[0].bind).toEqual({ integrationId: "int-openai", label: "OpenAI prod" });
  });

  it("blocked: decryptable key that failed K2 verification (verification_failed)", async () => {
    resolveCtx.mockResolvedValue(CTX as never);
    listStageRows.mockResolvedValue([stageRow("extraction", "openai")] as never);
    findKey.mockResolvedValue({ ok: true, apiKey: "sk-x" });
    listBindings.mockResolvedValue([
      binding({ integration: integration({ verificationStatus: "failed" }) }),
    ] as never);
    listIntegrations.mockResolvedValue([integration({ verificationStatus: "failed" })] as never);

    const out = await computeConnectRunPreflight({ workspaceId: "ws-1", userId: "user-1" });
    expect(out.status).toBe("blocked");
    expect(out.issues).toEqual(["verification_failed:openai"]);
    expect(out.providers[0].fixHref).toBe(`${BASE}/integrations/int-openai`);
  });

  it("pending/unverified credentials do NOT block (only K2 'failed' does)", async () => {
    resolveCtx.mockResolvedValue(CTX as never);
    listStageRows.mockResolvedValue([stageRow("extraction", "openai")] as never);
    findKey.mockResolvedValue({ ok: true, apiKey: "sk-x" });
    listBindings.mockResolvedValue([
      binding({ integration: integration({ verificationStatus: "pending" }) }),
    ] as never);
    listIntegrations.mockResolvedValue([integration({ verificationStatus: "pending" })] as never);

    const out = await computeConnectRunPreflight({ workspaceId: "ws-1", userId: "user-1" });
    expect(out.status).toBe("pass");
  });

  it("unresolved primary model is a warning issue, not a block", async () => {
    resolveCtx.mockResolvedValue(CTX as never);
    listStageRows.mockResolvedValue([
      stageRow("extraction", "openai"),
      stageRow("grouping", null), // published route, unresolved model
    ] as never);
    findKey.mockResolvedValue({ ok: true, apiKey: "sk-x" });
    listBindings.mockResolvedValue([binding()] as never);
    listIntegrations.mockResolvedValue([integration()] as never);

    const out = await computeConnectRunPreflight({ workspaceId: "ws-1", userId: "user-1" });
    expect(out.status).toBe("pass");
    expect(out.issues).toEqual(["stage_route_unresolved_model:grouping"]);
  });

  it("binding/integration list failures degrade to no candidates without throwing", async () => {
    resolveCtx.mockResolvedValue(CTX as never);
    listStageRows.mockResolvedValue([stageRow("extraction", "openai")] as never);
    findKey.mockResolvedValue({ ok: false, code: "no_provider_binding" });
    listBindings.mockRejectedValue(new Error("db down"));
    listIntegrations.mockRejectedValue(new Error("db down"));

    const out = await computeConnectRunPreflight({ workspaceId: "ws-1", userId: "user-1" });
    expect(out.status).toBe("blocked");
    expect(out.providers[0].bind).toBeNull();
  });
});
