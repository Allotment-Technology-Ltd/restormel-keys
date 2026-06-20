/**
 * GET /keys/dashboard/prove/api/routing-strip
 *
 * Phase 3 Stage 4 — the inline routing strip on the Answer Console.
 *
 * Returns the model-per-stage snapshot the console renders next to the answer:
 * for each Connect ingestion stage (extraction / grouping / validation /
 * remediation / embedding) the default applied model + provider, whether the
 * stage's route is PUBLISHED (i.e. live for resolve), and the routeId/projectId
 * so the console can deep-link to the advanced route builder.
 *
 * It also surfaces the VALIDATION-stage provider so the answer's cross-model
 * disclosure ("validated by Anthropic vs OpenAI — cross-family ✓") is grounded
 * in the actually-applied validator, not a guess (claims-integrity rule).
 *
 * READ-ONLY. Session-scoped (workspace). Reuses `listConnectStageRouteRows` — it
 * does NOT duplicate route-step logic. The one-click model override POSTs to the
 * existing `stage-models/apply` endpoint; publishing POSTs to publish-config.
 */
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import {
  resolveKnowledgeRouteExecutionContext,
  listConnectStageRouteRows,
  type StageRouteUiRow,
} from "$lib/server/connect/stage-routing";
import {
  isKnowledgeSessionFailure,
  resolveKnowledgeSessionContext,
} from "$lib/server/connect/session-context";
import { DASHBOARD_BASE } from "$lib/dashboard-base";

/** Stages whose model the console answer pipeline actually calls (chat-shaped). */
const CHAT_STAGES = new Set(["extraction", "grouping", "validation", "remediation"]);

type StripStage = {
  key: string;
  label: string;
  help: string;
  /** Whether this stage feeds the live answer (chat) vs supporting (embedding). */
  isChat: boolean;
  provider: string | null;
  modelId: string | null;
  routeId: string | null;
  /** True when the linked route's published version === working version. */
  isPublished: boolean;
  /** True when a route is linked but its working version is ahead of published. */
  needsPublish: boolean;
  /** Deep-link to the ADVANCED route builder for power users (null when no route). */
  advancedHref: string | null;
};

function toStripStage(row: StageRouteUiRow, projectId: string): StripStage {
  const route = row.route;
  const isPublished = Boolean(route?.isPublished);
  return {
    key: row.key,
    label: row.label,
    help: row.help,
    isChat: CHAT_STAGES.has(row.key),
    provider: row.activeModel?.provider ?? null,
    modelId: row.activeModel?.modelId ?? null,
    routeId: route?.id ?? null,
    isPublished,
    // A route exists, is enabled, but its working version is unpublished → resolve
    // will fail with route_unpublished. This is the publish-stranding (K-P0-3).
    needsPublish: Boolean(route && route.enabled && !isPublished),
    advancedHref: route
      ? `${DASHBOARD_BASE}/projects/${projectId}/routes/${route.id}`
      : null,
  };
}

export const GET: RequestHandler = async ({ locals }) => {
  const ctx = await resolveKnowledgeSessionContext(locals);
  if (isKnowledgeSessionFailure(ctx)) {
    return json({ error: ctx.error, message: ctx.message }, { status: ctx.status });
  }

  const exec = await resolveKnowledgeRouteExecutionContext({
    workspaceId: ctx.workspaceId,
    userId: ctx.userId,
  });
  if (!exec) {
    // No routing config yet — the console shows the "configure a route" notice.
    return json({
      configured: false,
      projectId: null,
      environmentId: null,
      stages: [],
      validationProvider: null,
      needsPublishCount: 0,
    });
  }

  const rows = await listConnectStageRouteRows({
    workspaceId: ctx.workspaceId,
    userId: ctx.userId,
    projectId: exec.projectId,
    environmentId: exec.environmentId,
    dashboardBase: DASHBOARD_BASE,
  });

  const stages = rows.map((r) => toStripStage(r, exec.projectId));
  const validationProvider =
    stages.find((s) => s.key === "validation")?.provider ?? null;
  const needsPublishCount = stages.filter((s) => s.isChat && s.needsPublish).length;

  return json({
    configured: true,
    projectId: exec.projectId,
    environmentId: exec.environmentId,
    stages,
    validationProvider,
    needsPublishCount,
  });
};
