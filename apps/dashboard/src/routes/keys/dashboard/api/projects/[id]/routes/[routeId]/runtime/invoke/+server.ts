/**
 * POST …/runtime/invoke — hosted runtime: graph-linear pipeline (Phase 2) with OpenAI-compatible upstream.
 * Auth: Gateway key or session; same project scoping as resolve.
 */
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import {
  getProject,
  getProjectInWorkspace,
  getOrCreateDefaultWorkspace,
  insertRequestLog,
  aggregateRequestLogsToUsage,
} from "$lib/server/db";
import {
  buildRuntimeInvokeSuccessData,
  RUNTIME_INVOKE_CONTRACT_VERSION,
} from "$lib/server/resolve-response";
import { getWorkspaceEntitlements } from "$lib/server/entitlements";
import { runRuntimeInvokePipeline } from "$lib/server/runtime-invoke-chain";
import { parseChatMessages } from "$lib/server/runtime-invoke";
import { MVP_MODULE_DEFAULTS } from "$lib/module-flags-types";
import { getProjectDefaultEnvironmentId } from "$lib/server/db";

function monthStartMs(now: number): number {
  const d = new Date(now);
  d.setUTCDate(1);
  d.setUTCHours(0, 0, 0, 0);
  return d.getTime();
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
  return project ? { projectId, userId: project.userId } : null;
}

export const POST: RequestHandler = async ({ params, request, locals }) => {
  try {
    const flags = locals.moduleFlags ?? MVP_MODULE_DEFAULTS;
    if (!flags.hostedRuntime) {
      return json(
        { error: "module_disabled", module: "hostedRuntime", message: "Hosted runtime is not enabled on this deployment" },
        { status: 501 }
      );
    }

    const scope = await projectScope(locals, params.id);
    if (!scope) {
      return json(
        { error: "unauthorized", message: "Unauthorized or project not found" },
        { status: 401 }
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return json({ error: "invalid_json" }, { status: 400 });
    }

    const bodyObj =
      body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : null;
    let envId =
      bodyObj && typeof bodyObj.environmentId === "string" ? bodyObj.environmentId.trim() : "";
    if (!envId && !flags.environments) {
      envId = (await getProjectDefaultEnvironmentId(scope.projectId, scope.userId)) ?? "";
    }
    if (!envId) {
      return json({ error: "environmentId_required" }, { status: 400 });
    }

    const parsed = parseChatMessages(body);
    if (!parsed.ok) {
      return json({ error: parsed.error }, { status: 400 });
    }

    try {
      const ent = await getWorkspaceEntitlements(locals);
      if (ent && ent.plan === "free") {
        const now = Date.now();
        const usage = await aggregateRequestLogsToUsage(ent.workspaceId, { since: monthStartMs(now), until: now });
        const used = usage.reduce((acc, r) => acc + (r.requestCount ?? 0), 0);
        if (used >= ent.monthlyRequestLimit) {
          await insertRequestLog({
            workspaceId: ent.workspaceId,
            projectId: scope.projectId,
            environmentId: envId,
            providerType: "none",
            requestStatus: "usage_limit_reached",
            latencyMs: 0,
            gatewayKeyId: locals.user?.authType === "gateway_key" ? locals.user.keyId ?? null : null,
            metadata: { limit: ent.monthlyRequestLimit, used, runtime: true },
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
      console.error("[runtime/invoke] usage limit check failed:", e);
    }

    const start = Date.now();
    const gatewayKeyId = locals.user?.authType === "gateway_key" ? locals.user.keyId ?? null : null;

    const pipeline = await runRuntimeInvokePipeline({
      projectId: scope.projectId,
      environmentId: envId,
      userId: scope.userId,
      routeId: params.routeId,
      initialMessages: parsed.messages,
      startedAt: start,
    });

    if (!pipeline.ok) {
      const p = pipeline;
      try {
        const project = await getProject(scope.projectId, scope.userId);
        const workspaceId =
          project?.workspaceId ?? (await getOrCreateDefaultWorkspace(scope.userId)).id;
        await insertRequestLog({
          workspaceId,
          projectId: scope.projectId,
          environmentId: envId,
          routeId: p.routeId ?? null,
          providerType: "none",
          requestStatus: p.error,
          latencyMs: Date.now() - start,
          gatewayKeyId,
          errorCode: p.code ?? null,
          metadata: {
            explanation: p.message ?? p.error,
            runtime: true,
            runtimeContractVersion: RUNTIME_INVOKE_CONTRACT_VERSION,
          },
        });
      } catch (e) {
        console.error("[runtime/invoke] insertRequestLog pipeline failure:", e);
      }
      return json(
        {
          error: p.error,
          message: p.message ?? p.error,
          ...(p.routeId ? { routeId: p.routeId } : {}),
          ...(p.code ? { code: p.code } : {}),
          ...(p.providerType ? { providerType: p.providerType } : {}),
        },
        { status: p.httpStatus }
      );
    }

    const resolved = pipeline.resolvedForContract;
    const latencyMs = Date.now() - start;

    try {
      await insertRequestLog({
        workspaceId: resolved.workspaceId,
        projectId: resolved.projectId,
        environmentId: resolved.environmentId,
        routeId: resolved.route.id,
        gatewayKeyId,
        providerType: resolved.providerType ?? "none",
        finalModelId: resolved.modelId,
        requestStatus: "runtime_invoke_ok",
        latencyMs,
        inputTokens: pipeline.aggregatedUsage.promptTokens ?? null,
        outputTokens: pipeline.aggregatedUsage.completionTokens ?? null,
        estimatedCost: pipeline.estimatedCostUsdTotal,
        metadata: {
          runtime: true,
          pipeline: true,
          routeStepId: resolved.selectedStepId ?? null,
          runtimeSteps: pipeline.runtimeSteps,
          runtimeContractVersion: RUNTIME_INVOKE_CONTRACT_VERSION,
        },
      });
    } catch (e) {
      console.error("[runtime/invoke] insertRequestLog success:", e);
    }

    const traceId =
      bodyObj && typeof bodyObj.traceId === "string" ? bodyObj.traceId.trim() || null : null;

    const data = buildRuntimeInvokeSuccessData({
      resolved,
      traceId,
      estimatedCostUsd: pipeline.estimatedCostUsdTotal,
      content: pipeline.finalContent,
      usage: {
        promptTokens: pipeline.aggregatedUsage.promptTokens ?? null,
        completionTokens: pipeline.aggregatedUsage.completionTokens ?? null,
        totalTokens: pipeline.aggregatedUsage.totalTokens ?? null,
      },
      runtimeSteps: pipeline.runtimeSteps.map((r) => ({
        routeStepId: r.routeStepId,
        orderIndex: r.orderIndex,
        providerType: r.providerType,
        modelId: r.modelId,
        promptTokens: r.promptTokens,
        completionTokens: r.completionTokens,
        totalTokens: r.totalTokens,
        ...(r.skipped ? { skipped: true, skipReason: r.skipReason } : {}),
      })),
    });

    return json({ data });
  } catch (e) {
    console.error("[runtime/invoke] internal error:", e);
    return json({ error: "internal_error", detail: "runtime_invoke_failed" }, { status: 500 });
  }
};
