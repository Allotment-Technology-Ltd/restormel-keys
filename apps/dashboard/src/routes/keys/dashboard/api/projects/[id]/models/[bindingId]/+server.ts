import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import {
  deleteProjectModelBinding,
  getModel,
  getProject,
  getProjectInWorkspace,
  getProjectModelBinding,
  updateProjectModelBindingEnabled,
} from "$lib/server/db";
import type { ModelRecord } from "$lib/server/db";

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

async function toEntry(
  projectId: string,
  bindingId: string
): Promise<{
  id: string;
  providerType: string;
  modelId: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  model: ModelRecord | null;
} | null> {
  const b = await getProjectModelBinding(bindingId, projectId);
  if (!b) return null;
  const model = await getModel(b.modelId);
  return {
    id: b.id,
    providerType: b.providerType,
    modelId: b.modelId,
    enabled: b.enabled,
    createdAt: b.createdAt,
    updatedAt: b.updatedAt,
    model,
  };
}

/** PATCH: soft-disable or re-enable a binding. Body: { enabled: boolean } */
export const PATCH: RequestHandler = async ({ params, request, locals }) => {
  try {
    if (!locals.user) return json({ error: "Unauthorized" }, { status: 401 });
    const scope = await projectScope(locals, params.id);
    if (!scope) return json({ error: "forbidden" }, { status: 403 });

    let body: { enabled?: unknown };
    try {
      body = (await request.json()) as { enabled?: unknown };
    } catch {
      return json({ error: "invalid_json", detail: "Body must be JSON" }, { status: 400 });
    }
    if (typeof body.enabled !== "boolean") {
      return json({ error: "validation_failed", detail: "Body must include boolean enabled" }, { status: 400 });
    }

    const updated = await updateProjectModelBindingEnabled(params.bindingId, scope.projectId, body.enabled);
    if (!updated) return json({ error: "binding_not_found" }, { status: 404 });

    const data = await toEntry(scope.projectId, params.bindingId);
    return json({ data });
  } catch (e) {
    console.error("[project.models.binding.patch]", e);
    return json({ error: "internal_error", detail: "project_model_binding_patch_failed" }, { status: 500 });
  }
};

/** DELETE: remove a binding (hard delete). */
export const DELETE: RequestHandler = async ({ params, locals }) => {
  try {
    if (!locals.user) return json({ error: "Unauthorized" }, { status: 401 });
    const scope = await projectScope(locals, params.id);
    if (!scope) return json({ error: "forbidden" }, { status: 403 });

    const ok = await deleteProjectModelBinding(params.bindingId, scope.projectId);
    if (!ok) return json({ error: "binding_not_found" }, { status: 404 });

    return json({ data: { deleted: true, id: params.bindingId } });
  } catch (e) {
    console.error("[project.models.binding.delete]", e);
    return json({ error: "internal_error", detail: "project_model_binding_delete_failed" }, { status: 500 });
  }
};
