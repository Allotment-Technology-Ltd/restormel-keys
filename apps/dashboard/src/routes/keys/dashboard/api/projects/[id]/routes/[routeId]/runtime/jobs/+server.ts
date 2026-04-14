/**
 * POST …/runtime/jobs — create a hosted runtime job (persisted pipeline; optional async queue).
 */
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { getProject, getProjectInWorkspace } from "$lib/server/db";
import { createAndRunHostedRuntimeJob } from "$lib/server/hosted-runtime-jobs";
import { scheduleHostedRuntimeWorkerDrain } from "$lib/server/hosted-runtime-worker";
import { parseChatMessages } from "$lib/server/runtime-invoke";
import type { ParallelMergeStrategy } from "$lib/server/runtime-invoke-chain";
import { randomUUID } from "node:crypto";

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
    const envId =
      bodyObj && typeof bodyObj.environmentId === "string" ? bodyObj.environmentId.trim() : "";
    if (!envId) {
      return json({ error: "environmentId_required" }, { status: 400 });
    }

    const parsed = parseChatMessages(body);
    if (!parsed.ok) {
      return json({ error: parsed.error }, { status: 400 });
    }

    const headerKey = request.headers.get("Idempotency-Key")?.trim() ?? "";
    const bodyKey =
      bodyObj && typeof bodyObj.idempotencyKey === "string" ? bodyObj.idempotencyKey.trim() : "";
    const idempotencyKey = headerKey.length > 0 ? headerKey : bodyKey.length > 0 ? bodyKey : null;

    const wantAsync = bodyObj?.async === true;
    const mergeRaw = bodyObj?.mergeStrategy;
    const mergeStrategy: ParallelMergeStrategy | undefined =
      mergeRaw === "first_wins" || mergeRaw === "all_succeed" ? mergeRaw : undefined;

    const jobId = randomUUID();
    const out = await createAndRunHostedRuntimeJob({
      jobId,
      projectId: scope.projectId,
      userId: scope.userId,
      routeId: params.routeId,
      environmentId: envId,
      messages: parsed.messages,
      async: wantAsync,
      idempotencyKey,
      mergeStrategy,
    });

    if (out.type === "async_accepted") {
      if (out.scheduleWorkerDrain) {
        scheduleHostedRuntimeWorkerDrain();
      }
      return json(
        {
          data: {
            jobId: out.jobId,
            status: out.status,
            async: true,
          },
        },
        { status: 202 }
      );
    }

    if (out.type === "completed") {
      const p = out.payload;
      return json(
        {
          data: {
            jobId: p.jobId,
            status: p.status,
            runtimeContractVersion: p.runtimeContractVersion,
            ...p.data,
          },
        },
        { status: 200 }
      );
    }

    if (out.type === "cancelled") {
      return json({ data: { jobId: out.jobId, status: "cancelled" as const } }, { status: 200 });
    }

    const failed = out.payload;
    return json(
      {
        error: failed.error,
        message: failed.message ?? failed.error,
        jobId: failed.jobId,
        ...(failed.routeId ? { routeId: failed.routeId } : {}),
      },
      { status: failed.httpStatus }
    );
  } catch (e) {
    console.error("[runtime/jobs] internal error:", e);
    return json({ error: "internal_error", detail: "runtime_jobs_failed" }, { status: 500 });
  }
};
