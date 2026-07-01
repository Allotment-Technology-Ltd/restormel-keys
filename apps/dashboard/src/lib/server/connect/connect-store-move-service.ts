/**
 * M3 Store — server orchestration for the non-destructive store move (RES-113 PR-K).
 *
 * Resolves a workspace's target store, runs the strictly read-only node-count probe
 * (store-node-count-probe), builds the non-destructive plan (store-move-plan), and —
 * for an explicit decision — appends an audit row (migration 074). It performs NO
 * customer-store writes and NO cross-store copy: the actual move is ENV-PENDING.
 *
 * Engine resolution:
 *  - postgres — the host-managed Postgres origin (#288); counted via the spine
 *    (getConnectGraphStats.units).
 *  - surreal  — the workspace's saved BYO Surreal graph target; counted via a
 *    read-only SurrealQL count over the HTTP/WS query path.
 *  - neo4j    — the workspace's saved BYO Neo4j store; counted via the adapter's
 *    read-only discoverSchema (graph-store-config.probeSavedNeo4jNodeCount).
 *
 * Gating is enforced by the route (connectHostManagedGraphStore + onboardingJourney);
 * this service assumes it is only reached when the flags are on.
 */
import {
  getConnectGraphStats,
  getConnectGraphTargetById,
  getConnectGraphTargetForWorkspace,
  recordConnectStoreMoveDecision,
} from "$lib/server/neon";
import {
  decryptGraphTargetSecret,
  surrealQuery,
} from "$lib/server/connect/graph-target-service";
import { probeSavedNeo4jNodeCount } from "$lib/server/connect/graph-store-config";
import {
  probeNeo4jNodeCount,
  probePostgresNodeCount,
  probeSurrealNodeCount,
  unreachableProbe,
  type SurrealProbeRunner,
} from "$lib/server/connect/store-node-count-probe";
import {
  assertNonDestructiveStoreMovePlan,
  isTargetEmpty,
  offeredStoreMoveOptions,
  planStoreMove,
  previewStoreMovePlans,
  type StoreMoveEngine,
  type StoreMoveOption,
  type StoreMovePlan,
  type TargetStoreProbeSummary,
} from "$lib/server/connect/store-move-plan";

export type { StoreMoveEngine, StoreMoveOption } from "$lib/server/connect/store-move-plan";

/**
 * Probe the workspace's target store, strictly read-only. `graphTargetId` selects a
 * specific saved Surreal graph (defaults to the workspace's active one).
 */
export async function probeWorkspaceStoreTarget(
  workspaceId: string,
  engine: StoreMoveEngine,
  opts?: { graphTargetId?: string },
): Promise<TargetStoreProbeSummary> {
  if (engine === "postgres") {
    return probePostgresNodeCount(async () => {
      const stats = await getConnectGraphStats(workspaceId);
      return stats.units;
    });
  }

  if (engine === "surreal") {
    const row = opts?.graphTargetId
      ? await getConnectGraphTargetById({ id: opts.graphTargetId, workspaceId })
      : await getConnectGraphTargetForWorkspace(workspaceId);
    if (!row || row.provider !== "surreal" || !row.endpoint || !row.namespace || !row.database) {
      return unreachableProbe("surreal");
    }
    const password = decryptGraphTargetSecret(row);
    const run: SurrealProbeRunner = (sql) =>
      surrealQuery({
        endpoint: row.endpoint!,
        namespace: row.namespace!,
        database: row.database!,
        username: row.username,
        password,
        sql,
      });
    return probeSurrealNodeCount(run);
  }

  // neo4j
  const probe = await probeSavedNeo4jNodeCount(workspaceId);
  if (!probe.ok) return unreachableProbe("neo4j");
  // Route the count through the same parse/summary contract for shape consistency.
  return probeNeo4jNodeCount(async () => ({
    ok: true,
    records: [{ get: (k: string) => (k === "n" ? probe.nodeCount : undefined) }],
  }));
}

export type StoreMoveOverview = {
  probe: TargetStoreProbeSummary;
  targetEmpty: boolean;
  offeredOptions: StoreMoveOption[];
  /** A non-destructive plan preview for each offered option (empty when target empty/unreachable). */
  previews: { option: StoreMoveOption; plan: StoreMovePlan }[];
};

/** Read-only overview: probe + offered options + per-option plan previews. No writes. */
export async function getStoreMoveOverview(
  workspaceId: string,
  engine: StoreMoveEngine,
  opts?: { graphTargetId?: string },
): Promise<StoreMoveOverview> {
  const probe = await probeWorkspaceStoreTarget(workspaceId, engine, opts);
  return {
    probe,
    targetEmpty: probe.reachable && isTargetEmpty(probe),
    offeredOptions: offeredStoreMoveOptions(probe),
    previews: previewStoreMovePlans(probe),
  };
}

export type StoreMoveDecisionResult =
  | {
      ok: true;
      probe: TargetStoreProbeSummary;
      plan: StoreMovePlan;
      decisionId: string | null;
      /** False when migration 074 is pending — the plan is still returned, just not audited. */
      auditPersisted: boolean;
    }
  | { ok: false; status: number; error: string; message: string };

/**
 * Decide a non-destructive store move: re-probe, build + assert the plan, and append
 * an audit row. Does NOT execute the move (env-pending). Re-probing at decide-time
 * (rather than trusting a client-sent count) is deliberate — the empty/non-empty
 * collapse and the offered options must be derived server-side from a fresh read.
 */
export async function decideWorkspaceStoreMove(
  workspaceId: string,
  engine: StoreMoveEngine,
  option: StoreMoveOption,
  opts?: { graphTargetId?: string },
): Promise<StoreMoveDecisionResult> {
  const probe = await probeWorkspaceStoreTarget(workspaceId, engine, opts);

  const planned = planStoreMove(probe, option);
  if (!planned.ok) {
    const status = planned.error === "unreachable" ? 409 : 400;
    return { ok: false, status, error: planned.error, message: planned.message };
  }

  // Defence in depth: never persist or return a plan that breaks the safety contract.
  assertNonDestructiveStoreMovePlan(planned.plan);

  const recorded = await recordConnectStoreMoveDecision({
    workspaceId,
    targetEngine: engine,
    probeNodeCount: probe.nodeCount,
    probeLastWriteAt: probe.lastWriteAt,
    targetWasEmpty: isTargetEmpty(probe),
    chosenOption: option,
    plan: planned.plan,
    // The cross-store copy / read re-point has not run — it is env-pending.
    executionEnvPending:
      planned.plan.envPending.copyExecution || planned.plan.envPending.repointVerification,
  });

  return {
    ok: true,
    probe,
    plan: planned.plan,
    decisionId: recorded?.id ?? null,
    auditPersisted: recorded !== null,
  };
}

/** Summarise the engine for surfacing in the probe label. */
export function describeStoreEngine(engine: StoreMoveEngine): string {
  switch (engine) {
    case "postgres":
      return "host-managed Postgres";
    case "surreal":
      return "SurrealDB";
    case "neo4j":
      return "Neo4j";
  }
}
