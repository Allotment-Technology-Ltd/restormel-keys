import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { listApiKeys, createApiKey, deleteApiKey, updateApiKeyLabel } from "$lib/server/db";
import { getOrCreateDefaultWorkspace } from "$lib/server/db";
import { dashboardProjectScopeForApi } from "$lib/server/dashboard-project-api-scope";
import { ensureZuploConsumer } from "$lib/server/zuplo-consumer";

/**
 * Validates that a label string does not contain key material (rk_ prefix anywhere in the string).
 * The regex is unanchored so it matches "prod key rk_<fullkey>" as well as bare rk_ strings.
 * Exported so POST, PATCH, and tests all use the same validator (no inline copies).
 */
export function labelContainsKeyMaterial(label: string): boolean {
  return /rk_[A-Za-z0-9_-]{8,}/.test(label);
}

export const GET: RequestHandler = async ({ params, locals }) => {
  if (!locals.user) return json({ error: "unauthorized", message: "Authentication required" }, { status: 401 });
  const scope = await dashboardProjectScopeForApi(locals, params.id);
  if (!scope) return json({ error: "not_found", message: "Project not found" }, { status: 404 });
  const keys = await listApiKeys(scope.projectId, scope.userId);
  // Map fields explicitly — never spread the full record in case the type gains sensitive fields.
  return json({
    data: keys.map((k) => ({
      id: k.id,
      keyPrefix: k.keyPrefix,
      createdAt: k.createdAt,
      label: k.label,
      lastUsedAt: k.lastUsedAt,
      type: "gateway" as const,
    })),
  });
};

export const POST: RequestHandler = async ({ params, request, locals }) => {
  if (!locals.user) return json({ error: "unauthorized", message: "Authentication required" }, { status: 401 });
  const scope = await dashboardProjectScopeForApi(locals, params.id);
  if (!scope) return json({ error: "not_found", message: "Project not found" }, { status: 404 });
  // W3.7/K1: accept optional label in body (was: no body read at all — K-P1-1).
  // SECURITY: label is a human-readable string — reject anything that looks like key material.
  const body = await request.json().catch(() => ({}));
  const rawLabel = typeof body.label === "string" ? body.label.trim().slice(0, 120) : undefined;
  // Validation: label must not contain key material (rk_ anywhere in the string, not just at start).
  if (rawLabel && labelContainsKeyMaterial(rawLabel)) {
    return json({ error: "invalid_label", message: "Label must not contain key material" }, { status: 400 });
  }
  const label = rawLabel || undefined;
  const result = await createApiKey(scope.projectId, scope.userId, { label });
  if (!result) return json({ error: "not_found", message: "Project not found" }, { status: 404 });

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

/** PATCH — rename a key's label (W3.7/K1). Body: { keyId, label: string | null }. */
export const PATCH: RequestHandler = async ({ params, request, locals }) => {
  if (!locals.user) return json({ error: "unauthorized", message: "Authentication required" }, { status: 401 });
  const scope = await dashboardProjectScopeForApi(locals, params.id);
  if (!scope) return json({ error: "not_found", message: "Project not found" }, { status: 404 });
  const body = await request.json().catch(() => ({}));
  const keyId = typeof body.keyId === "string" ? body.keyId : undefined;
  if (!keyId) return json({ error: "invalid_request", message: "Missing keyId" }, { status: 400 });
  // null/empty string clears the label; otherwise trim + cap.
  const rawLabel = typeof body.label === "string" ? body.label.trim().slice(0, 120) : null;
  // SECURITY: reject labels that contain key material (rk_ anywhere, not just at start).
  if (rawLabel && labelContainsKeyMaterial(rawLabel)) {
    return json({ error: "invalid_label", message: "Label must not contain key material" }, { status: 400 });
  }
  const ok = await updateApiKeyLabel(scope.projectId, keyId, scope.userId, rawLabel || null);
  if (!ok) return json({ error: "not_found", message: "Key not found" }, { status: 404 });
  return json({ ok: true });
};

export const DELETE: RequestHandler = async ({ params, request, locals }) => {
  if (!locals.user) return json({ error: "unauthorized", message: "Authentication required" }, { status: 401 });
  const scope = await dashboardProjectScopeForApi(locals, params.id);
  if (!scope) return json({ error: "not_found", message: "Project not found" }, { status: 404 });
  const body = await request.json().catch(() => ({}));
  const keyId = typeof body.keyId === "string" ? body.keyId : undefined;
  if (!keyId) return json({ error: "invalid_request", message: "Missing keyId" }, { status: 400 });
  const ok = await deleteApiKey(scope.projectId, keyId, scope.userId);
  if (!ok) return json({ error: "not_found", message: "Key not found" }, { status: 404 });
  return json({ ok: true });
};
