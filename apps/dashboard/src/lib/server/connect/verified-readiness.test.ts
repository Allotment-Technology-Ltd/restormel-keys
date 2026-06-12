/**
 * Stage K4 matrix tests: buildVerifiedReadinessRows (all-green / each-single-gap /
 * multi-gap), fix-link routing per row, decryptable family derivation, and
 * computeConnectVerifiedReadiness end-to-end shapes.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("$lib/server/db", () => ({
  countApiKeysByWorkspace: vi.fn(),
  listProviderIntegrations: vi.fn(),
}));
vi.mock("$lib/server/credential-crypto", () => ({
  isCredentialEncryptionConfigured: vi.fn(() => true),
}));
vi.mock("$lib/server/connect/llm-generate", () => ({
  isLlmConfigured: vi.fn(() => false),
}));
vi.mock("$lib/server/connect/run-preflight", () => ({
  computeConnectRunPreflight: vi.fn(),
}));
vi.mock("$lib/server/connect/graph-target-service", () => ({
  getGraphTargetForUi: vi.fn(),
}));
vi.mock("$lib/server/connect/source-documents", () => ({
  listSourceDocuments: vi.fn(),
}));
vi.mock("$lib/server/connect/stage-routing", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./stage-routing")>();
  return {
    ...actual,
    listConnectStageRouteRows: vi.fn(),
    resolveKnowledgeRouteExecutionContext: vi.fn(),
  };
});

import { countApiKeysByWorkspace, listProviderIntegrations } from "$lib/server/db";
import { computeConnectRunPreflight } from "$lib/server/connect/run-preflight";
import {
  listConnectStageRouteRows,
  resolveKnowledgeRouteExecutionContext,
} from "$lib/server/connect/stage-routing";
import type {
  ConnectRunPreflightProviderRow,
  ConnectRunPreflightResult,
} from "$lib/connect/run-preflight";
import {
  buildVerifiedReadinessRows,
  computeConnectVerifiedReadiness,
  decryptableProviderFamilies,
  type VerifiedReadinessSignals,
} from "./verified-readiness";
import {
  overallReadinessStatus,
  readinessChipLabel,
  readinessStepDetail,
  resolveReadinessPanelState,
  connectReadinessHubHref,
} from "$lib/connect/verified-readiness";

const BASE = "/keys/dashboard";

const countKeys = vi.mocked(countApiKeysByWorkspace);
const listIntegrations = vi.mocked(listProviderIntegrations);
const preflightMock = vi.mocked(computeConnectRunPreflight);
const stageRowsMock = vi.mocked(listConnectStageRouteRows);
const resolveCtxMock = vi.mocked(resolveKnowledgeRouteExecutionContext);

function passRow(provider: string): ConnectRunPreflightProviderRow {
  return {
    provider,
    stages: ["extraction"],
    hasBinding: true,
    credentialExecutable: true,
    issue: null,
    bind: null,
    fixHref: `${BASE}/integrations`,
    fixLabel: "Open Connections",
  };
}

function failRow(
  provider: string,
  issue: NonNullable<ConnectRunPreflightProviderRow["issue"]>,
  fixHref = `${BASE}/integrations`,
  fixLabel = "Open Connections",
): ConnectRunPreflightProviderRow {
  return {
    provider,
    stages: ["extraction"],
    hasBinding: issue !== "no_provider_binding",
    credentialExecutable: false,
    issue,
    bind: null,
    fixHref,
    fixLabel,
  };
}

function preflight(
  status: ConnectRunPreflightResult["status"],
  providers: ConnectRunPreflightProviderRow[],
): ConnectRunPreflightResult {
  return {
    status,
    projectId: "proj-1",
    environmentId: "env-1",
    providers,
    issues: providers.filter((p) => p.issue).map((p) => `${p.issue}:${p.provider}`),
    checkedAt: new Date().toISOString(),
  };
}

/** All six rows green. */
function greenSignals(): VerifiedReadinessSignals {
  return {
    gatewayKeyCount: 2,
    decryptableFamilies: ["anthropic", "openai"],
    llmReady: false,
    hasProjectRouting: true,
    hasChatRoute: true,
    hasEmbeddingRoute: true,
    draftStageRoutes: [],
    routingProjectId: "proj-1",
    preflight: preflight("pass", [passRow("openai"), passRow("anthropic")]),
    encryptionReady: true,
    graphStoreReady: true,
    parsedDocumentCount: 3,
  };
}

function rowById(rows: ReturnType<typeof buildVerifiedReadinessRows>, id: string) {
  const row = rows.find((r) => r.id === id);
  if (!row) throw new Error(`row ${id} missing`);
  return row;
}

describe("buildVerifiedReadinessRows — all-green", () => {
  it("returns six ok rows with no fix links", () => {
    const rows = buildVerifiedReadinessRows(greenSignals(), BASE);
    expect(rows).toHaveLength(6);
    expect(rows.map((r) => r.id)).toEqual([
      "gateway_key",
      "provider_families",
      "stage_routes",
      "provider_binding",
      "encryption",
      "store_documents",
    ]);
    for (const row of rows) {
      expect(row.status).toBe("ok");
      expect(row.fixHref).toBeNull();
      expect(row.fixLabel).toBeNull();
    }
    expect(overallReadinessStatus(rows)).toBe("ok");
  });

  it("provider families evidence discloses cross-model validation", () => {
    const rows = buildVerifiedReadinessRows(greenSignals(), BASE);
    expect(rowById(rows, "provider_families").evidence).toBe(
      "2 families: anthropic, openai — cross-model validation on",
    );
  });

  it("binding evidence lists the providers bound to the routing project", () => {
    const rows = buildVerifiedReadinessRows(greenSignals(), BASE);
    expect(rowById(rows, "provider_binding").evidence).toContain("openai, anthropic bound");
  });
});

describe("buildVerifiedReadinessRows — each single gap + fix-link routing", () => {
  it("no gateway key → warn with Access fix link", () => {
    const rows = buildVerifiedReadinessRows({ ...greenSignals(), gatewayKeyCount: 0 }, BASE);
    const row = rowById(rows, "gateway_key");
    expect(row.status).toBe("warn");
    expect(row.fixHref).toBe(`${BASE}/access`);
    expect(row.fixLabel).toBe("Create a Gateway key");
    // only this row regressed
    expect(rows.filter((r) => r.status === "ok")).toHaveLength(5);
  });

  it("single family → K-P1-7 coaching line linking to Connections", () => {
    const rows = buildVerifiedReadinessRows(
      { ...greenSignals(), decryptableFamilies: ["openai"] },
      BASE,
    );
    const row = rowById(rows, "provider_families");
    expect(row.status).toBe("warn");
    expect(row.evidence).toContain(
      "add a second provider family to enable cross-model validation",
    );
    expect(row.fixHref).toBe(`${BASE}/integrations`);
  });

  it("zero families without legacy key → fail", () => {
    const rows = buildVerifiedReadinessRows(
      { ...greenSignals(), decryptableFamilies: [] },
      BASE,
    );
    const row = rowById(rows, "provider_families");
    expect(row.status).toBe("fail");
    expect(row.fixHref).toBe(`${BASE}/integrations`);
  });

  it("zero families with legacy env key → warn, not fail", () => {
    const rows = buildVerifiedReadinessRows(
      { ...greenSignals(), decryptableFamilies: [], llmReady: true },
      BASE,
    );
    expect(rowById(rows, "provider_families").status).toBe("warn");
  });

  it("missing embedding route without drafts → fail linking to Models", () => {
    const rows = buildVerifiedReadinessRows(
      { ...greenSignals(), hasEmbeddingRoute: false },
      BASE,
    );
    const row = rowById(rows, "stage_routes");
    expect(row.status).toBe("fail");
    expect(row.evidence).toContain("embedding");
    expect(row.fixHref).toBe(`${BASE}/connect/models`);
  });

  it("draft stage route → fix link goes to the builder Versions tab (K-P0-3)", () => {
    const rows = buildVerifiedReadinessRows(
      {
        ...greenSignals(),
        hasEmbeddingRoute: false,
        draftStageRoutes: [{ stage: "embedding", routeId: "route-9", name: "Embed route" }],
      },
      BASE,
    );
    const row = rowById(rows, "stage_routes");
    expect(row.status).toBe("fail");
    expect(row.fixHref).toBe(`${BASE}/projects/proj-1/routes/route-9?tab=versions`);
    expect(row.fixLabel).toBe("Publish route");
    expect(row.evidence).toContain('"Embed route"');
    expect(row.evidence).toContain("publish to use");
  });

  it("no project routing with legacy key → warn", () => {
    const rows = buildVerifiedReadinessRows(
      {
        ...greenSignals(),
        hasProjectRouting: false,
        hasChatRoute: false,
        hasEmbeddingRoute: false,
        llmReady: true,
      },
      BASE,
    );
    expect(rowById(rows, "stage_routes").status).toBe("warn");
  });

  it("blocked preflight → binding row fails with the failing row's exact fix link", () => {
    const blocked = preflight("blocked", [
      passRow("openai"),
      failRow("anthropic", "no_provider_binding", `${BASE}/integrations`, "Connect anthropic"),
    ]);
    const rows = buildVerifiedReadinessRows({ ...greenSignals(), preflight: blocked }, BASE);
    const row = rowById(rows, "provider_binding");
    expect(row.status).toBe("fail");
    expect(row.evidence).toContain("anthropic");
    expect(row.fixHref).toBe(`${BASE}/integrations`);
    expect(row.fixLabel).toBe("Connect anthropic");
  });

  it("multiple blocked providers → evidence carries the count prefix", () => {
    const blocked = preflight("blocked", [
      failRow("openai", "credential_unavailable", `${BASE}/integrations/int-1`, "Re-enter key"),
      failRow("anthropic", "verification_failed", `${BASE}/integrations/int-2`, "Re-verify key"),
    ]);
    const rows = buildVerifiedReadinessRows({ ...greenSignals(), preflight: blocked }, BASE);
    const row = rowById(rows, "provider_binding");
    expect(row.evidence).toMatch(/^2 providers blocked — /);
    // first failing row's repair wins the deep-link
    expect(row.fixHref).toBe(`${BASE}/integrations/int-1`);
  });

  it("legacy_env preflight → warn linking to Models", () => {
    const rows = buildVerifiedReadinessRows(
      { ...greenSignals(), preflight: preflight("legacy_env", []) },
      BASE,
    );
    const row = rowById(rows, "provider_binding");
    expect(row.status).toBe("warn");
    expect(row.fixHref).toBe(`${BASE}/connect/models`);
  });

  it("null preflight → warn pointing at the launch step re-check", () => {
    const rows = buildVerifiedReadinessRows({ ...greenSignals(), preflight: null }, BASE);
    const row = rowById(rows, "provider_binding");
    expect(row.status).toBe("warn");
    expect(row.fixHref).toBe(`${BASE}/connect/pipeline?step=launch`);
  });

  it("blocked preflight with zero rows (no stage routes, no legacy key) → fail", () => {
    const rows = buildVerifiedReadinessRows(
      { ...greenSignals(), preflight: preflight("blocked", []) },
      BASE,
    );
    const row = rowById(rows, "provider_binding");
    expect(row.status).toBe("fail");
    expect(row.fixHref).toBe(`${BASE}/connect/models`);
  });

  it("encryption unconfigured → fail with Connections fix link", () => {
    const rows = buildVerifiedReadinessRows({ ...greenSignals(), encryptionReady: false }, BASE);
    const row = rowById(rows, "encryption");
    expect(row.status).toBe("fail");
    expect(row.fixHref).toBe(`${BASE}/integrations`);
  });

  it("no graph store → fail linking to the pipeline store step", () => {
    const rows = buildVerifiedReadinessRows({ ...greenSignals(), graphStoreReady: false }, BASE);
    const row = rowById(rows, "store_documents");
    expect(row.status).toBe("fail");
    expect(row.fixHref).toBe(`${BASE}/connect/pipeline?step=store`);
  });

  it("store connected but no documents → warn linking to sources", () => {
    const rows = buildVerifiedReadinessRows(
      { ...greenSignals(), parsedDocumentCount: 0 },
      BASE,
    );
    const row = rowById(rows, "store_documents");
    expect(row.status).toBe("warn");
    expect(row.fixHref).toBe(`${BASE}/connect/pipeline?step=sources`);
  });
});

describe("buildVerifiedReadinessRows — multi-gap", () => {
  it("several regressions report independently and the worst status wins", () => {
    const rows = buildVerifiedReadinessRows(
      {
        ...greenSignals(),
        gatewayKeyCount: 0,
        decryptableFamilies: ["openai"],
        encryptionReady: false,
      },
      BASE,
    );
    expect(rowById(rows, "gateway_key").status).toBe("warn");
    expect(rowById(rows, "provider_families").status).toBe("warn");
    expect(rowById(rows, "encryption").status).toBe("fail");
    expect(rowById(rows, "stage_routes").status).toBe("ok");
    expect(overallReadinessStatus(rows)).toBe("fail");
    expect(rows.filter((r) => r.status === "ok")).toHaveLength(3);
  });
});

describe("summary helpers — chip + ai_keys step detail (same model, no drift)", () => {
  it("chip label matches the brief's copy shape", () => {
    expect(readinessChipLabel({ ready: 4, total: 6 })).toBe("Connect: 4/6 ready");
  });

  it("step detail names the first regressed row", () => {
    const rows = buildVerifiedReadinessRows({ ...greenSignals(), gatewayKeyCount: 0 }, BASE);
    const detail = readinessStepDetail({ rows, ready: 5, total: 6 });
    expect(detail).toBe("5/6 readiness checks pass — next: gateway key");
  });

  it("all-green step detail says ready to verify", () => {
    const rows = buildVerifiedReadinessRows(greenSignals(), BASE);
    expect(readinessStepDetail({ rows, ready: 6, total: 6 })).toBe(
      "Ready to verify — all 6 readiness checks pass",
    );
  });

  it("null readiness → null detail so callers fall back to legacy copy", () => {
    expect(readinessStepDetail(null)).toBeNull();
  });

  it("panel state: signed-out, compute-failed (error), and ledger", () => {
    expect(resolveReadinessPanelState(false, null)).toBe("signed_out");
    expect(resolveReadinessPanelState(true, null)).toBe("error");
    const rows = buildVerifiedReadinessRows(greenSignals(), BASE);
    expect(
      resolveReadinessPanelState(true, {
        rows,
        ready: 6,
        total: 6,
        status: "ok",
        checkedAt: new Date().toISOString(),
        models: { modelsReady: true, hasChatRoute: true, hasEmbeddingRoute: true },
      }),
    ).toBe("ledger");
  });

  it("hub anchor href targets the ledger panel", () => {
    expect(connectReadinessHubHref(BASE)).toBe(`${BASE}/connect#readiness`);
  });
});

describe("decryptableProviderFamilies", () => {
  it("filters non-active and non-decryptable integrations, dedupes, normalizes, sorts", () => {
    const families = decryptableProviderFamilies([
      { providerType: "openai", status: "active", hasEncryptedCredential: true },
      { providerType: "OpenAI", status: "active", hasEncryptedCredential: true },
      { providerType: "google", status: "active", hasEncryptedCredential: true },
      // reference-only credential (K-P1-3): present but not executable
      { providerType: "anthropic", status: "active", hasEncryptedCredential: false },
      { providerType: "mistral", status: "disabled", hasEncryptedCredential: true },
      { providerType: "made-up-provider", status: "active", hasEncryptedCredential: true },
    ]);
    expect(families).toEqual(["openai", "vertex"]);
  });
});

describe("computeConnectVerifiedReadiness — end-to-end", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function stageRow(key: string, over: Record<string, unknown> = {}) {
    return {
      key,
      label: key,
      help: "",
      ingestionStage: key,
      route: { id: `route-${key}`, name: `${key} route`, status: "active", isPublished: true, enabled: true },
      visualHref: null,
      activeModel: { modelId: "m-1", provider: "openai" },
      ...over,
    };
  }

  function integration(over: Record<string, unknown> = {}) {
    return {
      id: "int-1",
      workspaceId: "ws-1",
      providerType: "openai",
      displayName: "OpenAI",
      status: "active",
      verificationStatus: "verified",
      credentialRef: null,
      createdBy: null,
      createdAt: Date.now(),
      lastVerifiedAt: null,
      metadata: null,
      region: null,
      hasEncryptedCredential: true,
      ...over,
    };
  }

  it("all-green workspace → 6/6 ready with models signals", async () => {
    countKeys.mockResolvedValue(1);
    listIntegrations.mockResolvedValue([
      integration(),
      integration({ id: "int-2", providerType: "anthropic" }),
    ] as never);
    resolveCtxMock.mockResolvedValue({
      workspaceId: "ws-1",
      userId: "u-1",
      projectId: "proj-1",
      environmentId: "env-1",
      routing: { project_id: "proj-1", environment_id: "env-1" },
    } as never);
    stageRowsMock.mockResolvedValue([
      stageRow("extraction"),
      stageRow("embedding"),
    ] as never);
    preflightMock.mockResolvedValue(
      preflight("pass", [passRow("openai"), passRow("anthropic")]),
    );

    const readiness = await computeConnectVerifiedReadiness({
      workspaceId: "ws-1",
      userId: "u-1",
      dashboardBase: BASE,
      prefetched: {
        graphStoreReady: true,
        parsedDocumentCount: 5,
        encryptionReady: true,
        llmReady: false,
      },
    });

    expect(readiness.ready).toBe(6);
    expect(readiness.total).toBe(6);
    expect(readiness.status).toBe("ok");
    expect(readiness.models).toEqual({
      modelsReady: true,
      hasChatRoute: true,
      hasEmbeddingRoute: true,
    });
    expect(readinessChipLabel(readiness)).toBe("Connect: 6/6 ready");
  });

  it("draft embedding route + missing binding → multi-gap ledger with deep links", async () => {
    countKeys.mockResolvedValue(0);
    listIntegrations.mockResolvedValue([integration()] as never);
    resolveCtxMock.mockResolvedValue({
      workspaceId: "ws-1",
      userId: "u-1",
      projectId: "proj-1",
      environmentId: "env-1",
      routing: { project_id: "proj-1", environment_id: "env-1" },
    } as never);
    stageRowsMock.mockResolvedValue([
      stageRow("extraction"),
      stageRow("embedding", {
        route: { id: "route-embedding", name: "Embed route", status: "active", isPublished: false, enabled: true },
      }),
    ] as never);
    preflightMock.mockResolvedValue(
      preflight("blocked", [failRow("openai", "no_provider_binding")]),
    );

    const readiness = await computeConnectVerifiedReadiness({
      workspaceId: "ws-1",
      userId: "u-1",
      dashboardBase: BASE,
      prefetched: {
        graphStoreReady: true,
        parsedDocumentCount: 0,
        encryptionReady: true,
        llmReady: false,
      },
    });

    expect(readiness.status).toBe("fail");
    const byId = Object.fromEntries(readiness.rows.map((r) => [r.id, r]));
    expect(byId.gateway_key.status).toBe("warn");
    expect(byId.provider_families.status).toBe("warn"); // single family coaching
    expect(byId.stage_routes.status).toBe("fail");
    expect(byId.stage_routes.fixHref).toBe(`${BASE}/projects/proj-1/routes/route-embedding?tab=versions`);
    expect(byId.provider_binding.status).toBe("fail");
    expect(byId.store_documents.status).toBe("warn");
    expect(byId.encryption.status).toBe("ok");
    expect(readiness.ready).toBe(1);
  });

  it("unconfigured workspace never throws — every gap is a status", async () => {
    countKeys.mockResolvedValue(0);
    listIntegrations.mockResolvedValue([] as never);
    resolveCtxMock.mockResolvedValue(null);
    preflightMock.mockResolvedValue(preflight("blocked", []));

    const readiness = await computeConnectVerifiedReadiness({
      workspaceId: "ws-1",
      userId: "u-1",
      dashboardBase: BASE,
      prefetched: {
        graphStoreReady: false,
        parsedDocumentCount: 0,
        encryptionReady: false,
        llmReady: false,
      },
    });

    expect(readiness.ready).toBe(0);
    expect(readiness.status).toBe("fail");
    expect(stageRowsMock).not.toHaveBeenCalled();
    // every regressed row offers a repair
    for (const row of readiness.rows) {
      expect(row.fixHref).toBeTruthy();
      expect(row.fixLabel).toBeTruthy();
    }
  });
});
