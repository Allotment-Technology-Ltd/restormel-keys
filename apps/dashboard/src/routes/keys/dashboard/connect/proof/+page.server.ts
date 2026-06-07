import type { PageServerLoad } from "./$types";
import { DASHBOARD_BASE } from "$lib/dashboard-base";
import { requireConnectWorkspace } from "$lib/server/connect/workspace-cache";
import { getGraphTargetForUi } from "$lib/server/connect/graph-target-service";
import { peekConnectGraphStats } from "$lib/server/connect/graph-explorer-service";
import {
  resolveKnowledgeRouteExecutionContext,
  listConnectStageRouteRows,
} from "$lib/server/connect/stage-routing";
import type { ChatRouteOption } from "$lib/connect/graph-comparison-types";

const CHAT_STAGES = new Set(["extraction", "grouping", "validation", "remediation"]);

type ProofData = {
  workspaceId: string | null;
  graphNodeCount: number;
  hasGraph: boolean;
  routes: ChatRouteOption[];
  suggestCacheKey: string;
  connectBase: string;
};

const EMPTY: ProofData = {
  workspaceId: null,
  graphNodeCount: 0,
  hasGraph: false,
  routes: [],
  suggestCacheKey: "",
  connectBase: DASHBOARD_BASE + "/connect",
};

export const load: PageServerLoad = async (event): Promise<ProofData> => {
  if (!event.locals.user || event.locals.user.authType !== "session") {
    return EMPTY;
  }

  try {
    const workspace = await requireConnectWorkspace(event.locals, event.parent);
    const wsId = workspace.id;
    const userId = event.locals.user.uid;
    event.depends(`app:connect-proof:${wsId}`);

    const [target, stats] = await Promise.all([
      getGraphTargetForUi(wsId).catch(() => null),
      peekConnectGraphStats(wsId).catch(() => null),
    ]);

    const graphNodeCount = stats?.units ?? 0;
    const relations = stats?.relations ?? 0;
    const hasGraph = Boolean(target && target.status === "ok" && graphNodeCount > 0);

    const routes = await resolveChatRoutes(wsId, userId).catch(() => [] as ChatRouteOption[]);

    return {
      workspaceId: wsId,
      graphNodeCount,
      hasGraph,
      routes,
      // Counts shift when a new run completes — used as the suggestion cache key.
      suggestCacheKey: `${wsId}:${graphNodeCount}:${relations}`,
      connectBase: DASHBOARD_BASE + "/connect",
    };
  } catch {
    return EMPTY;
  }
};

async function resolveChatRoutes(workspaceId: string, userId: string): Promise<ChatRouteOption[]> {
  const ctx = await resolveKnowledgeRouteExecutionContext({ workspaceId, userId });
  if (!ctx) return [];

  const rows = await listConnectStageRouteRows({
    workspaceId,
    userId,
    projectId: ctx.projectId,
    environmentId: ctx.environmentId,
  });

  const byId = new Map<string, ChatRouteOption>();
  for (const row of rows) {
    if (!CHAT_STAGES.has(row.key) || !row.route) continue;
    if (byId.has(row.route.id)) continue;
    byId.set(row.route.id, {
      id: row.route.id,
      name: row.route.name,
      model: row.activeModel?.modelId ?? null,
      provider: row.activeModel?.provider ?? null,
    });
  }
  return [...byId.values()];
}
