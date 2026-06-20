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
import {
  seedDemoGraph,
  demoGraphSuggestedQuestions,
  workspaceHasDemoGraph,
  type DemoGraphSuggestedQuestion,
} from "$lib/server/connect/demo-graph/seed-demo-graph";

const CHAT_STAGES = new Set(["extraction", "grouping", "validation", "remediation"]);

type ProofData = {
  workspaceId: string | null;
  graphNodeCount: number;
  hasGraph: boolean;
  routes: ChatRouteOption[];
  suggestCacheKey: string;
  proveBase: string;
  /** True when the graph the console answers over is the seeded first-run demo. */
  isDemo: boolean;
  /** Pre-authored demo questions (incl. a deliberate abstention) — first-run fallback. */
  demoQuestions: DemoGraphSuggestedQuestion[];
};

type ProofDataWithState = ProofData & { signedIn: boolean; loadError: boolean };

const SIGNED_OUT: ProofDataWithState = {
  workspaceId: null,
  graphNodeCount: 0,
  hasGraph: false,
  routes: [],
  suggestCacheKey: "",
  proveBase: DASHBOARD_BASE + "/prove",
  isDemo: false,
  demoQuestions: [],
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
  isDemo: false,
  demoQuestions: [],
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

    let [target, stats] = await Promise.all([
      getGraphTargetForUi(wsId).catch(() => null),
      peekConnectGraphStats(wsId).catch(() => null),
    ]);

    // First-run ungate (Phase 3 Stage 1): the Answer Console is the home hero, so a
    // brand-new workspace with no graph must still answer. Idempotently seed the
    // Stage-0 demo graph into the Postgres spine (zero ingest, zero external store)
    // and re-read stats. Best-effort — a seed failure must not break the console.
    let firstRunSeeded = false;
    if (!target || target.status !== "ok" || (stats?.units ?? 0) === 0) {
      try {
        const seedResult = await seedDemoGraph(wsId);
        firstRunSeeded = !seedResult.already_seeded;
        [target, stats] = await Promise.all([
          getGraphTargetForUi(wsId).catch(() => null),
          peekConnectGraphStats(wsId).catch(() => null),
        ]);
      } catch {
        /* seeding is best-effort; fall through to the empty-state UI */
      }
    }

    const graphNodeCount = stats?.units ?? 0;
    const relations = stats?.relations ?? 0;
    const hasGraph = Boolean(target && target.status === "ok" && graphNodeCount > 0);
    // The console is answering over the demo graph when the workspace's only graph
    // is the seeded first-run demo (Postgres-spine, one-click dashboard DB). Used for
    // copy + the suggested-question fallback. Probed once; cheap single-row lookup.
    const isDemo =
      hasGraph &&
      target?.provider === "postgres" &&
      (firstRunSeeded || (await workspaceHasDemoGraph(wsId).catch(() => false)));

    const routes = await resolveChatRoutes(wsId, userId).catch(() => [] as ChatRouteOption[]);
    const demoQuestions = isDemo ? safeDemoQuestions() : [];

    return {
      workspaceId: wsId,
      graphNodeCount,
      hasGraph,
      routes,
      suggestCacheKey: `${wsId}:${graphNodeCount}:${relations}`,
      proveBase: DASHBOARD_BASE + "/prove",
      isDemo,
      demoQuestions,
      signedIn: true,
      loadError: false,
    };
  } catch {
    return LOAD_ERROR;
  }
};

/** Demo seed questions, never throwing — a missing seed must not break the page. */
function safeDemoQuestions(): DemoGraphSuggestedQuestion[] {
  try {
    return demoGraphSuggestedQuestions();
  } catch {
    return [];
  }
}

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
