/**
 * Token budgeting as a first-class layer.
 *
 * `packContext` deterministically ranks claims by salience and includes them greedily until
 * `maxTokens` is reached — always preserving seed claims and their immediate supporting /
 * contradicting relations. Tokenizer is injected (default: a chars/4 estimate).
 */
import type { RetrievedClaim, RetrievedRelation } from "../retrieve-context.js";

export type Tokenizer = (text: string) => number;

export const defaultTokenizer: Tokenizer = (text) => Math.ceil(text.length / 4);

/** Approximate the per-claim token cost the way the context block renders it. */
export function estimateClaimTokens(claim: RetrievedClaim, tokenizer: Tokenizer): number {
  return tokenizer(`CLAIM (${claim.claim_type}, ${claim.source_title}) ${claim.text}`);
}

export interface PackContextInput {
  claims: RetrievedClaim[];
  relations: RetrievedRelation[];
  seedClaimIds: string[];
  maxTokens: number;
  tokenizer?: Tokenizer;
  /** Relation types whose seed-adjacent neighbours are preserved (default supports/contradicts). */
  priorityRelationTypes?: string[];
}

export interface PackContextResult {
  claims: RetrievedClaim[];
  relations: RetrievedRelation[];
  tokensUsed: number;
  nodesDropped: number;
}

/**
 * Greedy, deterministic context packing. Seeds are never dropped; non-seed claims are
 * admitted in salience order until the budget is exhausted. Relations are re-indexed to the
 * surviving claims.
 */
export function packContext(input: PackContextInput): PackContextResult {
  const tokenizer = input.tokenizer ?? defaultTokenizer;
  const priority = new Set(input.priorityRelationTypes ?? ["supports", "contradicts"]);
  const seedSet = new Set(input.seedClaimIds);
  const idByIndex = input.claims.map((c) => c.id);

  // Claims adjacent to a seed via a priority relation — preserved alongside their seed.
  const seedAdjacent = new Set<string>();
  for (const r of input.relations) {
    if (!priority.has(r.relation_type)) continue;
    const fromId = idByIndex[r.from_index];
    const toId = idByIndex[r.to_index];
    if (fromId === undefined || toId === undefined) continue;
    if (seedSet.has(fromId) && !seedSet.has(toId)) seedAdjacent.add(toId);
    if (seedSet.has(toId) && !seedSet.has(fromId)) seedAdjacent.add(fromId);
  }

  const salience = (c: RetrievedClaim): number => {
    let s = 0;
    if (seedSet.has(c.id)) s += 1_000_000;
    else if (seedAdjacent.has(c.id)) s += 1_000;
    s += c.confidence ?? 0;
    if (c.verification_category === "supported") s += 10;
    if (typeof c.trust_score === "number") s += c.trust_score / 100;
    return s;
  };

  const ranked = input.claims
    .map((claim, index) => ({ claim, index }))
    .sort((a, b) => salience(b.claim) - salience(a.claim));

  const keptOriginalIndices = new Set<number>();
  let tokensUsed = 0;
  for (const { claim, index } of ranked) {
    const cost = estimateClaimTokens(claim, tokenizer);
    const isSeed = seedSet.has(claim.id);
    // Seeds are always kept (even past budget); non-seeds only while they fit.
    if (!isSeed && tokensUsed + cost > input.maxTokens) continue;
    keptOriginalIndices.add(index);
    tokensUsed += cost;
  }

  // Preserve original ordering for readability; rebuild the index remap.
  const keptClaims: RetrievedClaim[] = [];
  const remap = new Map<number, number>();
  input.claims.forEach((claim, oldIndex) => {
    if (!keptOriginalIndices.has(oldIndex)) return;
    remap.set(oldIndex, keptClaims.length);
    keptClaims.push(claim);
  });

  const keptRelations: RetrievedRelation[] = [];
  for (const r of input.relations) {
    const from = remap.get(r.from_index);
    const to = remap.get(r.to_index);
    if (from === undefined || to === undefined) continue;
    keptRelations.push({ ...r, from_index: from, to_index: to });
  }

  return {
    claims: keptClaims,
    relations: keptRelations,
    tokensUsed,
    nodesDropped: input.claims.length - keptClaims.length,
  };
}
