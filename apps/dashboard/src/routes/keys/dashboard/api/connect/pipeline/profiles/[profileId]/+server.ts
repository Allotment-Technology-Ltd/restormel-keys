/**
 * Delete a Knowledge pipeline profile (session-scoped, destructive action).
 */
import { json } from "@sveltejs/kit";
import { deleteConnectPipelineProfile, getConnectPipelineProfileById } from "$lib/server/neon";
import {
  isKnowledgeSessionFailure,
  resolveKnowledgeSessionContext,
} from "$lib/server/connect/session-context";
import type { RequestHandler } from "./$types";

export const DELETE: RequestHandler = async ({ locals, params }) => {
  const ctx = await resolveKnowledgeSessionContext(locals);
  if (isKnowledgeSessionFailure(ctx)) {
    return json({ error: ctx.error, message: ctx.message }, { status: ctx.status });
  }
  const existing = await getConnectPipelineProfileById({ id: params.profileId, workspaceId: ctx.workspaceId });
  if (!existing) {
    return json({ error: "not_found", message: "Profile not found." }, { status: 404 });
  }
  await deleteConnectPipelineProfile({ id: params.profileId, workspaceId: ctx.workspaceId });
  return json({ deleted: true });
};
