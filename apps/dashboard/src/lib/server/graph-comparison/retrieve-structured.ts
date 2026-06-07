/**
 * Structured retrieval for the "Proof" comparison panel.
 *
 * Calls the graphrag-core orchestrator directly (rather than the Connect REST contract,
 * whose mapper drops `verification_state`/`verification_category`) so the provenance drawer
 * can render real SUPPORTED/WEAK badges and trust scores. Builds graph deps exactly like
 * `connect-v1/retrieve-service.ts:executeConnectRetrieve`.
 */
import {
  buildContextBlock,
  philosophyRetrievalConfig,
  retrieveContext,
  retrieveContextFromSeed,
  type GraphRagDeps,
  type GraphStore,
  type RetrievalResult,
  type VerificationPolicy,
} from "@restormel/graphrag-core";
import { getConnectGraphTargetForWorkspace } from "$lib/server/neon";
import { buildWorkspaceGraphStore } from "$lib/server/connect/surreal-graph-store";
import { buildGraphRagEmbedder } from "$lib/server/connect/stage-route-generate";
import { resolveWorkspaceRetrievalConfig } from "$lib/server/connect-v1/workspace-retrieval-config";

const emptyGraphStore: GraphStore = {
  async query<T>(_sql: string, _vars?: Record<string, unknown>): Promise<T> {
    return [] as T;
  },
  isDatabaseUnavailable() {
    return false;
  },
};

/** Surface SUPPORTED/WEAK explicitly: opt weak evidence in so the panel can show contested claims. */
export const COMPARISON_VERIFICATION_POLICY: VerificationPolicy = {
  include: ["supported", "weak"],
  excludeFlagged: true,
};

export type StructuredRetrieval = {
  result: RetrievalResult;
  contextBlock: string;
  degraded: boolean;
  degradedReason?: string;
};

export async function retrieveStructured(args: {
  workspaceId: string;
  userId: string;
  projectId?: string | null;
  query: string;
  maxClaims?: number;
  seedClaimIds?: string[];
  /** Override the default supported+weak policy (e.g. include 'unsupported' for suggestions). */
  verificationPolicy?: VerificationPolicy;
}): Promise<StructuredRetrieval> {
  const targetRow = await getConnectGraphTargetForWorkspace(args.workspaceId);
  const hasTarget = Boolean(targetRow);
  const targetSurreal = targetRow?.provider === "surreal";
  const targetOk = targetRow?.status === "ok";

  if (!hasTarget || !targetSurreal || !targetOk) {
    return {
      result: emptyResult(),
      contextBlock: "",
      degraded: true,
      degradedReason: !hasTarget
        ? "No graph store is configured for this workspace yet."
        : !targetSurreal
          ? "Comparison requires a SurrealDB graph target."
          : "Graph store connection is failing or stale.",
    };
  }

  let store: GraphStore = emptyGraphStore;
  try {
    const workspaceStore = await buildWorkspaceGraphStore(args.workspaceId);
    if (workspaceStore) store = workspaceStore;
  } catch {
    return {
      result: emptyResult(),
      contextBlock: "",
      degraded: true,
      degradedReason: "Could not query the configured graph store.",
    };
  }

  let embedder;
  try {
    embedder = await buildGraphRagEmbedder({
      workspaceId: args.workspaceId,
      userId: args.userId,
      projectId: args.projectId ?? null,
    });
  } catch {
    embedder = { embedQuery: async () => [] as number[] };
  }

  // Internal comparison panel retains a config fallback so the "Proof" view still renders when a
  // workspace hasn't selected a pack. The public orchestrator path (graph-orchestrator-service)
  // instead returns 422 domain_pack_required — see I12.
  const config = (await resolveWorkspaceRetrievalConfig(args.workspaceId)) ?? philosophyRetrievalConfig;
  const deps: GraphRagDeps = { store, embedder, resolveOriginBucket: () => "other" };

  const seeds = (args.seedClaimIds ?? []).filter((id) => id.trim().length > 0);
  const options = {
    maxClaims: args.maxClaims,
    config,
    verificationPolicy: args.verificationPolicy ?? COMPARISON_VERIFICATION_POLICY,
    ...(seeds.length > 0 ? { forcedSeedClaimIds: seeds } : {}),
  };

  const result =
    seeds.length > 0
      ? await retrieveContextFromSeed(seeds[0], args.query, deps, options)
      : await retrieveContext(args.query, deps, options);

  return {
    result,
    contextBlock: buildContextBlock(result),
    degraded: result.degraded || result.claims.length === 0,
    degradedReason: result.degraded
      ? result.degraded_reason ?? "No claims were retrieved."
      : result.claims.length === 0
        ? "No verified claims matched this question."
        : undefined,
  };
}

function emptyResult(): RetrievalResult {
  return { claims: [], relations: [], arguments: [], seed_claim_ids: [], degraded: true };
}
