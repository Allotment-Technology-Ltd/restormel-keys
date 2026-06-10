/**
 * Shared Connect Retrieve logic for REST, MCP proxy, and dashboard smoke tests.
 *
 * Unified path (I3): /connect/v1/retrieve now delegates to the RetrievalOrchestrator via
 * executeConnectGraphOp, then maps the orchestrator response back to the legacy
 * ConnectRetrieveResponse contract (shape unchanged). The legacy retrieveContext engine is no
 * longer called directly here — domain-pack-aware config resolution and the 422
 * domain_pack_required behaviour come for free from the orchestrator service.
 */
import {
  CONNECT_API_CONTRACT_VERSION,
  type ConnectGraphOpRequest,
  type ConnectRetrieveRequest,
  type ConnectRetrieveResponse,
} from "@restormel/contracts/connect";
import { getConnectGraphTargetForWorkspace } from "$lib/server/neon";
import type { ConnectV1AuthScope } from "./auth.js";
import { executeConnectGraphOp } from "./graph-orchestrator-service.js";
import {
  buildConnectContextPackFromSubgraph,
  connectGraphSubgraphToGraph,
  mapDegradedCode,
} from "./retrieval-mapper.js";

/** Map the legacy context-pack depth enum onto a numeric traversal depth for the orchestrator. */
const DEPTH_TO_MAX_DEPTH: Record<ConnectRetrieveRequest["depth"] & string, number> = {
  quick: 1,
  standard: 2,
  deep: 3,
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
  const { auth, request, requestId } = args;
  const seed = request.seed_claim_id?.trim();
  const maxDepth = request.depth ? DEPTH_TO_MAX_DEPTH[request.depth] : undefined;

  // Map ConnectRetrieveRequest → ConnectGraphOpRequest (seed present ⇒ expand, else retrieve).
  const graphRequest: ConnectGraphOpRequest = seed
    ? {
        workspace_id: auth.workspaceId,
        ...(auth.projectId ? { project_id: auth.projectId } : {}),
        operation: "expand_context",
        seed_node_ids: [seed],
        ...(maxDepth ? { depth: maxDepth } : {}),
        ...(request.require_verified ? { verification_policy: { include: ["supported"] } } : {}),
      }
    : {
        workspace_id: auth.workspaceId,
        ...(auth.projectId ? { project_id: auth.projectId } : {}),
        operation: "retrieve_context",
        query: request.query,
        ...(request.max_claims ? { top_k: request.max_claims } : {}),
        ...(maxDepth ? { max_depth: maxDepth } : {}),
        ...(request.domain_hint ? { domain: request.domain_hint } : {}),
        ...(request.require_verified ? { verification_policy: { include: ["supported"] } } : {}),
      };

  const outcome = await executeConnectGraphOp({ auth, request: graphRequest, requestId });
  if (!outcome.ok) return outcome; // propagate 422 domain_pack_required / 400 / etc.

  const body = outcome.body;
  const subgraph = body.subgraph;
  const claimsCount = subgraph?.claims.length ?? 0;
  const degraded = body.metadata.retrieval_degraded === true || claimsCount === 0;

  let degradedCode: NonNullable<ConnectRetrieveResponse["metadata"]["retrieval_degraded_code"]> | undefined;
  let degradedReason: string | undefined;
  if (degraded) {
    // Preserve the legacy retrieval_degraded_code/message contract by inspecting the graph target.
    const targetRow = await getConnectGraphTargetForWorkspace(auth.workspaceId);
    degradedCode = mapDegradedCode(
      body.metadata.retrieval_degraded_reason,
      Boolean(targetRow),
      targetRow?.status === "ok",
      targetRow?.provider === "surreal",
    );
    degradedReason = byoDegradedMessage(degradedCode);
  }

  const response: ConnectRetrieveResponse = {
    contract_version: CONNECT_API_CONTRACT_VERSION,
    request_id: requestId,
    ...(body.trace_id ? { trace_id: body.trace_id } : {}),
    context_block: body.context_block ?? "",
    context_pack: degraded || !subgraph ? undefined : buildConnectContextPackFromSubgraph(subgraph, request.depth),
    graph: degraded || !subgraph ? undefined : connectGraphSubgraphToGraph(subgraph),
    // Stage 1.1: verified-claim envelope per returned unit (state, evidence, judge,
    // citation, trace link) — see @restormel/contracts/verified-claim and the EBV ADR.
    ...(body.verified_claims ? { verified_claims: body.verified_claims } : {}),
    metadata: {
      claims_retrieved: claimsCount,
      arguments_retrieved: subgraph?.arguments.length ?? 0,
      ...(body.metadata.verification_summary
        ? { verification_summary: body.metadata.verification_summary }
        : {}),
      retrieval_degraded: degraded,
      retrieval_degraded_reason: degradedReason,
      retrieval_degraded_code: degradedCode,
    },
  };

  return { ok: true, body: response };
}
