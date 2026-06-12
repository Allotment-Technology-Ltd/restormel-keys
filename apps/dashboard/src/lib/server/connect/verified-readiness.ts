/**
 * Connect verified-context readiness (Stage K4, review §3 coherence thesis).
 *
 * Composes checks that all already exist server-side into ONE "Ready to verify"
 * ledger — gateway key · decryptable provider families (≥2 ⇒ cross-model ✓) ·
 * stage routes published+enabled · provider→project binding with executable keys
 * (K3's computeConnectRunPreflight, REQUIRED dependency — same checks, no drift) ·
 * credential encryption · graph store & documents.
 *
 * Consumed by:
 *  - the Connect hub "Ready to verify" ledger panel (ConnectVerifiedReadiness.svelte)
 *  - the hub journey's ai_keys step detail (same summary, no second model)
 *  - the Overview checklist's Connect summary chip
 */
import { DASHBOARD_BASE } from "$lib/dashboard-base";
import {
  overallReadinessStatus,
  type ConnectReadinessRow,
  type ConnectVerifiedReadiness,
} from "$lib/connect/verified-readiness";
import {
  failingPreflightRows,
  preflightIssueCopy,
  type ConnectRunPreflightResult,
} from "$lib/connect/run-preflight";
import { countApiKeysByWorkspace, listProviderIntegrations } from "$lib/server/db";
import type { ProviderIntegrationRecord } from "$lib/server/neon";
import { normalizeProviderToCanonicalApi } from "$lib/server/canonical-provider";
import { isCredentialEncryptionConfigured } from "$lib/server/credential-crypto";
import { isLlmConfigured } from "$lib/server/connect/llm-generate";
import { computeConnectRunPreflight } from "$lib/server/connect/run-preflight";
import { getGraphTargetForUi } from "$lib/server/connect/graph-target-service";
import { listSourceDocuments } from "$lib/server/connect/source-documents";
import {
  evaluateConnectModelsReady,
  listConnectStageRouteRows,
  resolveKnowledgeRouteExecutionContext,
  type StageRouteUiRow,
} from "$lib/server/connect/stage-routing";

/** A stage route that exists but is unpublished — the K-P0-3 repair target. */
export type DraftStageRoute = { stage: string; routeId: string; name: string };

/**
 * Everything the pure row builder needs — gathered by computeConnectVerifiedReadiness,
 * mocked directly by the matrix tests.
 */
export type VerifiedReadinessSignals = {
  gatewayKeyCount: number;
  /** Canonical provider families with a decryptable hosted credential, deduped + sorted. */
  decryptableFamilies: string[];
  llmReady: boolean;
  hasProjectRouting: boolean;
  hasChatRoute: boolean;
  hasEmbeddingRoute: boolean;
  draftStageRoutes: DraftStageRoute[];
  /** Routing project the stage routes execute against (null when unconfigured). */
  routingProjectId: string | null;
  /** K3 launch preflight result; null when it could not be computed. */
  preflight: ConnectRunPreflightResult | null;
  encryptionReady: boolean;
  graphStoreReady: boolean;
  parsedDocumentCount: number;
};

/** Decryptable canonical provider families from workspace integrations. */
export function decryptableProviderFamilies(
  integrations: Pick<
    ProviderIntegrationRecord,
    "providerType" | "status" | "hasEncryptedCredential"
  >[],
): string[] {
  const families = new Set<string>();
  for (const integration of integrations) {
    if (integration.status !== "active") continue;
    if (integration.hasEncryptedCredential !== true) continue;
    const canonical = normalizeProviderToCanonicalApi(integration.providerType);
    if (canonical) families.add(canonical);
  }
  return [...families].sort();
}

function gatewayKeyRow(signals: VerifiedReadinessSignals, base: string): ConnectReadinessRow {
  if (signals.gatewayKeyCount > 0) {
    return {
      id: "gateway_key",
      label: "Gateway key",
      status: "ok",
      evidence: `${signals.gatewayKeyCount} gateway key${signals.gatewayKeyCount === 1 ? "" : "s"} active — agents can call retrieve and MCP`,
      fixHref: null,
      fixLabel: null,
    };
  }
  return {
    id: "gateway_key",
    label: "Gateway key",
    status: "warn",
    evidence: "No gateway key — agents can't query your verified context yet",
    fixHref: `${base}/access`,
    fixLabel: "Create a Gateway key",
  };
}

function providerFamiliesRow(
  signals: VerifiedReadinessSignals,
  base: string,
): ConnectReadinessRow {
  const families = signals.decryptableFamilies;
  const connectionsHref = `${base}/integrations`;
  if (families.length >= 2) {
    return {
      id: "provider_families",
      label: "Provider families",
      status: "ok",
      evidence: `${families.length} families: ${families.join(", ")} — cross-model validation on`,
      fixHref: null,
      fixLabel: null,
    };
  }
  if (families.length === 1) {
    // K-P1-7 coaching line: the differentiator made visible as a state.
    return {
      id: "provider_families",
      label: "Provider families",
      status: "warn",
      evidence: `1 family: ${families[0]} — validation will be same-family; add a second provider family to enable cross-model validation`,
      fixHref: connectionsHref,
      fixLabel: "Add a second family",
    };
  }
  if (signals.llmReady) {
    return {
      id: "provider_families",
      label: "Provider families",
      status: "warn",
      evidence: "No decryptable workspace provider keys — runs fall back to the legacy environment key",
      fixHref: connectionsHref,
      fixLabel: "Connect a provider",
    };
  }
  return {
    id: "provider_families",
    label: "Provider families",
    status: "fail",
    evidence: "No executable provider keys — ingest stages can't call any model",
    fixHref: connectionsHref,
    fixLabel: "Connect a provider",
  };
}

function stageRoutesRow(signals: VerifiedReadinessSignals, base: string): ConnectReadinessRow {
  const modelsHref = `${base}/connect/models`;
  if (!signals.hasProjectRouting) {
    if (signals.llmReady) {
      return {
        id: "stage_routes",
        label: "Stage routes",
        status: "warn",
        evidence: "No stage routing configured — ingest uses the legacy environment key",
        fixHref: modelsHref,
        fixLabel: "Configure routes",
      };
    }
    return {
      id: "stage_routes",
      label: "Stage routes",
      status: "fail",
      evidence: "No ingestion stage routes configured",
      fixHref: modelsHref,
      fixLabel: "Configure routes",
    };
  }
  if (signals.hasChatRoute && signals.hasEmbeddingRoute) {
    return {
      id: "stage_routes",
      label: "Stage routes",
      status: "ok",
      evidence: "Chat and embedding ingestion routes published and enabled",
      fixHref: null,
      fixLabel: null,
    };
  }
  const missing = [
    !signals.hasChatRoute ? "chat" : null,
    !signals.hasEmbeddingRoute ? "embedding" : null,
  ]
    .filter((s): s is string => s !== null)
    .join(" + ");
  const draft = signals.draftStageRoutes[0];
  if (draft && signals.routingProjectId) {
    // K-P0-3 closure (W1.5 follow-up): "Draft — publish to use" links to the
    // builder's Versions tab instead of dead-ending.
    return {
      id: "stage_routes",
      label: "Stage routes",
      status: "fail",
      evidence: `Missing a published ${missing} route — "${draft.name}" (${draft.stage}) is a draft; publish to use`,
      fixHref: `${base}/projects/${signals.routingProjectId}/routes/${draft.routeId}?tab=versions`,
      fixLabel: "Publish route",
    };
  }
  return {
    id: "stage_routes",
    label: "Stage routes",
    status: "fail",
    evidence: `Missing a published ${missing} route`,
    fixHref: modelsHref,
    fixLabel: "Open Models",
  };
}

function providerBindingRow(
  signals: VerifiedReadinessSignals,
  base: string,
): ConnectReadinessRow {
  const preflight = signals.preflight;
  if (!preflight) {
    return {
      id: "provider_binding",
      label: "Provider binding",
      status: "warn",
      evidence: "Run preflight could not be checked — re-check from the pipeline launch step",
      fixHref: `${base}/connect/pipeline?step=launch`,
      fixLabel: "Open launch step",
    };
  }
  if (preflight.status === "pass") {
    const providers = preflight.providers.map((p) => p.provider);
    return {
      id: "provider_binding",
      label: "Provider binding",
      status: "ok",
      evidence:
        providers.length > 0
          ? `${providers.join(", ")} bound to the routing project with executable keys`
          : "All resolved providers have executable project bindings",
      fixHref: null,
      fixLabel: null,
    };
  }
  if (preflight.status === "legacy_env") {
    return {
      id: "provider_binding",
      label: "Provider binding",
      status: "warn",
      evidence: "No published stage routes — runs would use the legacy environment key",
      fixHref: `${base}/connect/models`,
      fixLabel: "Configure routes",
    };
  }
  const failing = failingPreflightRows(preflight);
  if (failing.length === 0) {
    // blocked with zero provider rows: no stage routes and no legacy key.
    return {
      id: "provider_binding",
      label: "Provider binding",
      status: "fail",
      evidence: "No published Connect stage routes and no legacy environment key — runs cannot execute",
      fixHref: `${base}/connect/models`,
      fixLabel: "Configure routes",
    };
  }
  const first = failing[0];
  const prefix = failing.length > 1 ? `${failing.length} providers blocked — ` : "";
  return {
    id: "provider_binding",
    label: "Provider binding",
    status: "fail",
    evidence: `${prefix}${preflightIssueCopy(first)}`,
    fixHref: first.fixHref,
    fixLabel: first.fixLabel,
  };
}

function encryptionRow(signals: VerifiedReadinessSignals, base: string): ConnectReadinessRow {
  if (signals.encryptionReady) {
    return {
      id: "encryption",
      label: "Encryption",
      status: "ok",
      evidence: "Credential encryption configured — stored provider keys are executable",
      fixHref: null,
      fixLabel: null,
    };
  }
  return {
    id: "encryption",
    label: "Encryption",
    status: "fail",
    evidence:
      "Credential encryption key missing or invalid — provider keys can't be saved or decrypted",
    fixHref: `${base}/integrations`,
    fixLabel: "Open Connections",
  };
}

function storeDocumentsRow(
  signals: VerifiedReadinessSignals,
  base: string,
): ConnectReadinessRow {
  if (!signals.graphStoreReady) {
    return {
      id: "store_documents",
      label: "Store & documents",
      status: "fail",
      evidence: "No graph store connected — extracted ideas have nowhere to live",
      fixHref: `${base}/connect/pipeline?step=store`,
      fixLabel: "Connect store",
    };
  }
  if (signals.parsedDocumentCount === 0) {
    return {
      id: "store_documents",
      label: "Store & documents",
      status: "warn",
      evidence: "Graph store connected — no parsed documents yet",
      fixHref: `${base}/connect/pipeline?step=sources`,
      fixLabel: "Add documents",
    };
  }
  return {
    id: "store_documents",
    label: "Store & documents",
    status: "ok",
    evidence: `Graph store connected · ${signals.parsedDocumentCount} parsed document${signals.parsedDocumentCount === 1 ? "" : "s"}`,
    fixHref: null,
    fixLabel: null,
  };
}

/**
 * Pure ledger builder — §3's row list, in display order. Exported for the
 * matrix tests (all-green / each-single-gap / multi-gap / fix-link routing).
 */
export function buildVerifiedReadinessRows(
  signals: VerifiedReadinessSignals,
  dashboardBase: string = DASHBOARD_BASE,
): ConnectReadinessRow[] {
  return [
    gatewayKeyRow(signals, dashboardBase),
    providerFamiliesRow(signals, dashboardBase),
    stageRoutesRow(signals, dashboardBase),
    providerBindingRow(signals, dashboardBase),
    encryptionRow(signals, dashboardBase),
    storeDocumentsRow(signals, dashboardBase),
  ];
}

function summarize(
  rows: ConnectReadinessRow[],
  models: ConnectVerifiedReadiness["models"],
): ConnectVerifiedReadiness {
  return {
    rows,
    ready: rows.filter((r) => r.status === "ok").length,
    total: rows.length,
    status: overallReadinessStatus(rows),
    checkedAt: new Date().toISOString(),
    models,
  };
}

/** Inputs the caller may already hold (hub load) — avoids duplicate queries. */
export type VerifiedReadinessPrefetched = {
  integrations?: ProviderIntegrationRecord[];
  graphStoreReady?: boolean;
  parsedDocumentCount?: number;
  encryptionReady?: boolean;
  llmReady?: boolean;
};

/**
 * Compute the full readiness ledger for a workspace. Never throws for
 * "setup missing" shapes — those are row statuses, not errors.
 */
export async function computeConnectVerifiedReadiness(args: {
  workspaceId: string;
  userId: string;
  dashboardBase?: string;
  prefetched?: VerifiedReadinessPrefetched;
}): Promise<ConnectVerifiedReadiness> {
  const base = args.dashboardBase ?? DASHBOARD_BASE;
  const pre = args.prefetched ?? {};
  const llmReady = pre.llmReady ?? isLlmConfigured();
  const encryptionReady = pre.encryptionReady ?? isCredentialEncryptionConfigured();

  const [gatewayKeyCount, integrations, graphStoreReady, parsedDocumentCount, ctx, preflight] =
    await Promise.all([
      countApiKeysByWorkspace(args.workspaceId).catch(() => 0),
      pre.integrations !== undefined
        ? Promise.resolve(pre.integrations)
        : listProviderIntegrations(args.workspaceId).catch(() => []),
      pre.graphStoreReady !== undefined
        ? Promise.resolve(pre.graphStoreReady)
        : getGraphTargetForUi(args.workspaceId)
            .then((target) => Boolean(target && target.status === "ok"))
            .catch(() => false),
      pre.parsedDocumentCount !== undefined
        ? Promise.resolve(pre.parsedDocumentCount)
        : listSourceDocuments(args.workspaceId)
            .then((docs) => docs.filter((d) => d.status === "parsed").length)
            .catch(() => 0),
      resolveKnowledgeRouteExecutionContext({
        workspaceId: args.workspaceId,
        userId: args.userId,
      }).catch(() => null),
      // K3's preflight is the binding/credential source of truth — same checks, no drift.
      computeConnectRunPreflight({
        workspaceId: args.workspaceId,
        userId: args.userId,
        dashboardBase: base,
      }).catch(() => null),
    ]);

  let stageRows: StageRouteUiRow[] = [];
  if (ctx) {
    stageRows = await listConnectStageRouteRows({
      workspaceId: args.workspaceId,
      userId: args.userId,
      projectId: ctx.projectId,
      environmentId: ctx.environmentId,
      dashboardBase: base,
    }).catch(() => []);
  }

  const models = evaluateConnectModelsReady({
    stageRows,
    integrationsCount: integrations.length,
    llmReady,
    hasProjectRouting: Boolean(ctx),
  });

  const draftStageRoutes: DraftStageRoute[] = stageRows
    .filter((row) => row.route && !row.route.isPublished)
    .map((row) => ({
      stage: row.key,
      routeId: row.route!.id,
      name: row.route!.name,
    }));

  const rows = buildVerifiedReadinessRows(
    {
      gatewayKeyCount,
      decryptableFamilies: decryptableProviderFamilies(integrations),
      llmReady,
      hasProjectRouting: Boolean(ctx),
      hasChatRoute: models.hasChatRoute,
      hasEmbeddingRoute: models.hasEmbeddingRoute,
      draftStageRoutes,
      routingProjectId: ctx?.projectId ?? null,
      preflight,
      encryptionReady,
      graphStoreReady,
      parsedDocumentCount,
    },
    base,
  );

  return summarize(rows, models);
}
