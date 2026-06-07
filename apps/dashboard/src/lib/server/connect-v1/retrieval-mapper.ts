/**
 * Maps graphrag RetrievalResult → Connect REST + context-packs shapes.
 */
import { buildPassSpecificContextPacks } from "@restormel/context-packs";
import type { ContextPackRetrievalInput } from "@restormel/context-packs";
import type {
  ConnectContextPack,
  ConnectGraphOpResponse,
  ConnectRetrieveDepth,
  ConnectRetrieveGraph,
  ConnectRetrieveResponse,
} from "@restormel/contracts/connect";
import type { RetrievalResult } from "@restormel/graphrag-core";

/** The curated subgraph shape returned by the orchestrator (graph op response). */
type ConnectGraphSubgraph = NonNullable<ConnectGraphOpResponse["subgraph"]>;

export function retrievalResultToContextPackInput(result: RetrievalResult): ContextPackRetrievalInput {
  const claims = result.claims.map((c) => ({
    id: c.id,
    text: c.text,
    claim_type: c.claim_type,
    source_title: c.source_title,
    confidence: c.confidence,
  }));
  const relations = result.relations.map((r) => ({
    from_index: r.from_index,
    to_index: r.to_index,
    relation_type: r.relation_type,
  }));
  const arguments_ = result.arguments.map((a) => ({
    name: a.name,
    tradition: a.tradition,
    summary: a.summary,
    key_premises: a.key_premises,
    conclusion_text: a.conclusion_text ?? undefined,
  }));
  return {
    claims,
    relations,
    arguments: arguments_,
    seed_claim_ids: result.seed_claim_ids,
  };
}

export function retrievalResultToConnectGraph(result: RetrievalResult): ConnectRetrieveGraph {
  return {
    claims: result.claims.map((c) => ({
      id: c.id,
      text: c.text,
      claim_type: c.claim_type,
      domain: String(c.domain),
      source_title: c.source_title,
      confidence: c.confidence,
    })),
    relations: result.relations.map((r) => ({
      from_index: r.from_index,
      to_index: r.to_index,
      relation_type: r.relation_type,
    })),
    arguments: result.arguments.map((a) => ({
      id: a.id,
      name: a.name,
      tradition: a.tradition,
      summary: a.summary,
      conclusion_text: a.conclusion_text,
      key_premises: a.key_premises,
    })),
    seed_claim_ids: result.seed_claim_ids,
  };
}

export function buildConnectContextPack(
  result: RetrievalResult,
  depth: ConnectRetrieveDepth | undefined,
): ConnectContextPack {
  const packs = buildPassSpecificContextPacks(retrievalResultToContextPackInput(result), {
    depthMode: depth ?? "standard",
  });
  return {
    analysis: { block: packs.analysis.block, stats: packs.analysis.stats },
    critique: { block: packs.critique.block, stats: packs.critique.stats },
    synthesis: { block: packs.synthesis.block, stats: packs.synthesis.stats },
  };
}

/**
 * Map an orchestrator subgraph (from POST /connect/v1/graph) back to the legacy
 * ConnectRetrieveGraph shape. Drops the graph-only verification fields so the
 * /connect/v1/retrieve response contract is unchanged after unification (I3).
 */
export function connectGraphSubgraphToGraph(subgraph: ConnectGraphSubgraph): ConnectRetrieveGraph {
  return {
    claims: subgraph.claims.map((c) => ({
      id: c.id,
      text: c.text,
      claim_type: c.claim_type,
      domain: c.domain,
      source_title: c.source_title,
      confidence: c.confidence,
    })),
    relations: subgraph.relations.map((r) => ({
      from_index: r.from_index,
      to_index: r.to_index,
      relation_type: r.relation_type,
    })),
    arguments: subgraph.arguments.map((a) => ({
      id: a.id,
      name: a.name,
      tradition: a.tradition,
      summary: a.summary,
      conclusion_text: a.conclusion_text,
      key_premises: a.key_premises,
    })),
    seed_claim_ids: subgraph.seed_claim_ids,
  };
}

/** Build the analysis/critique/synthesis context pack from an orchestrator subgraph. */
export function buildConnectContextPackFromSubgraph(
  subgraph: ConnectGraphSubgraph,
  depth: ConnectRetrieveDepth | undefined,
): ConnectContextPack {
  const input: ContextPackRetrievalInput = {
    claims: subgraph.claims.map((c) => ({
      id: c.id,
      text: c.text,
      claim_type: c.claim_type,
      source_title: c.source_title,
      confidence: c.confidence,
    })),
    relations: subgraph.relations.map((r) => ({
      from_index: r.from_index,
      to_index: r.to_index,
      relation_type: r.relation_type,
    })),
    arguments: subgraph.arguments.map((a) => ({
      name: a.name,
      tradition: a.tradition,
      summary: a.summary,
      key_premises: a.key_premises,
      conclusion_text: a.conclusion_text ?? undefined,
    })),
    seed_claim_ids: subgraph.seed_claim_ids,
  };
  const packs = buildPassSpecificContextPacks(input, { depthMode: depth ?? "standard" });
  return {
    analysis: { block: packs.analysis.block, stats: packs.analysis.stats },
    critique: { block: packs.critique.block, stats: packs.critique.stats },
    synthesis: { block: packs.synthesis.block, stats: packs.synthesis.stats },
  };
}

export function mapDegradedCode(
  reason: string | undefined,
  hasTarget: boolean,
  targetOk: boolean,
  targetSurreal: boolean,
): NonNullable<ConnectRetrieveResponse["metadata"]["retrieval_degraded_code"]> {
  if (!hasTarget) return "graph_target_not_configured";
  if (!targetSurreal) return "graph_target_not_surreal";
  if (!targetOk) return "graph_target_unreachable";
  if (reason === "embedding_unavailable") return "embedding_unavailable";
  if (reason === "seed_claim_not_found") return "seed_claim_not_found";
  if (reason === "graph_store_error") return "graph_store_error";
  return "no_claims";
}
