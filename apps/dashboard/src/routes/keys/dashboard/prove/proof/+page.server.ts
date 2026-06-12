/**
 * R5: Prove / Proof tab — moved from /prove root (was /connect/proof).
 * Serves the graph-vs-baseline comparison panel.
 * The workspace cache is warmed by the parent +layout.server.ts.
 */
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
import { sessionUser } from "$lib/server/session-user";

const CHAT_STAGES = new Set(["extraction", "grouping", "validation", "remediation"]);

type ProofData = {
  workspaceId: string | null;
  graphNodeCount: number;
  hasGraph: boolean;
  routes: ChatRouteOption[];
  suggestCacheKey: string;
  proveBase: string;
};

type ProofDataWithState = ProofData & { signedIn: boolean; loadError: boolean };

const SIGNED_OUT: ProofDataWithState = {
  workspaceId: null,
  graphNodeCount: 0,
  hasGraph: false,
  routes: [],
  suggestCacheKey: "",
  proveBase: DASHBOARD_BASE + "/prove",
  signedIn: false,
  loadError: false,
};

const LOAD_ERROR: ProofDataWithState = {
  workspaceId: null,
  graphNodeCount: 0,
  hasGraph: false,
  routes: [],
  suggestCacheKey: "",
  proveBase: DASHBOARD_BASE + "/prove",
  signedIn: true,
  loadError: true,
};

export const load: PageServerLoad = async (event): Promise<ProofDataWithState> => {
  const user = sessionUser(event.locals);
  if (!user) {
    return SIGNED_OUT;
  }

  try {
    const workspace = await requireConnectWorkspace(event.locals, event.parent);
    const wsId = workspace.id;
    const userId = user.uid;
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
      suggestCacheKey: `${wsId}:${graphNodeCount}:${relations}`,
      proveBase: DASHBOARD_BASE + "/prove",
      signedIn: true,
      loadError: false,
    };
  } catch {
    return LOAD_ERROR;
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
