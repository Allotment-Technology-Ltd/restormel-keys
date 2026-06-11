/**
 * Connect graph orchestrator service — exposes RetrievalOrchestrator's higher-order
 * operations (retrieve / expand / subgraph / paths / summarise) over the workspace graph.
 *
 * The orchestrator runs server-side here (where the BYO graph store + embedder are built);
 * the MCP layer proxies to this via the hosted REST endpoint. Config is resolved per
 * workspace so one endpoint serves any domain pack.
 */
import {
  CONNECT_API_CONTRACT_VERSION,
  type ConnectGraphOpRequest,
  type ConnectGraphOpResponse,
  type ConnectGraphNode,
  type ConnectGraphTraceSummary,
} from "@restormel/contracts/connect";
import {
  RetrievalOrchestrator,
  buildContextBlock,
  type GraphRagDeps,
  type GraphStore,
  type OrchestratorResult,
  type OrchestratorTrace,
  type RetrievalResult,
  type RetrievedClaim,
  type VerificationPolicy,
} from "@restormel/graphrag-core";
import type { VerifiedClaimVersion } from "@restormel/contracts";
import { getConnectGraphTargetForWorkspace } from "$lib/server/neon";
import { buildWorkspaceGraphStore } from "$lib/server/connect/surreal-graph-store";
import { buildGraphRagEmbedder } from "$lib/server/connect/stage-route-generate";
import { getSelectedDomainPackId } from "$lib/server/connect/domain-pack-service";
import { insertProvenanceTrace } from "$lib/server/connect-traces";
import type { ConnectV1AuthScope } from "./auth.js";
import { resolveWorkspaceRetrievalConfig } from "./workspace-retrieval-config.js";
import { buildProvenanceTrace } from "./provenance-trace-builder.js";
import { buildVerifiedClaims, type VerifiedClaimSourceClaim } from "./verified-claims.js";
import { applyTemporalValidity, parseTemporalRequest } from "./temporal-validity.js";

const emptyGraphStore: GraphStore = {
  async query<T>(_sql: string, _vars?: Record<string, unknown>): Promise<T> {
    return [] as T;
  },
  isDatabaseUnavailable() {
    return false;
  },
};

export type ConnectGraphOpServiceOutcome =
  | { ok: true; body: ConnectGraphOpResponse }
  | { ok: false; status: number; body: Record<string, unknown> };

function mapVerificationPolicy(
  policy: ConnectGraphOpRequest["verification_policy"],
): VerificationPolicy | undefined {
  if (!policy) return undefined;
  return {
    include: policy.include,
    minTrustScore: policy.min_trust_score,
    excludeFlagged: policy.exclude_flagged,
  };
}

function toGraphNode(claim: RetrievedClaim): ConnectGraphNode {
  return {
    id: claim.id,
    text: claim.text,
    claim_type: claim.claim_type,
    domain: String(claim.domain),
    source_title: claim.source_title,
    confidence: claim.confidence,
    verification_state: claim.verification_state ?? null,
    trust_score: claim.trust_score ?? null,
    verification_category: claim.verification_category,
  };
}

function toTraceSummary(trace: OrchestratorTrace): ConnectGraphTraceSummary {
  return {
    operation: trace.operation,
    seed_count: trace.seed_count,
    hops: trace.hops,
    claim_count: trace.claim_count,
    relation_count: trace.relation_count,
    tokens_used: trace.tokens_used,
    nodes_dropped: trace.nodes_dropped,
    reasoning_mode: trace.reasoning_mode,
    verification: trace.verification
      ? {
          include: trace.verification.policy.include,
          exclude_flagged: trace.verification.policy.exclude_flagged,
          included: trace.verification.included,
          excluded: trace.verification.excluded,
        }
      : undefined,
    reason: trace.reason,
  };
}

function subgraphResponse(
  request: ConnectGraphOpRequest,
  requestId: string,
  result: OrchestratorResult,
  traceId?: string,
): ConnectGraphOpResponse {
  return {
    contract_version: CONNECT_API_CONTRACT_VERSION,
    request_id: requestId,
    ...(traceId ? { trace_id: traceId } : {}),
    operation: request.operation,
    context_block: result.context_block,
    subgraph: {
      claims: result.subgraph.claims.map(toGraphNode),
      relations: result.subgraph.relations,
      arguments: result.subgraph.arguments.map((a) => ({
        id: a.id,
        name: a.name,
        tradition: a.tradition,
        summary: a.summary,
        conclusion_text: a.conclusion_text,
        key_premises: a.key_premises,
      })),
      seed_claim_ids: result.subgraph.seed_claim_ids,
    },
    trace: toTraceSummary(result.trace),
    metadata: {
      retrieval_degraded: result.trace.degraded,
      retrieval_degraded_reason: result.trace.degraded_reason,
    },
  };
}

export async function executeConnectGraphOp(args: {
  auth: ConnectV1AuthScope;
  request: ConnectGraphOpRequest;
  requestId: string;
}): Promise<ConnectGraphOpServiceOutcome> {
  const { request, requestId } = args;

  // ── Build the workspace graph deps (mirrors Connect Retrieve) ──
  const targetRow = await getConnectGraphTargetForWorkspace(args.auth.workspaceId);
  const hasTarget = Boolean(targetRow);
  const targetSurreal = targetRow?.provider === "surreal";
  const targetOk = targetRow?.status === "ok";

  let store: GraphStore = emptyGraphStore;
  if (hasTarget && targetSurreal && targetOk) {
    try {
      const workspaceStore = await buildWorkspaceGraphStore(args.auth.workspaceId);
      if (workspaceStore) store = workspaceStore;
    } catch {
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
    embedder = { embedQuery: async () => [] as number[] };
  }

  const deps: GraphRagDeps = { store, embedder, resolveOriginBucket: () => "other" };
  const config = await resolveWorkspaceRetrievalConfig(args.auth.workspaceId);
  if (!config) {
    return {
      ok: false,
      status: 422,
      body: {
        error: "domain_pack_required",
        message:
          "This workspace has no domain pack configured. Complete pipeline setup before querying the knowledge graph.",
      },
    };
  }
  const orchestrator = new RetrievalOrchestrator(config, deps);
  const verificationPolicy = mapVerificationPolicy(request.verification_policy);

  // ── Provenance trace context (Stage 4B) ──
  const graphStoreType = targetRow?.provider ?? "none";
  // Trace metadata only — a lookup failure must never break retrieval.
  let domainPack = "unknown";
  try {
    domainPack = (await getSelectedDomainPackId(args.auth.workspaceId)) ?? "unknown";
  } catch {
    domainPack = "unknown";
  }

  /**
   * Build + persist a provenance trace for a subgraph-producing op. Returns the trace_id only
   * when storage succeeds (a returned id is always retrievable). Best-effort: a failure here
   * never breaks the retrieval response — the query simply comes back without a trace_id.
   */
  /**
   * Stage 1.1 — attach a verified-claim envelope per returned unit (state, evidence
   * spans, judge attribution, citation, trace link). Best-effort exposure of persisted
   * EBV data: a failure here never breaks retrieval and can only demote, never promote
   * (see verified-claims.ts). Mutates the response body in place.
   */
  const attachVerifiedClaims = async (
    body: ConnectGraphOpResponse,
    claims: VerifiedClaimSourceClaim[],
    traceId?: string,
    versions?: Map<string, VerifiedClaimVersion>,
  ): Promise<void> => {
    if (claims.length === 0) return;
    try {
      const { envelopes, summary } = await buildVerifiedClaims({
        store,
        unitTable: config.schema.unitTable,
        vocabulary: config.verification,
        claims,
        traceId,
        versions,
      });
      body.verified_claims = envelopes;
      body.metadata.verification_summary = summary;
    } catch {
      // Envelope enrichment is additive — retrieval still answers without it.
    }
  };

  /**
   * Stage 3.3 — temporal validity. When the request carries as_of / include_superseded,
   * project the retrieved subgraph onto the requested instant via the claim-version
   * chains (Postgres spine). Stores without chains (BYO Surreal pre-3.2b) degrade
   * explicitly via metadata.temporal — never silently pretend (see temporal-validity.ts).
   * When the claim set changes, the context block is rebuilt so dropped/superseded
   * content cannot leak into the prompt text.
   */
  const temporalRequest = parseTemporalRequest(request);
  const projectTemporal = async (
    result: OrchestratorResult,
  ): Promise<{
    result: OrchestratorResult;
    versions?: Map<string, VerifiedClaimVersion>;
    metadata?: ConnectGraphOpResponse["metadata"]["temporal"];
  }> => {
    if (!temporalRequest) return { result };
    const outcome = await applyTemporalValidity({
      workspaceId: args.auth.workspaceId,
      provider: targetRow?.provider ?? null,
      subgraph: result.subgraph,
      request: temporalRequest,
    });
    const next: OrchestratorResult = outcome.changed
      ? {
          ...result,
          subgraph: outcome.subgraph,
          context_block: buildContextBlock(
            {
              claims: outcome.subgraph.claims,
              relations: outcome.subgraph.relations,
              arguments: outcome.subgraph.arguments,
              seed_claim_ids: outcome.subgraph.seed_claim_ids,
            } as RetrievalResult,
            config,
          ),
        }
      : { ...result, subgraph: outcome.subgraph };
    return { result: next, versions: outcome.versionsByClaimId, metadata: outcome.metadata };
  };

  const persistTrace = async (
    queryText: string,
    result: OrchestratorResult,
    totalMs: number,
    tokenBudget: number,
  ): Promise<string | undefined> => {
    const traceId = crypto.randomUUID();
    try {
      const trace = buildProvenanceTrace({
        traceId,
        query: queryText,
        workspaceId: args.auth.workspaceId,
        domainPack,
        graphStoreType,
        queriedAt: new Date().toISOString(),
        verificationPolicy,
        tokenBudget,
        result,
        timing: { seedMs: 0, expansionMs: 0, rankingMs: 0, totalMs },
      });
      await insertProvenanceTrace({ trace, projectId: args.auth.projectId });
      return traceId;
    } catch {
      return undefined;
    }
  };

  switch (request.operation) {
    case "retrieve_context": {
      if (!request.query) {
        return { ok: false, status: 400, body: { error: "invalid_request", message: "query is required for retrieve_context" } };
      }
      const startedAt = Date.now();
      const retrieved = await orchestrator.retrieveContext({
        query: request.query,
        topK: request.top_k,
        maxDepth: request.max_depth,
        maxTokens: request.max_tokens,
        domain: request.domain,
        verificationPolicy,
      });
      const { result, versions, metadata: temporal } = await projectTemporal(retrieved);
      const traceId = await persistTrace(request.query, result, Date.now() - startedAt, request.max_tokens ?? 0);
      const body = subgraphResponse(request, requestId, result, traceId);
      if (temporal) body.metadata.temporal = temporal;
      await attachVerifiedClaims(body, result.subgraph.claims, traceId, versions);
      return { ok: true, body };
    }

    case "expand_context": {
      if (!request.seed_node_ids || request.seed_node_ids.length === 0) {
        return { ok: false, status: 400, body: { error: "invalid_request", message: "seed_node_ids is required for expand_context" } };
      }
      const startedAt = Date.now();
      const expanded = await orchestrator.expandContext({
        seedNodeIds: request.seed_node_ids,
        depth: request.depth ?? request.max_depth,
        edgeTypeFiltering: request.edge_types,
        verificationPolicy,
        maxTokens: request.max_tokens,
      });
      const { result, versions, metadata: temporal } = await projectTemporal(expanded);
      const traceId = await persistTrace(request.query ?? "", result, Date.now() - startedAt, request.max_tokens ?? 0);
      const body = subgraphResponse(request, requestId, result, traceId);
      if (temporal) body.metadata.temporal = temporal;
      await attachVerifiedClaims(body, result.subgraph.claims, traceId, versions);
      return { ok: true, body };
    }

    case "find_relevant_subgraph": {
      if (!request.topic) {
        return { ok: false, status: 400, body: { error: "invalid_request", message: "topic is required for find_relevant_subgraph" } };
      }
      const startedAt = Date.now();
      const found = await orchestrator.findRelevantSubgraph({
        topic: request.topic,
        reasoningMode: request.reasoning_mode,
        maxNodes: request.max_nodes,
        verificationPolicy,
        maxTokens: request.max_tokens,
      });
      const { result, versions, metadata: temporal } = await projectTemporal(found);
      const traceId = await persistTrace(request.topic, result, Date.now() - startedAt, request.max_tokens ?? 0);
      const body = subgraphResponse(request, requestId, result, traceId);
      if (temporal) body.metadata.temporal = temporal;
      await attachVerifiedClaims(body, result.subgraph.claims, traceId, versions);
      return { ok: true, body };
    }

    case "find_paths": {
      if (!request.source_node_id || !request.target_node_id) {
        return { ok: false, status: 400, body: { error: "invalid_request", message: "source_node_id and target_node_id are required for find_paths" } };
      }
      const result = await orchestrator.findPaths({
        sourceNodeId: request.source_node_id,
        targetNodeId: request.target_node_id,
        maxHops: request.max_hops,
        edgeTypes: request.edge_types,
      });
      return {
        ok: true,
        body: {
          contract_version: CONNECT_API_CONTRACT_VERSION,
          request_id: requestId,
          operation: request.operation,
          paths: result.paths,
          trace: toTraceSummary(result.trace),
          metadata: {},
        },
      };
    }

    case "summarise_subgraph": {
      // Retrieve a subgraph (from query or seeds), then condense it under the token budget.
      const maxTokens = request.max_tokens ?? 1500;
      const startedAt = Date.now();
      let retrieved: OrchestratorResult;
      if (request.seed_node_ids && request.seed_node_ids.length > 0) {
        retrieved = await orchestrator.expandContext({
          seedNodeIds: request.seed_node_ids,
          depth: request.depth ?? request.max_depth,
          verificationPolicy,
        });
      } else if (request.query || request.topic) {
        retrieved = await orchestrator.retrieveContext({
          query: request.query ?? request.topic ?? "",
          topK: request.top_k,
          maxDepth: request.max_depth,
          verificationPolicy,
        });
      } else {
        return { ok: false, status: 400, body: { error: "invalid_request", message: "summarise_subgraph requires query, topic, or seed_node_ids" } };
      }

      // Stage 3.3: project BEFORE summarising so claims invalid at as_of cannot leak
      // into the condensed context.
      const {
        result: projectedRetrieved,
        versions,
        metadata: temporal,
      } = await projectTemporal(retrieved);
      retrieved = projectedRetrieved;

      const summary = await orchestrator.summariseSubgraph({
        subgraph: retrieved.subgraph,
        maxTokens,
      });

      const summaryTrace = toTraceSummary(retrieved.trace);
      summaryTrace.operation = "summarise_subgraph";
      summaryTrace.tokens_used = summary.tokensUsed;
      summaryTrace.nodes_dropped = summary.nodesDropped;
      summaryTrace.claim_count = summary.nodes.length;
      summaryTrace.relation_count = summary.edges.length;

      const traceId = await persistTrace(
        request.query ?? request.topic ?? "",
        retrieved,
        Date.now() - startedAt,
        maxTokens,
      );

      const body: ConnectGraphOpResponse = {
        contract_version: CONNECT_API_CONTRACT_VERSION,
        request_id: requestId,
        ...(traceId ? { trace_id: traceId } : {}),
        operation: request.operation,
        subgraph: {
          claims: summary.nodes.map(toGraphNode),
          relations: summary.edges,
          arguments: retrieved.subgraph.arguments.map((a) => ({
            id: a.id,
            name: a.name,
            tradition: a.tradition,
            summary: a.summary,
            conclusion_text: a.conclusion_text,
            key_premises: a.key_premises,
          })),
          seed_claim_ids: retrieved.subgraph.seed_claim_ids,
        },
        trace: summaryTrace,
        metadata: {
          retrieval_degraded: retrieved.trace.degraded,
          retrieval_degraded_reason: retrieved.trace.degraded_reason,
          ...(temporal ? { temporal } : {}),
        },
      };
      await attachVerifiedClaims(body, summary.nodes, traceId, versions);
      return { ok: true, body };
    }

    default:
      return { ok: false, status: 400, body: { error: "invalid_operation", message: "Unknown operation" } };
  }
}
