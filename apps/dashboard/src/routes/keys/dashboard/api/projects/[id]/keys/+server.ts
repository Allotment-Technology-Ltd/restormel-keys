import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { listApiKeys, createApiKey, deleteApiKey } from "$lib/server/db";
import { getOrCreateDefaultWorkspace } from "$lib/server/db";
import { dashboardProjectScopeForApi } from "$lib/server/dashboard-project-api-scope";
import { ensureZuploConsumer } from "$lib/server/zuplo-consumer";

export const GET: RequestHandler = async ({ params, locals }) => {
  if (!locals.user) return json({ error: "Unauthorized" }, { status: 401 });
  const scope = await dashboardProjectScopeForApi(locals, params.id);
  if (!scope) return json({ error: "Not found" }, { status: 404 });
  const keys = await listApiKeys(scope.projectId, scope.userId);
  return json({ data: keys.map((k) => ({ ...k, type: "gateway" as const })) });
};

export const POST: RequestHandler = async ({ params, locals }) => {
  if (!locals.user) return json({ error: "Unauthorized" }, { status: 401 });
  const scope = await dashboardProjectScopeForApi(locals, params.id);
  if (!scope) return json({ error: "Not found" }, { status: 404 });
  const result = await createApiKey(scope.projectId, scope.userId);
  if (!result) return json({ error: "Not found" }, { status: 404 });

  // Best-effort: ensure a Zuplo consumer exists for this workspace so the developer portal can "Try it".
  // Never log keys; never fail key creation if Zuplo provisioning is down.
  try {
    if (locals.user.authType !== "gateway_key" && locals.user.authType !== "management_key") {
      const ws = await getOrCreateDefaultWorkspace(locals.user.uid);
      await ensureZuploConsumer({ workspaceId: ws.id, userEmail: locals.user.email ?? null });
    }
  } catch {
    // no-op
  }

  return json(
    {
      data: {
        keyId: result.keyId,
        rawKey: result.rawKey,
        keyPrefix: result.keyPrefix,
        type: "gateway" as const,
      },
    },
    { status: 201 }
  );
};

export const DELETE: RequestHandler = async ({ params, request, locals }) => {
  if (!locals.user) return json({ error: "Unauthorized" }, { status: 401 });
  const scope = await dashboardProjectScopeForApi(locals, params.id);
  if (!scope) return json({ error: "Not found" }, { status: 404 });
  const body = await request.json().catch(() => ({}));
  const keyId = typeof body.keyId === "string" ? body.keyId : undefined;
  if (!keyId) return json({ error: "Missing keyId" }, { status: 400 });
  const ok = await deleteApiKey(scope.projectId, keyId, scope.userId);
  if (!ok) return json({ error: "Not found" }, { status: 404 });
  return json({ ok: true });
};
