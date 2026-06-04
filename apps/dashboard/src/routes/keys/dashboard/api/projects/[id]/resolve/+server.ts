/**
 * Request execution: resolve route for project + environment, then log.
 * Flow: Gateway Key auth (or session) → project/environment context → route resolution → provider/model → request log.
 * Caller can use the returned provider/model to forward to a proxy or use downstream.
 */
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import {
  getProject,
  getProjectInWorkspace,
  getOrCreateDefaultWorkspace,
  getProjectDefaultEnvironmentId,
  insertRequestLog,
  aggregateRequestLogsToUsage,
} from "$lib/server/db";
import { resolveRouteForExecution } from "$lib/server/route-resolver";
import { canonicalApiToPolicyProvider } from "$lib/server/canonical-provider";
import { buildResolveSuccessData } from "$lib/server/resolve-response";
import { getWorkspaceEntitlements } from "$lib/server/entitlements";
import { defaultProviders, estimateCost, type ProviderDefinition } from "@restormel/keys";
import { MVP_MODULE_DEFAULTS } from "$lib/module-flags-types";

function monthStartMs(now: number): number {
  const d = new Date(now);
  d.setUTCDate(1);
  d.setUTCHours(0, 0, 0, 0);
  return d.getTime();
}

function estimateResolvedCostUsd(args: {
  modelId: string | null;
  providerType: string | null;
  estimatedInputTokens?: number;
}): number | null {
  if (!args.modelId || !args.estimatedInputTokens || args.estimatedInputTokens <= 0) return null;
  const forCost = canonicalApiToPolicyProvider(args.providerType ?? undefined) ?? args.providerType;
  const providers: ProviderDefinition[] = forCost
    ? defaultProviders.filter((p) => p.id === forCost)
    : defaultProviders;
  const est = estimateCost(args.modelId, providers);
  if (!est) return null;
  const million = args.estimatedInputTokens / 1_000_000;
  return million * ((est.inputPerMillion ?? 0) + (est.outputPerMillion ?? 0));
}

async function projectScope(
  locals: App.Locals,
  projectId: string
): Promise<{ projectId: string; userId: string } | null> {
  if (!locals.user) return null;
  if (locals.user.authType === "gateway_key") {
    if (locals.user.projectIdForKey !== projectId) return null;
    return { projectId, userId: locals.user.uid };
  }
  if (locals.user.authType === "management_key" && locals.user.workspaceId) {
    const project = await getProjectInWorkspace(projectId, locals.user.workspaceId);
    return project ? { projectId, userId: project.userId } : null;
  }
  const project = await getProject(projectId, locals.user.uid);
  return project ? { projectId, userId: locals.user.uid } : null;
}

export const POST: RequestHandler = async ({ params, request, locals }) => {
  try {
    const scope = await projectScope(locals, params.id);
    if (!scope) {
      return json(
        { error: "unauthorized", message: "Unauthorized or project not found" },
        { status: 401 }
      );
    }

    let body: {
      environmentId?: string;
      routeId?: string;
      stage?: string;
      workload?: string;
      task?: string;
      attemptNumber?: number;
      failureKind?: string;
      estimatedInputTokens?: number;
      estimatedInputChars?: number;
      complexity?: string;
      traceId?: string;
      constraints?: { maxCost?: number; latency?: string };
      previousFailure?: { selectedOrderIndex?: number; selectedStepId?: string };
    };
    try {
      body = (await request.json()) as typeof body;
    } catch {
      return json({ error: "Invalid JSON" }, { status: 400 });
    }
    const environmentIdRaw = typeof body.environmentId === "string" ? body.environmentId.trim() : "";
    const flags = locals.moduleFlags ?? MVP_MODULE_DEFAULTS;
    let environmentId = environmentIdRaw;
    if (!environmentId) {
      if (flags.environments) {
        return json({ error: "environmentId is required" }, { status: 400 });
      }
      const defaultEnvId = await getProjectDefaultEnvironmentId(scope.projectId, scope.userId);
      if (!defaultEnvId) {
        return json(
          { error: "no_environment", message: "Project has no default environment configured" },
          { status: 422 }
        );
      }
      environmentId = defaultEnvId;
    }

    // Enforce monthly request limits for Free tier.
    try {
      const ent = await getWorkspaceEntitlements(locals);
      if (ent && ent.plan === "free") {
        const now = Date.now();
        const since = monthStartMs(now);
        const until = now;
        const usage = await aggregateRequestLogsToUsage(ent.workspaceId, { since, until });
        const used = usage.reduce((acc, r) => acc + (r.requestCount ?? 0), 0);
        if (used >= ent.monthlyRequestLimit) {
          await insertRequestLog({
            workspaceId: ent.workspaceId,
            projectId: scope.projectId,
            environmentId,
            providerType: "none",
            requestStatus: "usage_limit_reached",
            latencyMs: 0,
            gatewayKeyId: locals.user?.authType === "gateway_key" ? locals.user.keyId ?? null : null,
            metadata: { limit: ent.monthlyRequestLimit, used },
          });
          return json(
            {
              error: "usage_limit_reached",
              detail: "You’ve reached your free usage limit. Upgrade to continue running your app.",
              data: { limit: ent.monthlyRequestLimit, used },
            },
            { status: 402 }
          );
        }
      }
    } catch (e) {
      console.error("[resolve] usage limit check failed:", e);
    }

    const start = Date.now();
    const attemptNumber =
      typeof body.attemptNumber === "number" && Number.isInteger(body.attemptNumber) && body.attemptNumber >= 0
        ? body.attemptNumber
        : undefined;
    const previousFailure =
      body.previousFailure && typeof body.previousFailure === "object"
        ? {
            selectedOrderIndex:
              typeof body.previousFailure.selectedOrderIndex === "number" &&
              Number.isInteger(body.previousFailure.selectedOrderIndex)
                ? body.previousFailure.selectedOrderIndex
                : undefined,
            selectedStepId:
              typeof body.previousFailure.selectedStepId === "string"
                ? body.previousFailure.selectedStepId.trim() || undefined
                : undefined,
          }
        : undefined;

    const outcome = await resolveRouteForExecution(scope.projectId, environmentId, scope.userId, {
      routeId: typeof body.routeId === "string" ? body.routeId.trim() : undefined,
      stage: typeof body.stage === "string" ? body.stage.trim() : undefined,
      workload: typeof body.workload === "string" ? body.workload.trim() : undefined,
      task: typeof body.task === "string" ? body.task.trim() : undefined,
      attemptNumber,
      previousFailure,
      failureKind: typeof body.failureKind === "string" ? body.failureKind.trim() : undefined,
    });
    const latencyMs = Date.now() - start;

    const gatewayKeyId = locals.user?.authType === "gateway_key" ? locals.user.keyId ?? null : null;

    if (!outcome.ok) {
      const { failure } = outcome;
      const status =
        failure.code === "route_unpublished"
          ? 409
          : failure.code === "route_disabled"
            ? 403
            : failure.code === "no_key_available" || failure.code === "resolve_incomplete"
              ? 422
              : 404;
      try {
        const project = await getProject(scope.projectId, scope.userId);
        const workspaceId =
          project?.workspaceId ?? (await getOrCreateDefaultWorkspace(scope.userId)).id;
        await insertRequestLog({
          workspaceId,
          projectId: scope.projectId,
          environmentId,
          routeId: failure.routeId,
          providerType: "none",
          requestStatus: failure.code,
          latencyMs,
          gatewayKeyId,
          metadata: { explanation: failure.message ?? failure.code },
        });
      } catch (e) {
        console.error("[resolve] insertRequestLog failure:", e);
      }
      return json(
        {
          error: failure.code,
          message: failure.message ?? failure.code,
          ...(failure.code === "resolve_incomplete"
            ? {
                userMessage:
                  "This route step is missing a provider or model. Set provider and model on the step (or a route default model) in the dashboard.",
              }
            : {}),
          ...(failure.routeId ? { routeId: failure.routeId } : {}),
        },
        { status }
      );
    }

    const resolved = outcome.result;

    if (resolved.policyViolations && resolved.policyViolations.length > 0) {
      try {
        await insertRequestLog({
          workspaceId: resolved.workspaceId,
          projectId: resolved.projectId,
          environmentId: resolved.environmentId,
          routeId: resolved.route.id,
          gatewayKeyId,
          providerType: "none",
          requestStatus: "policy_blocked",
          latencyMs,
          metadata: { explanation: resolved.explanation, violations: resolved.policyViolations },
        });
      } catch (e) {
        console.error("[resolve] insertRequestLog policy_blocked:", e);
      }
      return json(
        {
          error: "policy_blocked",
          message: "All route steps were blocked by policy",
          violations: resolved.policyViolations,
        },
        { status: 403 }
      );
    }

    try {
      await insertRequestLog({
        workspaceId: resolved.workspaceId,
        projectId: resolved.projectId,
        environmentId: resolved.environmentId,
        routeId: resolved.route.id,
        gatewayKeyId,
        providerType: resolved.providerType ?? "none",
        finalModelId: resolved.modelId,
        requestStatus: "resolved",
        latencyMs,
        metadata: { explanation: resolved.explanation },
      });
    } catch (e) {
      console.error("[resolve] insertRequestLog resolved:", e);
    }

    const estimatedCostUsd = estimateResolvedCostUsd({
      modelId: resolved.modelId,
      providerType: resolved.providerType,
      estimatedInputTokens:
        typeof body.estimatedInputTokens === "number" && Number.isFinite(body.estimatedInputTokens)
          ? body.estimatedInputTokens
          : undefined,
    });

    const data = buildResolveSuccessData({
      resolved,
      traceId: typeof body.traceId === "string" ? body.traceId : null,
      estimatedCostUsd,
    });

    return json({ data });
  } catch (e) {
    console.error("[resolve] internal error:", e);
    return json({ error: "internal_error", detail: "resolve_failed" }, { status: 500 });
  }
};
