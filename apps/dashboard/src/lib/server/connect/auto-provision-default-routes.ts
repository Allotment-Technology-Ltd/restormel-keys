/**
 * Phase 3 Stage 0 — auto-provision default ingest routes from BYOK.
 *
 * Breaks the documented "you must publish chat + embedding routes before you can
 * query" gate for the solo builder: when a workspace has a connected provider key
 * but no published ingest routes, this provisions sensible cheap-default chat +
 * embedding routes so the first verified query is reachable with no route-building.
 *
 * It is a thin, idempotent wrapper over the existing, proven one-click engine
 * `applyRecommendedIngestionRoutes` (the same code the "Apply recommended models"
 * button uses) — we deliberately do NOT re-implement route/route_step creation or
 * canonical-model resolution. The engine:
 *   - picks recommended models for the workspace's connected providers
 *     (cheap defaults via model-guidance, cross-model where two providers exist),
 *   - creates/updates per-stage routes incl. `ingestion_embedding`,
 *   - publishes them and binds providers,
 *   - is itself idempotent (existing routes are reused, not duplicated).
 *
 * We add only the *gate*: detect "has a key, lacks published routes" and resolve a
 * default project/environment when no routing config exists yet. Nothing here
 * auto-charges or selects exotic models — the engine's recommendations are the
 * cheap production defaults already shipped.
 */
import { resolveDefaultKnowledgeProject } from "$lib/server/connect/stage-routing";
import { listConnectStageRouteRows } from "$lib/server/connect/stage-routing";
import { applyRecommendedIngestionRoutes } from "$lib/server/connect/apply-recommended-routes";
import { listProviderIntegrations } from "$lib/server/db";

export type AutoProvisionOutcome =
  | { provisioned: false; reason: "no_provider_key" | "no_project" | "already_has_routes" }
  | {
      provisioned: true;
      projectId: string;
      environmentId: string;
      stagesApplied: number;
      stagesSkipped: number;
    };

/** A workspace "has a connected provider key" when ≥1 active provider integration exists. */
async function hasConnectedProviderKey(workspaceId: string): Promise<boolean> {
  const integrations = await listProviderIntegrations(workspaceId).catch(() => []);
  return integrations.some((i) => Boolean(i.providerType) && i.status !== "revoked");
}

/**
 * Whether the workspace already has at least one published chat + one published
 * embedding ingest route — i.e. the query gate is already satisfied and there is
 * nothing to provision.
 */
async function hasPublishedChatAndEmbeddingRoutes(args: {
  workspaceId: string;
  userId: string;
  projectId: string;
  environmentId: string;
}): Promise<boolean> {
  const rows = await listConnectStageRouteRows({
    workspaceId: args.workspaceId,
    userId: args.userId,
    projectId: args.projectId,
    environmentId: args.environmentId,
  }).catch(() => []);

  // "Chat" = any of the LLM extraction/grouping/validation/remediation stages;
  // "embedding" = the embedding stage. We require at least one published of each.
  const CHAT_STAGES = new Set(["extraction", "grouping", "validation", "remediation"]);
  let hasChat = false;
  let hasEmbedding = false;
  for (const row of rows) {
    if (!row.route || !row.route.isPublished) continue;
    if (row.key === "embedding") hasEmbedding = true;
    else if (CHAT_STAGES.has(row.key)) hasChat = true;
  }
  return hasChat && hasEmbedding;
}

/**
 * Idempotently auto-provision default chat + embedding ingest routes for a
 * workspace from its connected provider keys. No-op (and reports why) when there
 * is no provider key, no resolvable project, or routes already exist.
 */
export async function autoProvisionDefaultRoutes(args: {
  workspaceId: string;
  userId: string;
  actorType?: string;
}): Promise<AutoProvisionOutcome> {
  if (!(await hasConnectedProviderKey(args.workspaceId))) {
    return { provisioned: false, reason: "no_provider_key" };
  }

  const project = await resolveDefaultKnowledgeProject({
    workspaceId: args.workspaceId,
    userId: args.userId,
  });
  if (!project?.projectId || !project.environmentId) {
    return { provisioned: false, reason: "no_project" };
  }

  const alreadyHasRoutes = await hasPublishedChatAndEmbeddingRoutes({
    workspaceId: args.workspaceId,
    userId: args.userId,
    projectId: project.projectId,
    environmentId: project.environmentId,
  });
  if (alreadyHasRoutes) {
    return { provisioned: false, reason: "already_has_routes" };
  }

  const result = await applyRecommendedIngestionRoutes({
    workspaceId: args.workspaceId,
    userId: args.userId,
    projectId: project.projectId,
    environmentId: project.environmentId,
    actorType: args.actorType ?? "auto_provision",
  });

  return {
    provisioned: true,
    projectId: project.projectId,
    environmentId: project.environmentId,
    stagesApplied: result.applied.length,
    stagesSkipped: result.skipped.length,
  };
}
