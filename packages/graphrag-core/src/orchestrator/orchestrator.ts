/**
 * RetrievalOrchestrator — the "smart MCP, not dumb pipe" layer.
 *
 * Exposes higher-order, opinionated retrieval operations on top of the engine
 * (Phases 1–2). Every method returns curated, ranked, structured context with a
 * uniform audit trace — never raw rows. Plain class with constructor injection:
 * no SvelteKit, no env reads, no global state, unit-testable in isolation.
 */
import {
  retrieveContext as engineRetrieveContext,
  buildContextBlock,
  type RetrievalResult,
  type RetrievedClaim,
  type RetrievedRelation,
  type RetrievedArgument,
  type RetrievalVerificationSummary,
  type VerificationPolicy,
} from "../retrieve-context.js";
import type { RetrievalConfig, ReasoningClass } from "../config.js";
import type { GraphRagDeps } from "../ports.js";
import { defaultTokenizer, packContext, type Tokenizer } from "./token-budget.js";
import {
  summariseSubgraph,
  type SummariseSubgraphResult,
} from "./summarise.js";

/** Reasoning mode for {@link RetrievalOrchestrator.findRelevantSubgraph}. */
export type ReasoningMode = "semantic" | "causal" | "temporal";

export type { Tokenizer } from "./token-budget.js";

/** Uniform audit envelope returned by every orchestrator operation. */
export interface OrchestratorTrace {
  operation:
    | "retrieve_context"
    | "expand_context"
    | "find_relevant_subgraph"
    | "find_paths";
  seed_count: number;
  hops: number;
  claim_count: number;
  relation_count: number;
  tokens_used: number;
  nodes_dropped: number;
  verification?: RetrievalVerificationSummary;
  reasoning_mode?: ReasoningMode;
  degraded?: boolean;
  degraded_reason?: string;
  /** Set when an operation returns nothing actionable (e.g. no path found). */
  reason?: string;
}

/** Curated, ranked subgraph (the engine's structured output). */
export interface CuratedSubgraph {
  claims: RetrievedClaim[];
  relations: RetrievedRelation[];
  arguments: RetrievedArgument[];
  seed_claim_ids: string[];
  evidence_passages?: RetrievalResult["evidence_passages"];
}

export interface OrchestratorResult {
  context_block: string;
  subgraph: CuratedSubgraph;
  /** Full engine trace, preserved for deep audit. */
  retrieval_trace: RetrievalResult["trace"];
  trace: OrchestratorTrace;
}

export interface RetrievalPathStep {
  relation_type: string;
  from_node_id: string;
  to_node_id: string;
}

export interface RetrievalPath {
  node_ids: string[];
  relations: RetrievalPathStep[];
  /** Product of edge priors along the path (higher = stronger). */
  score: number;
}

export interface FindPathsResult {
  paths: RetrievalPath[];
  trace: OrchestratorTrace;
}

export interface RetrieveContextParams {
  query: string;
  topK?: number;
  maxDepth?: number;
  verificationPolicy?: VerificationPolicy;
  maxTokens?: number;
  domain?: string;
}

export interface ExpandContextParams {
  seedNodeIds: string[];
  depth?: number;
  edgeTypeFiltering?: string[];
  verificationPolicy?: VerificationPolicy;
  maxTokens?: number;
}

export interface FindRelevantSubgraphParams {
  topic: string;
  reasoningMode?: ReasoningMode;
  maxNodes?: number;
  verificationPolicy?: VerificationPolicy;
  maxTokens?: number;
}

export interface FindPathsParams {
  sourceNodeId: string;
  targetNodeId: string;
  maxHops?: number;
  edgeTypes?: string[];
}

const REASONING_BOOST = 1.5;

export class RetrievalOrchestrator {
  private readonly config: RetrievalConfig;
  private readonly deps: GraphRagDeps;
  private readonly tokenizer: Tokenizer;

  constructor(config: RetrievalConfig, deps: GraphRagDeps, tokenizer: Tokenizer = defaultTokenizer) {
    this.config = config;
    this.deps = deps;
    this.tokenizer = tokenizer;
  }

  /** Primary entry point: vector-seeded retrieval, curated and (Phase 4) token-budgeted. */
  async retrieveContext(params: RetrieveContextParams): Promise<OrchestratorResult> {
    const result = await engineRetrieveContext(params.query, this.deps, {
      topK: params.topK,
      maxHops: params.maxDepth,
      domain: params.domain,
      verificationPolicy: params.verificationPolicy,
      config: this.config,
    });
    return this.assemble("retrieve_context", result, params.maxTokens);
  }

  /** Graph expansion from explicit seed nodes — where graph-RAG beats vector-RAG. */
  async expandContext(params: ExpandContextParams): Promise<OrchestratorResult> {
    const config =
      params.edgeTypeFiltering && params.edgeTypeFiltering.length > 0
        ? this.withEdgeFilter(params.edgeTypeFiltering)
        : this.config;
    const result = await engineRetrieveContext("", this.deps, {
      forcedSeedClaimIds: params.seedNodeIds,
      maxHops: params.depth,
      verificationPolicy: params.verificationPolicy,
      config,
    });
    return this.assemble("expand_context", result, params.maxTokens);
  }

  /** Topic-driven subgraph; causal/temporal modes re-weight edge priors by reasoning class. */
  async findRelevantSubgraph(params: FindRelevantSubgraphParams): Promise<OrchestratorResult> {
    const mode = params.reasoningMode ?? "semantic";
    const config = this.withReasoningMode(mode);
    const result = await engineRetrieveContext(params.topic, this.deps, {
      maxClaims: params.maxNodes,
      verificationPolicy: params.verificationPolicy,
      config,
    });
    const out = this.assemble("find_relevant_subgraph", result, params.maxTokens);
    out.trace.reasoning_mode = mode;
    return out;
  }

  /** Condense a retrieved subgraph under a token budget (optionally LLM-summarising clusters). */
  async summariseSubgraph(params: {
    subgraph: CuratedSubgraph;
    maxTokens: number;
    llmCallback?: (cluster: RetrievedClaim[]) => Promise<string>;
  }): Promise<SummariseSubgraphResult> {
    return summariseSubgraph({
      nodes: params.subgraph.claims,
      edges: params.subgraph.relations,
      seedClaimIds: params.subgraph.seed_claim_ids,
      maxTokens: params.maxTokens,
      tokenizer: this.tokenizer,
      llmCallback: params.llmCallback,
    });
  }

  /** Path reasoning between two nodes; ranked paths, or empty with a reason. */
  async findPaths(params: FindPathsParams): Promise<FindPathsResult> {
    const maxHops = Math.max(1, params.maxHops ?? 4);
    const edges = this.config.relations.traversalEdges.filter(
      (e) => !params.edgeTypes || params.edgeTypes.length === 0 || params.edgeTypes.includes(e.table)
    );

    const found: RetrievalPath[] = [];
    let frontier: RetrievalPath[] = [
      { node_ids: [params.sourceNodeId], relations: [], score: 1 },
    ];

    for (let hop = 0; hop < maxHops && frontier.length > 0; hop++) {
      const next: RetrievalPath[] = [];
      for (const path of frontier) {
        const last = path.node_ids[path.node_ids.length - 1];
        const neighbors = await this.neighborsOf(last, edges);
        for (const n of neighbors) {
          if (path.node_ids.includes(n.neighborId)) continue; // acyclic
          const extended: RetrievalPath = {
            node_ids: [...path.node_ids, n.neighborId],
            relations: [
              ...path.relations,
              { relation_type: n.relationType, from_node_id: last, to_node_id: n.neighborId },
            ],
            score: path.score * (n.edgePrior || 1),
          };
          if (n.neighborId === params.targetNodeId) found.push(extended);
          else next.push(extended);
        }
      }
      frontier = next;
    }

    found.sort((a, b) => a.node_ids.length - b.node_ids.length || b.score - a.score);

    const nodeUnion = new Set<string>();
    let relationCount = 0;
    for (const p of found) {
      for (const id of p.node_ids) nodeUnion.add(id);
      relationCount += p.relations.length;
    }

    return {
      paths: found,
      trace: {
        operation: "find_paths",
        seed_count: 2,
        hops: maxHops,
        claim_count: nodeUnion.size,
        relation_count: relationCount,
        tokens_used: 0,
        nodes_dropped: 0,
        ...(found.length === 0
          ? { reason: `no_path_within_${maxHops}_hops` }
          : {}),
      },
    };
  }

  // ── internals ─────────────────────────────────────────────────────────────

  private assemble(
    operation: OrchestratorTrace["operation"],
    result: RetrievalResult,
    maxTokens?: number
  ): OrchestratorResult {
    let claims = result.claims;
    let relations = result.relations;
    let nodesDropped = 0;
    let tokensUsed = 0;

    if (maxTokens !== undefined) {
      const packed = packContext({
        claims,
        relations,
        seedClaimIds: result.seed_claim_ids,
        maxTokens,
        tokenizer: this.tokenizer,
        priorityRelationTypes: ["supports", this.config.relations.contradictionEdge],
      });
      claims = packed.claims;
      relations = packed.relations;
      nodesDropped = packed.nodesDropped;
      tokensUsed = packed.tokensUsed;
    }

    const context_block = buildContextBlock({ ...result, claims, relations }, this.config);
    if (maxTokens === undefined) tokensUsed = this.tokenizer(context_block);

    const trace: OrchestratorTrace = {
      operation,
      seed_count: result.seed_claim_ids.length,
      hops: result.trace?.traversal_max_hops ?? 0,
      claim_count: claims.length,
      relation_count: relations.length,
      tokens_used: tokensUsed,
      nodes_dropped: nodesDropped,
      verification: result.trace?.verification_summary,
      degraded: result.degraded,
      degraded_reason: result.degraded_reason,
    };
    return {
      context_block,
      subgraph: {
        claims,
        relations,
        arguments: result.arguments,
        seed_claim_ids: result.seed_claim_ids,
        evidence_passages: result.evidence_passages,
      },
      retrieval_trace: result.trace,
      trace,
    };
  }

  private withEdgeFilter(tables: string[]): RetrievalConfig {
    const allow = new Set(tables);
    return {
      ...this.config,
      relations: {
        ...this.config.relations,
        traversalEdges: this.config.relations.traversalEdges.filter((e) => allow.has(e.table)),
        fetchEdges: this.config.relations.fetchEdges.filter((e) => allow.has(e.table)),
      },
    };
  }

  private withReasoningMode(mode: ReasoningMode): RetrievalConfig {
    if (mode === "semantic") return this.config;
    // Re-weight edges toward the matching reasoning class (Phase 4). Edges declare their
    // reasoningClass in config; packs without that metadata simply see no re-weighting.
    const target = mode as ReasoningClass;
    const traversalEdges = this.config.relations.traversalEdges.map((e) =>
      e.reasoningClass === target ? { ...e, edgePrior: e.edgePrior * REASONING_BOOST } : e
    );
    return { ...this.config, relations: { ...this.config.relations, traversalEdges } };
  }

  private async neighborsOf(
    nodeId: string,
    edges: RetrievalConfig["relations"]["traversalEdges"]
  ): Promise<Array<{ neighborId: string; relationType: string; edgePrior: number }>> {
    const out: Array<{ neighborId: string; relationType: string; edgePrior: number }> = [];
    for (const edge of edges) {
      const rows = await this.deps.store
        .query<Array<{ in: unknown; out: unknown }>>(
          `SELECT in, out FROM ${edge.table} WHERE in = $node OR out = $node`,
          { node: nodeId }
        )
        .catch(() => [] as Array<{ in: unknown; out: unknown }>);
      for (const row of rows ?? []) {
        const inId = String(row.in);
        const outId = String(row.out);
        if (inId === nodeId && outId !== nodeId) {
          out.push({ neighborId: outId, relationType: edge.table, edgePrior: edge.edgePrior });
        } else if (outId === nodeId && inId !== nodeId) {
          out.push({ neighborId: inId, relationType: edge.table, edgePrior: edge.edgePrior });
        }
      }
    }
    return out;
  }
}
