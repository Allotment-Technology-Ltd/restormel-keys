import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { getProject, getProjectInWorkspace } from "$lib/server/db";

const INGESTION_WORKLOAD = "ingestion";
const INGESTION_STAGES = [
  "ingestion_extraction",
  "ingestion_relations",
  "ingestion_grouping",
  "ingestion_validation",
  "ingestion_embedding",
  "ingestion_json_repair",
] as const;

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
      workloads: [INGESTION_WORKLOAD],
      stages: [...INGESTION_STAGES],
    },
  });
};

