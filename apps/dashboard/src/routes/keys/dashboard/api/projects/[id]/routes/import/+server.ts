import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import {
  getProjectInWorkspace,
  createRoute,
  updateRoute,
  replaceRouteStepsFromSnapshot,
  getRoute,
  listRoutes,
  getRouteWithSteps,
} from "$lib/server/db";
import { INGESTION_STAGES, INGESTION_WORKLOAD } from "$lib/server/ingestion-routing";
import {
  validateRouteGraphBundleForImport,
  bundleStepsToSnapshotsForDb,
  type RouteGraphBundle,
} from "$lib/server/route-graph-bundle";

async function projectIdAndUid(
  locals: App.Locals,
  projectId: string,
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

function workloadStageFromSerializedRoute(route: RouteGraphBundle["route"]): {
  workload: string | null;
  stage: string | null;
} {
  const r = route as Record<string, unknown>;
  const workload =
    typeof r.workload === "string" && r.workload.trim() !== "" ? r.workload.trim() : null;
  const stage = typeof r.stage === "string" && r.stage.trim() !== "" ? r.stage.trim() : null;
  return { workload, stage };
}

/** POST: apply route graph bundle (create new route or replace an existing route’s metadata + steps). */
export const POST: RequestHandler = async ({ params, request, locals }) => {
  try {
    if (!locals.user) return json({ error: "Unauthorized" }, { status: 401 });
    const scope = await projectIdAndUid(locals, params.id);
    if (!scope) return json({ error: "Not found" }, { status: 404 });

    let body: {
      bundle?: unknown;
      replaceRouteId?: string;
      changeSummary?: string;
      updatedVia?: string;
    };
    try {
      body = (await request.json()) as typeof body;
    } catch {
      return json({ error: "Invalid JSON" }, { status: 400 });
    }

    const validated = validateRouteGraphBundleForImport(body.bundle, scope.projectId);
    if (!validated.ok) {
      return json({ error: validated.error }, { status: validated.status });
    }
    const { bundle } = validated;

    const replaceRouteId =
      typeof body.replaceRouteId === "string" && body.replaceRouteId.trim() !== ""
        ? body.replaceRouteId.trim()
        : undefined;

    const { workload, stage } = workloadStageFromSerializedRoute(bundle.route);
    if (stage !== null && workload !== INGESTION_WORKLOAD) {
      return json({ error: "stage is only valid with workload='ingestion'" }, { status: 400 });
    }
    if (workload === INGESTION_WORKLOAD && stage !== null && !INGESTION_STAGES.has(stage)) {
      return json(
        { error: `stage must be one of: ${Array.from(INGESTION_STAGES).join(", ")}` },
        { status: 400 },
      );
    }

    const updatedVia =
      typeof body.updatedVia === "string" && body.updatedVia.trim()
        ? body.updatedVia.trim()
        : locals.user.authType ?? "route_graph_import";
    const changeSummary =
      typeof body.changeSummary === "string" && body.changeSummary.trim()
        ? body.changeSummary.trim()
        : replaceRouteId
          ? "Imported route graph bundle (replace)"
          : "Imported route graph bundle (create)";

    const stepsSnapshot = bundleStepsToSnapshotsForDb(bundle.steps);

    if (replaceRouteId) {
      const existing = await getRoute(replaceRouteId, scope.projectId, scope.userId);
      if (!existing) return json({ error: "Not found" }, { status: 404 });

      const bundleRouteId =
        typeof (bundle.route as { id?: unknown }).id === "string"
          ? (bundle.route as { id: string }).id.trim()
          : "";
      if (bundleRouteId && bundleRouteId !== replaceRouteId) {
        return json({ error: "bundle_route_id_mismatch_replace_target" }, { status: 400 });
      }
      if (bundle.route.environmentId !== existing.environmentId) {
        return json({ error: "environment_mismatch_on_replace" }, { status: 400 });
      }

      if (workload === INGESTION_WORKLOAD && stage !== null) {
        const sameSlot = await listRoutes(scope.projectId, scope.userId, {
          environmentId: bundle.route.environmentId,
          workload,
          stage,
        });
        if (sameSlot.some((r) => r.id !== replaceRouteId)) {
          return json({ error: "ingestion_stage_route_already_exists" }, { status: 409 });
        }
      }

      const updated = await updateRoute(replaceRouteId, scope.projectId, scope.userId, {
        name: bundle.route.name,
        description: bundle.route.description ?? null,
        defaultModelId: bundle.route.defaultModelId ?? null,
        billingMode: bundle.route.billingMode ?? null,
        routeMode: bundle.route.routeMode ?? null,
        stage,
        workload,
        enabled: bundle.route.enabled !== false,
        updatedVia,
        updatedBy: scope.userId,
        changeSummary,
      });
      if (!updated) return json({ error: "update_failed" }, { status: 500 });

      const replaced = await replaceRouteStepsFromSnapshot({
        routeId: replaceRouteId,
        projectId: scope.projectId,
        userId: scope.userId,
        stepsSnapshot,
      });
      if (!replaced) return json({ error: "steps_replace_failed" }, { status: 500 });

      const out = await getRouteWithSteps(replaceRouteId, scope.projectId, scope.userId);
      if (!out) return json({ error: "Not found" }, { status: 404 });
      return json({ data: out });
    }

    if (workload === INGESTION_WORKLOAD && stage !== null) {
      const dup = await listRoutes(scope.projectId, scope.userId, {
        environmentId: bundle.route.environmentId,
        workload,
        stage,
      });
      if (dup.length > 0) {
        return json({ error: "ingestion_stage_route_already_exists" }, { status: 409 });
      }
    }

    const route = await createRoute({
      projectId: scope.projectId,
      environmentId: bundle.route.environmentId,
      name: bundle.route.name,
      description: bundle.route.description ?? undefined,
      defaultModelId: bundle.route.defaultModelId ?? undefined,
      billingMode: bundle.route.billingMode ?? undefined,
      routeMode: bundle.route.routeMode ?? undefined,
      stage,
      workload,
      enabled: bundle.route.enabled !== false,
      updatedVia,
      changeSummary,
      userId: scope.userId,
    });
    if (!route) return json({ error: "Not found or environment not in project" }, { status: 404 });

    const replaced = await replaceRouteStepsFromSnapshot({
      routeId: route.id,
      projectId: scope.projectId,
      userId: scope.userId,
      stepsSnapshot,
    });
    if (!replaced) return json({ error: "steps_replace_failed" }, { status: 500 });

    const out = await getRouteWithSteps(route.id, scope.projectId, scope.userId);
    if (!out) return json({ error: "Not found" }, { status: 404 });
    return json({ data: out }, { status: 201 });
  } catch (e) {
    console.error("[routes.import.post] internal error:", e);
    return json({ error: "internal_error", detail: "route_import_failed" }, { status: 500 });
  }
};
