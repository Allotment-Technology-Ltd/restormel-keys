import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { getProject, getProjectInWorkspace } from "$lib/server/db";

const ON_FAILURE_KINDS = [
  "timeout",
  "rate_limit",
  "provider_unhealthy",
  "auth_error",
  "quota_exceeded",
  "policy_blocked",
  "unknown_error",
] as const;

const COMPLEXITY = ["low", "medium", "high"] as const;
const LATENCY_CLASS = ["low", "balanced", "high"] as const;

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

export const GET: RequestHandler = async ({ params, locals }) => {
  const scope = await projectScope(locals, params.id);
  if (!locals.user) return json({ error: "Unauthorized" }, { status: 401 });
  if (!scope) return json({ error: "Not found" }, { status: 404 });

  return json({
    data: {
      onFailureKinds: [...ON_FAILURE_KINDS],
      complexity: [...COMPLEXITY],
      latencyClass: [...LATENCY_CLASS],
    },
  });
};

