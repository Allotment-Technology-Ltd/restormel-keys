/**
 * POST /keys/v1/management-keys — issue a management key scoped to the caller's workspace.
 * GET  /keys/v1/management-keys — list management keys for the caller's workspace.
 *
 * Session auth required. Management keys are workspace-level; gateway keys are project-level.
 *
 * Scoping model:
 *   - Management keys: workspace-scoped; may be used on Connect/Knowledge endpoints that accept
 *     management_key auth, and on read-only Keys integrations endpoints (I9).
 *   - Gateway (consumer) keys: project-scoped; used for runtime resolve + policy evaluate.
 */
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { getOrCreateDefaultWorkspace } from "$lib/server/db";
import { createManagementKey, listManagementKeys } from "$lib/server/neon";

function sessionUserId(locals: App.Locals): string | null {
  if (!locals.user) return null;
  if (locals.user.authType !== "session") return null;
  return locals.user.uid || null;
}

export const GET: RequestHandler = async ({ locals }) => {
  const uid = sessionUserId(locals);
  if (!uid) {
    return json(
      { error: "unauthorized", message: "Session authentication required to list management keys" },
      { status: 401 },
    );
  }
  const workspace = await getOrCreateDefaultWorkspace(uid);
  const keys = await listManagementKeys(workspace.id);
  return json({
    data: keys.map((k) => ({
      id: k.id,
      keyPrefix: k.keyPrefix,
      label: k.label,
      status: k.status,
      createdAt: k.createdAt,
      lastUsedAt: k.lastUsedAt,
      type: "management" as const,
    })),
  });
};

export const POST: RequestHandler = async ({ request, locals }) => {
  const uid = sessionUserId(locals);
  if (!uid) {
    return json(
      { error: "unauthorized", message: "Session authentication required to issue management keys" },
      { status: 401 },
    );
  }
  let body: { label?: string } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    // body is optional; treat parse failure as empty body
  }
  const label = typeof body.label === "string" ? body.label.trim() : undefined;
  const workspace = await getOrCreateDefaultWorkspace(uid);
  const result = await createManagementKey({
    workspaceId: workspace.id,
    label,
    actorId: uid,
  });
  return json(
    {
      data: {
        keyId: result.keyId,
        rawKey: result.rawKey,
        keyPrefix: result.keyPrefix,
        label: label ?? null,
        type: "management" as const,
      },
    },
    { status: 201 },
  );
};
