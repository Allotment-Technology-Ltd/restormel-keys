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
  type ConnectReadTimeRecheckMetadata,
  type ConnectRetrieveRequest,
  type ConnectRetrieveResponse,
} from "@restormel/contracts/connect";
import { getConnectGraphTargetForWorkspace } from "$lib/server/neon";
import {
  applyReadTimeRecheckToEnvelopes,
  type ResolveClaimRecheck,
} from "$lib/server/connect/read-time-recheck-retrieval";
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
  /**
   * EBV read-time freshness enforcement (docs/decisions/evidence-bound-verification.md §2).
   * Injected by the route so this service stays pure/unit-testable. ABSENT or
   * `enforce: false` ⇒ retrieval is byte-for-byte unchanged (the strict no-op guarantee /
   * flag-OFF path). Only `require_verified` requests are gated.
   */
  readTimeRecheck?: { enforce: boolean; resolve: ResolveClaimRecheck };
}): Promise<ConnectRetrieveServiceOutcome> {
  const { auth, request, requestId } = args;
  const seed = request.seed_claim_id?.trim();
  const maxDepth = request.depth ? DEPTH_TO_MAX_DEPTH[request.depth] : undefined;

  // Stage 3.3: temporal validity passes straight through to the orchestrator op.
  const temporalFields = {
    ...(request.as_of ? { as_of: request.as_of } : {}),
    ...(request.include_superseded ? { include_superseded: true } : {}),
  };

  // Map ConnectRetrieveRequest → ConnectGraphOpRequest (seed present ⇒ expand, else retrieve).
  const graphRequest: ConnectGraphOpRequest = seed
    ? {
        workspace_id: auth.workspaceId,
        ...(auth.projectId ? { project_id: auth.projectId } : {}),
        operation: "expand_context",
        seed_node_ids: [seed],
        ...(maxDepth ? { depth: maxDepth } : {}),
        ...(request.require_verified ? { verification_policy: { include: ["supported"] } } : {}),
        ...temporalFields,
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
        ...temporalFields,
      };

  const outcome = await executeConnectGraphOp({ auth, request: graphRequest, requestId });
  if (!outcome.ok) return outcome; // propagate 422 domain_pack_required / 400 / etc.

  const body = outcome.body;
  const subgraph = body.subgraph;
  const claimsCount = subgraph?.claims.length ?? 0;
  // Stage 3.3: an as_of projection that excluded every claim is a legitimate empty
  // temporal answer ("nothing was valid at that instant"), not a degraded retrieval.
  const temporal = body.metadata.temporal;
  const temporallyEmptied =
    temporal?.applied === true && claimsCount === 0 && (temporal.excluded_claims ?? 0) > 0;
  const degraded =
    body.metadata.retrieval_degraded === true || (claimsCount === 0 && !temporallyEmptied);

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

  // EBV read-time freshness enforcement (ADR §2): for a require_verified retrieval, re-run
  // a fresh deterministic Layer-1 pass over the served supported/inferred claims and demote
  // any whose source version has rotted. Off by default (flag-OFF / no injection) ⇒ the
  // stored verified_claims/summary are used unchanged.
  let verifiedClaims = body.verified_claims;
  let verificationSummary = body.metadata.verification_summary;
  let readTimeRecheck: ConnectReadTimeRecheckMetadata | undefined;
  if (
    args.readTimeRecheck?.enforce &&
    request.require_verified &&
    verifiedClaims &&
    verifiedClaims.length > 0
  ) {
    const applied = await applyReadTimeRecheckToEnvelopes({
      verifiedClaims,
      resolve: args.readTimeRecheck.resolve,
    });
    verifiedClaims = applied.verifiedClaims;
    verificationSummary = applied.verificationSummary;
    readTimeRecheck = {
      applied: applied.summary.applied,
      rechecked: applied.summary.rechecked,
      fresh: applied.summary.fresh,
      demoted: applied.summary.demoted,
      ...(Object.keys(applied.summary.demoted_by_reason).length > 0
        ? { demoted_by_reason: applied.summary.demoted_by_reason }
        : {}),
      // The rendered context_block predates the recheck — flag when it may carry a demoted
      // claim (purging it pre-assembly is the orchestrator's env-pending job).
      ...(applied.demotedIds.length > 0 ? { context_block_stale: true } : {}),
    };
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
    ...(verifiedClaims ? { verified_claims: verifiedClaims } : {}),
    metadata: {
      claims_retrieved: claimsCount,
      arguments_retrieved: subgraph?.arguments.length ?? 0,
      ...(verificationSummary ? { verification_summary: verificationSummary } : {}),
      ...(readTimeRecheck ? { read_time_recheck: readTimeRecheck } : {}),
      // Stage 3.3: temporal-filtering report (as_of/audit), incl. explicit degrades.
      ...(temporal ? { temporal } : {}),
      retrieval_degraded: degraded,
      retrieval_degraded_reason: degradedReason,
      retrieval_degraded_code: degradedCode,
    },
  };

  return { ok: true, body: response };
}
