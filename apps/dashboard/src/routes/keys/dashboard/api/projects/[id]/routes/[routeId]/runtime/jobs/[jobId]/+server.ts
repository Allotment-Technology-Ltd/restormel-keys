/**
 * GET …/runtime/jobs/{jobId} — fetch hosted runtime job status and result summary.
 */
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import {
  getHostedRuntimeJobForProject,
  getProject,
  getProjectInWorkspace,
  setHostedRuntimeJobCancelRequested,
} from "$lib/server/db";
import { jobRecordToPublicPayload } from "$lib/server/hosted-runtime-jobs";

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

export const GET: RequestHandler = async ({ params, locals }) => {
  try {
    const scope = await projectScope(locals, params.id);
    if (!scope) {
      return json(
        { error: "unauthorized", message: "Unauthorized or project not found" },
        { status: 401 }
      );
    }

    const row = await getHostedRuntimeJobForProject(params.jobId, scope.projectId, scope.userId);
    if (!row) {
      return json({ error: "job_not_found" }, { status: 404 });
    }

    return json({ data: jobRecordToPublicPayload(row) });
  } catch (e) {
    console.error("[runtime/jobs/jobId] internal error:", e);
    return json({ error: "internal_error", detail: "runtime_job_get_failed" }, { status: 500 });
  }
};

export const DELETE: RequestHandler = async ({ params, locals }) => {
  try {
    const scope = await projectScope(locals, params.id);
    if (!scope) {
      return json(
        { error: "unauthorized", message: "Unauthorized or project not found" },
        { status: 401 }
      );
    }

    const ok = await setHostedRuntimeJobCancelRequested(params.jobId, scope.projectId, scope.userId);
    if (!ok) {
      return json({ error: "job_not_found_or_not_cancellable" }, { status: 404 });
    }

    return new Response(null, { status: 204 });
  } catch (e) {
    console.error("[runtime/jobs/jobId] cancel error:", e);
    return json({ error: "internal_error", detail: "runtime_job_cancel_failed" }, { status: 500 });
  }
};
