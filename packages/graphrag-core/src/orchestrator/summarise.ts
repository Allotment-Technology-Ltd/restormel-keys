/**
 * Subgraph condensation — compress a retrieved subgraph to fit a token budget.
 *
 * Strategy: deduplicate near-identical claims, optionally collapse dense clusters of
 * non-seed claims into synthesised nodes via an injected `llmCallback` (model-agnostic;
 * marked synthesised with provenance back to source nodes), then deterministically prune
 * by salience until under budget. With no `llmCallback`, only dedup + pruning run.
 */
import type { RetrievedClaim, RetrievedRelation } from "../retrieve-context.js";
import {
  defaultTokenizer,
  estimateClaimTokens,
  packContext,
  type Tokenizer,
} from "./token-budget.js";

export interface SynthesizedNode extends RetrievedClaim {
  synthesized: true;
  /** Source claim ids this node was synthesised from. */
  provenance: string[];
}

export type CondensedNode = RetrievedClaim & { synthesized?: boolean; provenance?: string[] };

export interface SummariseSubgraphInput {
  nodes: RetrievedClaim[];
  edges: RetrievedRelation[];
  maxTokens: number;
  seedClaimIds?: string[];
  tokenizer?: Tokenizer;
  /** Injected, model-agnostic summariser for dense clusters. */
  llmCallback?: (cluster: RetrievedClaim[]) => Promise<string>;
  /** Similarity threshold for near-identical dedup (default 0.82). */
  dedupeThreshold?: number;
  /** Similarity threshold for cluster collapse (default 0.55). */
  clusterThreshold?: number;
}

export interface SummariseSubgraphResult {
  nodes: CondensedNode[];
  edges: RetrievedRelation[];
  tokensUsed: number;
  nodesDropped: number;
  synthesizedCount: number;
}

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^\w\s-]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length > 2)
  );
}

function similarity(a: string, b: string): number {
  const sa = tokenize(a);
  const sb = tokenize(b);
  if (sa.size === 0 || sb.size === 0) return 0;
  let overlap = 0;
  for (const t of sa) if (sb.has(t)) overlap += 1;
  return overlap / Math.max(sa.size, sb.size);
}

export async function summariseSubgraph(
  input: SummariseSubgraphInput
): Promise<SummariseSubgraphResult> {
  const tokenizer = input.tokenizer ?? defaultTokenizer;
  const seedSet = new Set(input.seedClaimIds ?? []);
  const dedupeThreshold = input.dedupeThreshold ?? 0.82;
  const clusterThreshold = input.clusterThreshold ?? 0.55;

  const nodeById = new Map<string, RetrievedClaim>();
  for (const n of input.nodes) nodeById.set(n.id, n);

  // id -> id redirection (dedup target or synthesised node).
  const redirect = new Map<string, string>();
  const resolve = (id: string): string => {
    let cur = id;
    const seen = new Set<string>();
    while (redirect.has(cur) && !seen.has(cur)) {
      seen.add(cur);
      cur = redirect.get(cur)!;
    }
    return cur;
  };

  const salience = (c: RetrievedClaim): number =>
    (seedSet.has(c.id) ? 1000 : 0) +
    (c.confidence ?? 0) +
    (c.verification_category === "supported" ? 1 : 0);

  // ── 1. Deduplicate near-identical claims (keep the most salient) ──
  const survivors: RetrievedClaim[] = [];
  for (const node of [...input.nodes].sort((a, b) => salience(b) - salience(a))) {
    const dup = survivors.find((s) => similarity(s.text, node.text) >= dedupeThreshold);
    if (dup && !seedSet.has(node.id)) {
      redirect.set(node.id, dup.id);
    } else {
      survivors.push(node);
    }
  }

  // ── 2. Optional cluster collapse into synthesised nodes ──
  const synthesized: SynthesizedNode[] = [];
  if (input.llmCallback) {
    const collapsible = survivors.filter((n) => !seedSet.has(n.id));
    const used = new Set<string>();
    let synthCounter = 0;
    for (const anchor of collapsible) {
      if (used.has(anchor.id)) continue;
      const cluster = collapsible.filter(
        (n) => !used.has(n.id) && (n.id === anchor.id || similarity(anchor.text, n.text) >= clusterThreshold)
      );
      if (cluster.length < 2) continue;
      for (const member of cluster) used.add(member.id);
      const synthId = `synth:${++synthCounter}`;
      const text = await input.llmCallback(cluster);
      const base = cluster[0];
      const node: SynthesizedNode = {
        id: synthId,
        text,
        claim_type: base.claim_type,
        domain: base.domain,
        source_title: "synthesised",
        source_author: [],
        confidence: Math.max(...cluster.map((c) => c.confidence ?? 0)),
        position_in_source: 0,
        verification_state: null,
        trust_score: null,
        verification_category: "weak",
        synthesized: true,
        provenance: cluster.map((c) => c.id),
      };
      synthesized.push(node);
      for (const member of cluster) redirect.set(member.id, synthId);
    }
  }

  // ── 3. Assemble surviving node set (non-redirected survivors + synthesised) ──
  const finalNodes: CondensedNode[] = [
    ...survivors.filter((n) => !redirect.has(n.id)),
    ...synthesized,
  ];

  // ── 4. Re-index edges through the redirect map; drop self/duplicate/missing ──
  const idByIndex = input.nodes.map((n) => n.id);
  const finalIndexById = new Map(finalNodes.map((n, i) => [n.id, i]));
  const seenEdge = new Set<string>();
  const finalEdges: RetrievedRelation[] = [];
  for (const e of input.edges) {
    const fromId = idByIndex[e.from_index];
    const toId = idByIndex[e.to_index];
    if (fromId === undefined || toId === undefined) continue;
    const from = finalIndexById.get(resolve(fromId));
    const to = finalIndexById.get(resolve(toId));
    if (from === undefined || to === undefined || from === to) continue;
    const key = `${from}|${to}|${e.relation_type}`;
    if (seenEdge.has(key)) continue;
    seenEdge.add(key);
    finalEdges.push({ ...e, from_index: from, to_index: to });
  }

  // ── 5. Deterministic prune to budget (seeds preserved) ──
  const packed = packContext({
    claims: finalNodes,
    relations: finalEdges,
    seedClaimIds: input.seedClaimIds ?? [],
    maxTokens: input.maxTokens,
    tokenizer,
  });

  // Carry synthesised markers through packing (packContext returns RetrievedClaim refs).
  const prunedNodes = packed.claims as CondensedNode[];
  const tokensUsed = prunedNodes.reduce((sum, n) => sum + estimateClaimTokens(n, tokenizer), 0);

  return {
    nodes: prunedNodes,
    edges: packed.relations,
    tokensUsed,
    nodesDropped: input.nodes.length - prunedNodes.filter((n) => !n.synthesized).length,
    synthesizedCount: prunedNodes.filter((n) => n.synthesized).length,
  };
}
