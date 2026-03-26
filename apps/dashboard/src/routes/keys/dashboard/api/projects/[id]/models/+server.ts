import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import {
  getModel,
  getProject,
  getProjectInWorkspace,
  listModels,
  listProjectModelBindings,
  replaceProjectModelBindings,
  upsertProjectModelBinding,
} from "$lib/server/db";
import type { ModelRecord } from "$lib/server/db";
import { validateProjectModelBindingPair } from "$lib/server/project-model-index-validation";

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

type ProjectModelIndexEntry = {
  id: string;
  providerType: string;
  modelId: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  model: ModelRecord | null;
};

async function buildIndexEntries(projectId: string): Promise<ProjectModelIndexEntry[]> {
  const bindings = await listProjectModelBindings(projectId);
  const entries: ProjectModelIndexEntry[] = [];
  for (const b of bindings) {
    const model = await getModel(b.modelId);
    entries.push({
      id: b.id,
      providerType: b.providerType,
      modelId: b.modelId,
      enabled: b.enabled,
      createdAt: b.createdAt,
      updatedAt: b.updatedAt,
      model,
    });
  }
  return entries;
}

/** GET: project model index (bindings + catalog metadata). POST: batch add (idempotent). PUT: replace full allowlist. */
export const GET: RequestHandler = async ({ params, url, locals }) => {
  try {
    if (!locals.user) return json({ error: "Unauthorized" }, { status: 401 });
    const scope = await projectScope(locals, params.id);
    if (!scope) return json({ error: "forbidden" }, { status: 403 });

    const source = url.searchParams.get("source")?.trim();
    if (source === "catalog") {
      const limitParam = url.searchParams.get("limit");
      const offsetParam = url.searchParams.get("offset");
      const family = url.searchParams.get("family")?.trim() || undefined;
      const lifecycleState = url.searchParams.get("lifecycleState")?.trim() || undefined;
      const limit = limitParam != null ? Math.min(Math.max(1, parseInt(limitParam, 10) || 100), 500) : 100;
      const offset = offsetParam != null ? Math.max(0, parseInt(offsetParam, 10) || 0) : 0;
      const models = await listModels({ lifecycleState, family, limit, offset });
      return json({
        data: models,
        meta: {
          source: "catalog",
          deprecation:
            "Prefer GET /keys/dashboard/api/models for global catalog; this query is legacy on the project path.",
        },
      });
    }

    const data = await buildIndexEntries(scope.projectId);
    return json({ data, meta: { source: "project" } });
  } catch (e) {
    console.error("[project.models.get]", e);
    return json({ error: "internal_error", detail: "project_models_list_failed" }, { status: 500 });
  }
};

/** POST: add one or more bindings (idempotent per providerType + modelId). Body: { models: [{ providerType, modelId }] } */
export const POST: RequestHandler = async ({ params, request, locals }) => {
  try {
    if (!locals.user) return json({ error: "Unauthorized" }, { status: 401 });
    const scope = await projectScope(locals, params.id);
    if (!scope) return json({ error: "forbidden" }, { status: 403 });

    let body: { models?: unknown };
    try {
      body = (await request.json()) as { models?: unknown };
    } catch {
      return json({ error: "invalid_json", detail: "Body must be JSON" }, { status: 400 });
    }
    if (!Array.isArray(body.models) || body.models.length === 0) {
      return json(
        { error: "validation_failed", detail: "Body must include a non-empty models array" },
        { status: 400 }
      );
    }

    const errors: { index: number; field: string; code: string; message: string }[] = [];
    const dedupe = new Map<string, { canonicalProvider: string; modelId: string }>();

    for (let i = 0; i < body.models.length; i++) {
      const row = body.models[i];
      if (row === null || typeof row !== "object") {
        errors.push({ index: i, field: "models", code: "validation_failed", message: "Each entry must be an object" });
        continue;
      }
      const r = row as { providerType?: unknown; modelId?: unknown };
      const v = await validateProjectModelBindingPair(r.providerType, r.modelId);
      if (!v.ok) {
        errors.push({
          index: i,
          field: v.error.code === "unknown_model" ? "modelId" : "providerType",
          code: v.error.code,
          message: v.error.detail,
        });
        continue;
      }
      const key = `${v.canonicalProvider}\0${v.modelId}`;
      dedupe.set(key, { canonicalProvider: v.canonicalProvider, modelId: v.modelId });
    }

    if (errors.length > 0) {
      return json(
        {
          error: "project_models_validation_failed",
          detail: "One or more models failed validation",
          errors,
        },
        { status: 400 }
      );
    }

    for (const v of dedupe.values()) {
      await upsertProjectModelBinding(scope.projectId, v.canonicalProvider, v.modelId);
    }

    const data = await buildIndexEntries(scope.projectId);
    return json({ data });
  } catch (e) {
    console.error("[project.models.post]", e);
    return json({ error: "internal_error", detail: "project_models_add_failed" }, { status: 500 });
  }
};

/** PUT: replace the full project model allowlist. Body: { models: [{ providerType, modelId, enabled? }] } */
export const PUT: RequestHandler = async ({ params, request, locals }) => {
  try {
    if (!locals.user) return json({ error: "Unauthorized" }, { status: 401 });
    const scope = await projectScope(locals, params.id);
    if (!scope) return json({ error: "forbidden" }, { status: 403 });

    let body: { models?: unknown };
    try {
      body = (await request.json()) as { models?: unknown };
    } catch {
      return json({ error: "invalid_json", detail: "Body must be JSON" }, { status: 400 });
    }
    if (!Array.isArray(body.models)) {
      return json({ error: "validation_failed", detail: "Body must include a models array" }, { status: 400 });
    }

    const errors: { index: number; field: string; code: string; message: string }[] = [];
    const items: { canonicalProviderType: string; modelId: string; enabled: boolean }[] = [];
    const dedupe = new Map<string, { canonicalProviderType: string; modelId: string; enabled: boolean }>();

    for (let i = 0; i < body.models.length; i++) {
      const row = body.models[i];
      if (row === null || typeof row !== "object") {
        errors.push({ index: i, field: "models", code: "validation_failed", message: "Each entry must be an object" });
        continue;
      }
      const r = row as { providerType?: unknown; modelId?: unknown; enabled?: unknown };
      const v = await validateProjectModelBindingPair(r.providerType, r.modelId);
      if (!v.ok) {
        errors.push({
          index: i,
          field: v.error.code === "unknown_model" ? "modelId" : "providerType",
          code: v.error.code,
          message: v.error.detail,
        });
        continue;
      }
      const enabled = r.enabled === false ? false : true;
      const key = `${v.canonicalProvider}\0${v.modelId}`;
      dedupe.set(key, { canonicalProviderType: v.canonicalProvider, modelId: v.modelId, enabled });
    }

    if (errors.length > 0) {
      return json(
        {
          error: "project_models_validation_failed",
          detail: "One or more models failed validation",
          errors,
        },
        { status: 400 }
      );
    }

    for (const it of dedupe.values()) items.push(it);

    await replaceProjectModelBindings(scope.projectId, items);
    const data = await buildIndexEntries(scope.projectId);
    return json({ data });
  } catch (e) {
    console.error("[project.models.put]", e);
    return json({ error: "internal_error", detail: "project_models_replace_failed" }, { status: 500 });
  }
};
