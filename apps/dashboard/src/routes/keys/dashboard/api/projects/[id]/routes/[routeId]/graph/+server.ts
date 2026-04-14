import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { getProjectInWorkspace, getRoute, listRouteStepEdges, replaceRouteStepEdges, updateRoute } from "$lib/server/db";

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

export const GET: RequestHandler = async ({ params, locals }) => {
  if (!locals.user) return json({ error: "Unauthorized" }, { status: 401 });
  const scope = await projectIdAndUid(locals, params.id);
  if (!scope) return json({ error: "Not found" }, { status: 404 });
  const route = await getRoute(params.routeId, scope.projectId, scope.userId);
  if (!route) return json({ error: "Not found" }, { status: 404 });
  const edges = await listRouteStepEdges(params.routeId, scope.projectId, scope.userId);
  return json({
    data: {
      entryStepId: route.entryStepId ?? null,
      flowLayout: route.flowLayout ?? null,
      edges: edges.map((e) => ({
        id: e.id,
        fromStepId: e.fromStepId,
        toStepId: e.toStepId,
        priority: e.priority,
        label: e.label,
      })),
    },
  });
};

export const PUT: RequestHandler = async ({ params, request, locals }) => {
  if (!locals.user) return json({ error: "Unauthorized" }, { status: 401 });
  const scope = await projectIdAndUid(locals, params.id);
  if (!scope) return json({ error: "Not found" }, { status: 404 });
  const route = await getRoute(params.routeId, scope.projectId, scope.userId);
  if (!route) return json({ error: "Not found" }, { status: 404 });

  let body: {
    edges?: Array<{ fromStepId?: string; toStepId?: string; priority?: number; label?: string | null }>;
    entryStepId?: string | null;
    flowLayout?: Record<string, unknown> | null;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return json({ error: "Invalid JSON" }, { status: 400 });
  }

  const rawEdges = Array.isArray(body.edges) ? body.edges : [];
  const normalized: Array<{ fromStepId: string; toStepId: string; priority: number; label: string | null }> = [];
  for (const e of rawEdges) {
    const fromStepId = typeof e.fromStepId === "string" ? e.fromStepId.trim() : "";
    const toStepId = typeof e.toStepId === "string" ? e.toStepId.trim() : "";
    if (!fromStepId || !toStepId) continue;
    const priority =
      typeof e.priority === "number" && Number.isFinite(e.priority) ? Math.trunc(e.priority) : 0;
    const label = e.label === undefined || e.label === null ? null : String(e.label).trim() || null;
    normalized.push({ fromStepId, toStepId, priority, label });
  }

  const rep = await replaceRouteStepEdges(params.routeId, scope.projectId, scope.userId, normalized);
  if (!rep.ok) {
    return json({ error: rep.error }, { status: 400 });
  }

  const updates: Parameters<typeof updateRoute>[3] = {
    updatedVia: "api",
    updatedBy: locals.user.uid,
    changeSummary: "Route graph updated",
  };
  if (body.entryStepId !== undefined) {
    updates.entryStepId = body.entryStepId === null ? null : String(body.entryStepId).trim() || null;
  }
  if (body.flowLayout !== undefined) {
    updates.flowLayout = body.flowLayout;
  }

  const updated = await updateRoute(params.routeId, scope.projectId, scope.userId, updates);
  if (!updated) return json({ error: "Not found" }, { status: 404 });

  const edges = await listRouteStepEdges(params.routeId, scope.projectId, scope.userId);
  return json({
    data: {
      route: updated,
      edges: edges.map((e) => ({
        id: e.id,
        fromStepId: e.fromStepId,
        toStepId: e.toStepId,
        priority: e.priority,
        label: e.label,
      })),
    },
  });
};
