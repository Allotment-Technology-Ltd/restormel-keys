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
import { listApiKeys } from "$lib/server/neon";
import { DEFAULT_CONNECT_API_BASE } from "$lib/connect/get-code-snippet";
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
  /** Project scope for the "Get Code" snippet (matches the Gateway key project). Null when unresolved. */
  projectId: string | null;
  /** Non-secret Gateway key prefix (`rk_xxxxxxxx…`) shown as a hint in "Get Code". Never the full key. */
  keyPrefixHint: string | null;
  /** Public Connect API origin for the "Get Code" snippet. */
  connectApiBase: string;
  /**
   * RES-113 onboardingJourney flag (REC-ADR-021). Gates the M0 "Explore" hero reskin
   * of the Answer Console. Default off ⇒ the shipped console is unchanged.
   */
  onboardingJourney: boolean;
  /**
   * RES-113 PR-3 (flag-ON only): a question handed off from Home's ask box via
   * `?q=` — the console asks it on mount so the user never re-types what they
   * already gave (WCAG 3.3.7). Always null with the flag OFF (inert).
   */
  initialQuestion: string | null;
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
  projectId: null,
  keyPrefixHint: null,
  connectApiBase: DEFAULT_CONNECT_API_BASE,
  onboardingJourney: false,
  initialQuestion: null,
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
  projectId: null,
  keyPrefixHint: null,
  connectApiBase: DEFAULT_CONNECT_API_BASE,
  onboardingJourney: false,
  initialQuestion: null,
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

    const chat = await resolveChatRoutes(wsId, userId).catch(
      () => ({ routes: [] as ChatRouteOption[], projectId: null as string | null }),
    );
    const demoQuestions = isDemo ? safeDemoQuestions() : [];

    // "Get Code" snippet inputs (Phase 3 Stage 2). The Gateway key's RAW value is
    // never recoverable (hashed at rest) — only the non-secret prefix is surfaced,
    // and only as a hint. listApiKeys is project-scoped + parameterised; it selects
    // key_prefix only (never key_hash). Best-effort: a key lookup failure must not
    // break the console.
    const keyPrefixHint = chat.projectId
      ? await firstKeyPrefix(chat.projectId, userId).catch(() => null)
      : null;

    return {
      workspaceId: wsId,
      graphNodeCount,
      hasGraph,
      routes: chat.routes,
      suggestCacheKey: `${wsId}:${graphNodeCount}:${relations}`,
      proveBase: DASHBOARD_BASE + "/prove",
      isDemo,
      demoQuestions,
      projectId: chat.projectId,
      keyPrefixHint,
      connectApiBase: resolveConnectApiBase(event.url.origin),
      onboardingJourney: event.locals.moduleFlags?.onboardingJourney ?? false,
      // RES-113 PR-3 (flag-ON only): the `?q=` Home ask-box handoff; null flag-OFF.
      initialQuestion: event.locals.moduleFlags?.onboardingJourney
        ? (event.url.searchParams.get("q")?.trim() || null)
        : null,
      signedIn: true,
      loadError: false,
    };
  } catch {
    return LOAD_ERROR;
  }
};

/**
 * Public Connect API origin for the "Get Code" snippet. Prefer the current request
 * origin (so a non-prod / preview host produces a working snippet), falling back to
 * the canonical prod origin when the origin is unusable.
 */
function resolveConnectApiBase(origin: string | undefined): string {
  const o = (origin ?? "").trim();
  if (o && /^https?:\/\//.test(o)) return o.replace(/\/+$/, "");
  return DEFAULT_CONNECT_API_BASE;
}

/**
 * The most-recent Gateway key PREFIX for a project, or null. Non-secret: the data
 * layer (listApiKeys) selects key_prefix only — key_hash is never read. Used purely
 * as a "which key" hint in the snippet, never as the live credential.
 */
async function firstKeyPrefix(projectId: string, userId: string): Promise<string | null> {
  const keys = await listApiKeys(projectId, userId);
  return keys[0]?.keyPrefix ?? null;
}

/** Demo seed questions, never throwing — a missing seed must not break the page. */
function safeDemoQuestions(): DemoGraphSuggestedQuestion[] {
  try {
    return demoGraphSuggestedQuestions();
  } catch {
    return [];
  }
}

async function resolveChatRoutes(
  workspaceId: string,
  userId: string,
): Promise<{ routes: ChatRouteOption[]; projectId: string | null }> {
  const ctx = await resolveKnowledgeRouteExecutionContext({ workspaceId, userId });
  if (!ctx) return { routes: [], projectId: null };

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
  return { routes: [...byId.values()], projectId: ctx.projectId };
}
