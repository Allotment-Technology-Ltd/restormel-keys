/**
 * Connect run preflight (Stage K3, closing K-P0-2): before an ingest run launches,
 * verify each stage route's resolved provider has a provider_bindings row on the
 * routing project with a decryptable hosted credential — the exact lookup
 * runtime-invoke performs mid-run, surfaced *before* the run instead of 10 minutes in.
 * K2's real verification result is folded in: a key that decrypts but failed its last
 * provider probe blocks too (verification_failed).
 *
 * Consumed by:
 *  - the pipeline wizard launch gate (ConnectPipelineReviewLaunch via +page.server.ts)
 *  - POST api/connect/ingest/jobs and the restart endpoint (server-side enforcement)
 *  - GET api/projects/[id]/readiness (the endpoint K-P0-2 found with zero UI consumers)
 *  - K4's readiness ledger (keep computeConnectRunPreflight reusable/exported)
 */
import { DASHBOARD_BASE } from "$lib/dashboard-base";
import {
  type ConnectRunPreflightIssueCode,
  type ConnectRunPreflightProviderRow,
  type ConnectRunPreflightResult,
} from "$lib/connect/run-preflight";
import { findDecryptedApiKeyForResolvedProvider } from "$lib/server/runtime-invoke";
import { listProviderBindingsByProject, listProviderIntegrations } from "$lib/server/db";
import { normalizeProviderToCanonicalApi } from "$lib/server/canonical-provider";
import { isLlmConfigured } from "$lib/server/connect/llm-generate";
import {
  listConnectStageRouteRows,
  resolveKnowledgeRouteExecutionContext,
  type ConnectModelStage,
} from "$lib/server/connect/stage-routing";

/** Outcome of the runtime credential lookup for one provider. */
export type PreflightCredentialOutcome =
  | "ok"
  | "no_provider"
  | "no_provider_binding"
  | "integration_not_found"
  | "credential_unavailable"
  | "verification_failed";

export type PreflightBindCandidate = { id: string; label: string };

/**
 * Pure row builder — maps a provider's credential-lookup outcome + workspace
 * integration candidates onto the UI/repair contract. Exported for matrix tests.
 */
export function buildPreflightProviderRow(args: {
  provider: string;
  stages: ConnectModelStage[];
  outcome: PreflightCredentialOutcome;
  /** Integration id already bound on the project for this provider (when any). */
  boundIntegrationId: string | null;
  /** Workspace integrations matching this provider with a stored credential. */
  candidates: PreflightBindCandidate[];
  base: string;
}): ConnectRunPreflightProviderRow {
  const { provider, outcome, base } = args;
  const connectionsHref = `${base}/integrations`;

  if (outcome === "ok") {
    return {
      provider,
      stages: args.stages,
      hasBinding: true,
      credentialExecutable: true,
      issue: null,
      bind: null,
      fixHref: connectionsHref,
      fixLabel: "Open Connections",
    };
  }

  // `no_provider` can't happen for rows built from a resolved canonical provider,
  // but keep the mapping total so callers can pass raw runtime codes through.
  const issue: ConnectRunPreflightIssueCode =
    outcome === "no_provider" ? "no_provider_binding" : outcome;

  if (issue === "no_provider_binding") {
    const bind = args.candidates.length === 1 ? { integrationId: args.candidates[0].id, label: args.candidates[0].label } : null;
    return {
      provider,
      stages: args.stages,
      hasBinding: false,
      credentialExecutable: false,
      issue,
      bind,
      fixHref: connectionsHref,
      fixLabel: args.candidates.length === 0 ? `Connect ${provider}` : "Open Connections",
    };
  }

  if (issue === "credential_unavailable") {
    return {
      provider,
      stages: args.stages,
      hasBinding: true,
      credentialExecutable: false,
      issue,
      bind: null,
      fixHref: args.boundIntegrationId
        ? `${base}/integrations/${args.boundIntegrationId}`
        : connectionsHref,
      fixLabel: "Re-enter key",
    };
  }

  if (issue === "verification_failed") {
    // K2: the key decrypts (runtime lookup passes) but the provider rejected it on
    // the last real verification probe. Fix on the integration detail page (Verify).
    return {
      provider,
      stages: args.stages,
      hasBinding: true,
      credentialExecutable: false,
      issue,
      bind: null,
      fixHref: args.boundIntegrationId
        ? `${base}/integrations/${args.boundIntegrationId}`
        : connectionsHref,
      fixLabel: "Re-verify key",
    };
  }

  // integration_not_found: binding points at an integration that no longer exists
  // in this workspace — rebind from Connections.
  return {
    provider,
    stages: args.stages,
    hasBinding: true,
    credentialExecutable: false,
    issue,
    bind: args.candidates.length === 1 ? { integrationId: args.candidates[0].id, label: args.candidates[0].label } : null,
    fixHref: connectionsHref,
    fixLabel: "Open Connections",
  };
}

function result(
  status: ConnectRunPreflightResult["status"],
  rest: Omit<ConnectRunPreflightResult, "status" | "checkedAt">,
): ConnectRunPreflightResult {
  return { status, ...rest, checkedAt: new Date().toISOString() };
}

/**
 * Compute the launch preflight for the workspace's Connect routing project.
 * Never throws for "setup missing" shapes — those are statuses, not errors.
 */
export async function computeConnectRunPreflight(args: {
  workspaceId: string;
  userId: string;
  /** Optional project override (readiness endpoint); defaults to the routing config's project. */
  projectId?: string | null;
  dashboardBase?: string;
}): Promise<ConnectRunPreflightResult> {
  const base = args.dashboardBase ?? DASHBOARD_BASE;

  const ctx = await resolveKnowledgeRouteExecutionContext({
    workspaceId: args.workspaceId,
    userId: args.userId,
    projectId: args.projectId ?? null,
  });

  if (!ctx) {
    // No stage routing configured. Legacy env-key setups still execute via the
    // OPENAI_API_KEY fallback in stage-route-generate — allow with explicit override.
    if (isLlmConfigured()) {
      return result("legacy_env", {
        projectId: null,
        environmentId: null,
        providers: [],
        issues: ["legacy_env_key"],
      });
    }
    return result("blocked", {
      projectId: null,
      environmentId: null,
      providers: [],
      issues: ["no_stage_routes"],
    });
  }

  const stageRows = await listConnectStageRouteRows({
    workspaceId: args.workspaceId,
    userId: args.userId,
    projectId: ctx.projectId,
    environmentId: ctx.environmentId,
    dashboardBase: base,
  });

  const issues: string[] = [];
  const providerStages = new Map<string, ConnectModelStage[]>();
  let publishedRouteCount = 0;

  for (const row of stageRows) {
    if (!row.route?.isPublished || !row.route.enabled) continue;
    publishedRouteCount += 1;
    const canonical = normalizeProviderToCanonicalApi(row.activeModel?.provider);
    if (!canonical) {
      // Route exists but its primary step model/provider didn't resolve at load
      // time (e.g. fallback-only chains). Warning, not a block — the runtime
      // resolver may still pick an executable step; modelsReady gating still applies.
      issues.push(`stage_route_unresolved_model:${row.key}`);
      continue;
    }
    const list = providerStages.get(canonical) ?? [];
    list.push(row.key);
    providerStages.set(canonical, list);
  }

  if (publishedRouteCount === 0) {
    if (isLlmConfigured()) {
      return result("legacy_env", {
        projectId: ctx.projectId,
        environmentId: ctx.environmentId,
        providers: [],
        issues: ["legacy_env_key"],
      });
    }
    return result("blocked", {
      projectId: ctx.projectId,
      environmentId: ctx.environmentId,
      providers: [],
      issues: ["no_stage_routes"],
    });
  }

  const [bindings, integrations] = await Promise.all([
    listProviderBindingsByProject(ctx.projectId).catch(() => []),
    listProviderIntegrations(args.workspaceId).catch(() => []),
  ]);

  const providers: ConnectRunPreflightProviderRow[] = [];
  for (const [provider, stages] of providerStages) {
    // The exact lookup the worker performs mid-run (runtime-invoke.ts): binding on
    // the routing project → secret row → decrypt. Key material is discarded here.
    const outcome = await findDecryptedApiKeyForResolvedProvider({
      projectId: ctx.projectId,
      workspaceId: args.workspaceId,
      resolvedCanonicalProvider: provider,
    });

    const bound =
      bindings.find(
        (b) => normalizeProviderToCanonicalApi(b.integration?.providerType) === provider,
      ) ?? null;
    const candidates: PreflightBindCandidate[] = integrations
      .filter(
        (i) =>
          normalizeProviderToCanonicalApi(i.providerType) === provider &&
          i.hasEncryptedCredential === true &&
          i.status === "active",
      )
      .map((i) => ({ id: i.id, label: i.displayName ?? i.providerType }));

    // K2 layer: decryptable but provider-rejected keys block with a re-verify path.
    const rowOutcome: PreflightCredentialOutcome = outcome.ok
      ? bound?.integration?.verificationStatus === "failed"
        ? "verification_failed"
        : "ok"
      : outcome.code;

    providers.push(
      buildPreflightProviderRow({
        provider,
        stages,
        outcome: rowOutcome,
        boundIntegrationId: bound?.integration?.id ?? null,
        candidates,
        base,
      }),
    );
  }

  for (const row of providers) {
    if (row.issue) issues.push(`${row.issue}:${row.provider}`);
  }

  const blocked = providers.some((r) => r.issue !== null);
  return result(blocked ? "blocked" : "pass", {
    projectId: ctx.projectId,
    environmentId: ctx.environmentId,
    providers,
    issues,
  });
}
