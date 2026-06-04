/**
 * Session-scoped Knowledge pipeline profiles (saved domain pack + graph target + defaults).
 */
import { json } from "@sveltejs/kit";
import { ConnectPipelineProfileUpsertSchema } from "@restormel/contracts/connect";
import {
  getConnectDomainPackById,
  getConnectGraphTargetForWorkspace,
  insertConnectPipelineProfile,
  listConnectPipelineProfilesForWorkspace,
} from "$lib/server/neon";
import {
  isKnowledgeSessionFailure,
  resolveKnowledgeSessionContext,
} from "$lib/server/connect/session-context";
import type { RequestHandler } from "./$types";

function profileRecordToApi(row: {
  id: string;
  workspaceId: string;
  title: string;
  description: string | null;
  domainPackId: string;
  graphTargetId: string | null;
  defaultStopAfterStage: string | null;
  createdAt: number;
  updatedAt: number;
}) {
  return {
    id: row.id,
    workspace_id: row.workspaceId,
    title: row.title,
    ...(row.description ? { description: row.description } : {}),
    domain_pack_id: row.domainPackId,
    ...(row.graphTargetId ? { graph_target_id: row.graphTargetId } : {}),
    ...(row.defaultStopAfterStage ? { default_stop_after_stage: row.defaultStopAfterStage } : {}),
    created_at: new Date(row.createdAt).toISOString(),
    updated_at: new Date(row.updatedAt).toISOString(),
  };
}

export const GET: RequestHandler = async ({ locals }) => {
  const ctx = await resolveKnowledgeSessionContext(locals);
  if (isKnowledgeSessionFailure(ctx)) {
    return json({ error: ctx.error, message: ctx.message }, { status: ctx.status });
  }
  const rows = await listConnectPipelineProfilesForWorkspace(ctx.workspaceId);
  return json({ profiles: rows.map(profileRecordToApi) });
};

export const POST: RequestHandler = async ({ locals, request }) => {
  const ctx = await resolveKnowledgeSessionContext(locals);
  if (isKnowledgeSessionFailure(ctx)) {
    return json({ error: ctx.error, message: ctx.message }, { status: ctx.status });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid_json", message: "Request body must be JSON." }, { status: 400 });
  }
  const parsed = ConnectPipelineProfileUpsertSchema.safeParse(body);
  if (!parsed.success) {
    return json(
      { error: "invalid_request", message: parsed.error.issues.map((i) => i.message).join("; ") },
      { status: 400 },
    );
  }

  const pack = await getConnectDomainPackById({ id: parsed.data.domain_pack_id, workspaceId: ctx.workspaceId });
  if (!pack) {
    return json({ error: "invalid_domain_pack", message: "Domain pack not found." }, { status: 400 });
  }
  if (parsed.data.graph_target_id) {
    const target = await getConnectGraphTargetForWorkspace(ctx.workspaceId);
    if (!target || target.id !== parsed.data.graph_target_id) {
      return json({ error: "invalid_graph_target", message: "Graph target not found." }, { status: 400 });
    }
  }

  const row = await insertConnectPipelineProfile({
    workspaceId: ctx.workspaceId,
    title: parsed.data.title,
    description: parsed.data.description ?? null,
    domainPackId: parsed.data.domain_pack_id,
    graphTargetId: parsed.data.graph_target_id ?? null,
    defaultStopAfterStage: parsed.data.default_stop_after_stage ?? null,
  });
  return json({ profile: profileRecordToApi(row) }, { status: 201 });
};
