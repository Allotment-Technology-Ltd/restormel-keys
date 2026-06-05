/**
 * Shared Connect Retrieve logic for REST, MCP proxy, and dashboard smoke tests.
 */
import {
  CONNECT_API_CONTRACT_VERSION,
  type ConnectRetrieveRequest,
  type ConnectRetrieveResponse,
} from "@restormel/contracts/connect";
import type { PhilosophicalDomain } from "@restormel/contracts/domains";
import {
  buildContextBlock,
  retrieveContext,
  retrieveContextFromSeed,
  type GraphRagDeps,
  type GraphStore,
  type RetrievalResult,
} from "@restormel/graphrag-core";
import { getConnectGraphTargetForWorkspace } from "$lib/server/neon";
import { buildWorkspaceGraphStore } from "$lib/server/connect/surreal-graph-store";
import { buildGraphRagEmbedder } from "$lib/server/connect/stage-route-generate";
import type { ConnectV1AuthScope } from "./auth.js";
import {
  buildConnectContextPack,
  mapDegradedCode,
  retrievalResultToConnectGraph,
} from "./retrieval-mapper.js";

const emptyGraphStore: GraphStore = {
  async query<T>(_sql: string, _vars?: Record<string, unknown>): Promise<T> {
    return [] as T;
  },
  isDatabaseUnavailable() {
    return false;
  },
};

export type ConnectRetrieveServiceOutcome =
  | { ok: true; body: ConnectRetrieveResponse }
  | { ok: false; status: number; body: Record<string, unknown> };

function byoDegradedMessage(code: NonNullable<ConnectRetrieveResponse["metadata"]["retrieval_degraded_code"]>): string {
  switch (code) {
    case "graph_target_not_configured":
      return "No Bring-Your-Own graph store is configured. Connect SurrealDB in the Connect hub (Pipeline → Graph store) and run a successful connection test.";
    case "graph_target_not_surreal":
      return "Retrieve MVP requires a SurrealDB graph target. Postgres-spine retrieval is not enabled yet.";
    case "graph_target_unreachable":
      return "Graph store connection test failed or is stale. Re-test your Surreal endpoint from the Connect pipeline (must be reachable from Restormel hosted API).";
    case "embedding_unavailable":
      return "Embedding route or provider credentials are unavailable. Publish an ingestion embedding route and add provider keys.";
    case "seed_claim_not_found":
      return "seed_claim_id was not found in the workspace graph.";
    case "graph_store_error":
      return "Could not query the configured graph store.";
    default:
      return "No claims were retrieved. Ingest corpus data into your graph store first.";
  }
}

export async function executeConnectRetrieve(args: {
  auth: ConnectV1AuthScope;
  request: ConnectRetrieveRequest;
  requestId: string;
}): Promise<ConnectRetrieveServiceOutcome> {
  const targetRow = await getConnectGraphTargetForWorkspace(args.auth.workspaceId);
  const hasTarget = Boolean(targetRow);
  const targetSurreal = targetRow?.provider === "surreal";
  const targetOk = targetRow?.status === "ok";

  let store: GraphStore = emptyGraphStore;
  let storeError = false;
  if (hasTarget && targetSurreal && targetOk) {
    try {
      const workspaceStore = await buildWorkspaceGraphStore(args.auth.workspaceId);
      if (workspaceStore) store = workspaceStore;
    } catch {
      storeError = true;
      store = emptyGraphStore;
    }
  }

  let embedder;
  try {
    embedder = await buildGraphRagEmbedder({
      workspaceId: args.auth.workspaceId,
      userId: args.auth.userId,
      projectId: args.auth.projectId,
    });
  } catch {
    embedder = {
      embedQuery: async () => [] as number[],
    };
  }

  const graphRagDeps: GraphRagDeps = {
    store,
    embedder,
    resolveOriginBucket: () => "other",
  };

  const retrievalOptions = {
    maxClaims: args.request.max_claims,
    domain: args.request.domain_hint as PhilosophicalDomain | undefined,
    ...(args.request.seed_claim_id
      ? { forcedSeedClaimIds: [args.request.seed_claim_id] }
      : {}),
  };

  let retrieval: RetrievalResult;
  if (args.request.seed_claim_id?.trim()) {
    retrieval = await retrieveContextFromSeed(
      args.request.seed_claim_id.trim(),
      args.request.query,
      graphRagDeps,
      retrievalOptions,
    );
  } else {
    retrieval = await retrieveContext(args.request.query, graphRagDeps, retrievalOptions);
  }

  const contextBlock = buildContextBlock(retrieval);
  const preDegraded =
    !hasTarget ||
    !targetSurreal ||
    !targetOk ||
    storeError ||
    retrieval.degraded ||
    retrieval.claims.length === 0;

  const degradedCode = mapDegradedCode(
    storeError ? "graph_store_error" : retrieval.degraded_reason,
    hasTarget,
    targetOk,
    targetSurreal,
  );

  const response: ConnectRetrieveResponse = {
    contract_version: CONNECT_API_CONTRACT_VERSION,
    request_id: args.requestId,
    context_block: contextBlock,
    context_pack: preDegraded ? undefined : buildConnectContextPack(retrieval, args.request.depth),
    graph: preDegraded ? undefined : retrievalResultToConnectGraph(retrieval),
    metadata: {
      claims_retrieved: retrieval.claims.length,
      arguments_retrieved: retrieval.arguments.length,
      retrieval_degraded: preDegraded,
      retrieval_degraded_reason: preDegraded ? byoDegradedMessage(degradedCode) : undefined,
      retrieval_degraded_code: preDegraded ? degradedCode : undefined,
    },
  };

  return { ok: true, body: response };
}
