import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { getProjectInWorkspace, listRoutes, createRoute } from "$lib/server/db";

const INGESTION_WORKLOAD = "ingestion";
const INGESTION_STAGES = new Set([
  "ingestion_extraction",
  "ingestion_relations",
  "ingestion_grouping",
  "ingestion_validation",
  "ingestion_embedding",
  "ingestion_json_repair",
]);

async function projectIdAndUid(
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
  return { projectId, userId: locals.user.uid };
}

/** GET: list routes for project. Query: environmentId/workload/stage (optional). */
export const GET: RequestHandler = async ({ params, url, locals }) => {
  try {
    if (!locals.user) return json({ error: "Unauthorized" }, { status: 401 });
    const scope = await projectIdAndUid(locals, params.id);
    if (!scope) return json({ error: "Not found" }, { status: 404 });
    const environmentId = url.searchParams.get("environmentId")?.trim() || undefined;
    const workload = url.searchParams.get("workload")?.trim() || undefined;
    const stage = url.searchParams.get("stage")?.trim() || undefined;
    const data = await listRoutes(scope.projectId, scope.userId, { environmentId, workload, stage });
    return json({ data });
  } catch (e) {
    console.error("[routes.get] internal error:", e);
    return json({ error: "internal_error", detail: "routes_list_failed" }, { status: 500 });
  }
};

/** POST: create route. Body: environmentId, name, description?, defaultModelId?, billingMode?, routeMode?, stage?, workload? */
export const POST: RequestHandler = async ({ params, request, locals }) => {
  try {
    if (!locals.user) return json({ error: "Unauthorized" }, { status: 401 });
    const scope = await projectIdAndUid(locals, params.id);
    if (!scope) return json({ error: "Not found" }, { status: 404 });
    let body: {
      environmentId?: string;
      name?: string;
      description?: string;
      defaultModelId?: string | null;
      billingMode?: string | null;
      routeMode?: string | null;
      stage?: string | null;
      workload?: string | null;
      enabled?: boolean;
      version?: number;
      publishedVersion?: number;
    };
    try {
      body = (await request.json()) as typeof body;
    } catch {
      return json({ error: "Invalid JSON" }, { status: 400 });
    }
    const environmentId = typeof body.environmentId === "string" ? body.environmentId.trim() : "";
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!environmentId || !name) return json({ error: "environmentId and name are required" }, { status: 400 });

    const workload = typeof body.workload === "string" ? body.workload.trim() : null;
    const stage = typeof body.stage === "string" ? body.stage.trim() : null;
    if (stage !== null && workload !== INGESTION_WORKLOAD) {
      return json({ error: "stage is only valid with workload='ingestion'" }, { status: 400 });
    }
    if (workload === INGESTION_WORKLOAD && stage !== null && !INGESTION_STAGES.has(stage)) {
      return json(
        { error: `stage must be one of: ${Array.from(INGESTION_STAGES).join(", ")}` },
        { status: 400 }
      );
    }

    if (workload === INGESTION_WORKLOAD && stage !== null) {
      const existing = await listRoutes(scope.projectId, scope.userId, {
        environmentId,
        workload,
        stage,
      });
      if (existing.length > 0) {
        return json({ error: "ingestion_stage_route_already_exists" }, { status: 409 });
      }
    }

    const route = await createRoute({
      projectId: scope.projectId,
      environmentId,
      name,
      description: typeof body.description === "string" ? body.description.trim() : undefined,
      defaultModelId: body.defaultModelId ?? undefined,
      billingMode: body.billingMode ?? undefined,
      routeMode: body.routeMode ?? undefined,
      stage,
      workload,
      enabled: body.enabled,
      version: body.version,
      publishedVersion: body.publishedVersion,
      userId: scope.userId,
    });
    if (!route) return json({ error: "Not found or environment not in project" }, { status: 404 });
    return json({ data: route }, { status: 201 });
  } catch (e) {
    console.error("[routes.post] internal error:", e);
    return json({ error: "internal_error", detail: "route_create_failed" }, { status: 500 });
  }
};
