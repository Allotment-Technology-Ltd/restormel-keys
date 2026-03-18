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
  insertRequestLog,
  aggregateRequestLogsToUsage,
} from "$lib/server/db";
import { resolveRouteForExecution } from "$lib/server/route-resolver";
import { getWorkspaceEntitlements } from "$lib/server/entitlements";

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
  return project ? { projectId, userId: locals.user.uid } : null;
}

export const POST: RequestHandler = async ({ params, request, locals }) => {
  const scope = await projectScope(locals, params.id);
  if (!scope) {
    return json({ error: "Unauthorized or project not found" }, { status: 401 });
  }

  let body: { environmentId?: string; routeId?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return json({ error: "Invalid JSON" }, { status: 400 });
  }
  const environmentId = typeof body.environmentId === "string" ? body.environmentId.trim() : "";
  if (!environmentId) {
    return json({ error: "environmentId is required" }, { status: 400 });
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
  const resolved = await resolveRouteForExecution(scope.projectId, environmentId, scope.userId, {
    routeId: typeof body.routeId === "string" ? body.routeId.trim() : undefined,
  });
  const latencyMs = Date.now() - start;

  const gatewayKeyId = locals.user?.authType === "gateway_key" ? locals.user.keyId ?? null : null;

  if (!resolved) {
    try {
      const project = await getProject(scope.projectId, scope.userId);
      const workspaceId =
        project?.workspaceId ?? (await getOrCreateDefaultWorkspace(scope.userId)).id;
      await insertRequestLog({
        workspaceId,
        projectId: scope.projectId,
        environmentId,
        providerType: "none",
        requestStatus: "no_route",
        latencyMs,
        gatewayKeyId,
        metadata: { explanation: "no active route for environment" },
      });
    } catch (e) {
      console.error("[resolve] insertRequestLog no_route:", e);
    }
    return json(
      { error: "no_route", message: "No active route found for this project and environment" },
      { status: 404 }
    );
  }

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

  const outProviderType =
    resolved.providerType === "google" ? "vertex" : resolved.providerType ?? undefined;

  return json({
    data: {
      routeId: resolved.route.name,
      providerType: outProviderType,
      modelId: resolved.modelId,
      explanation: resolved.explanation,
    },
  });
};
