import type { HybridCandidate } from "./hybrid-candidate-generation.js";
import {
  computeKgBalanceMultiplier,
  type RetrievalOriginBalanceKey,
} from "./kg-balance.js";

/** Role identifier — a plain string so hosts can define their own role taxonomy. */
export type SeedRole = string;

/**
 * Domain-supplied seed-role taxonomy. The default (`DEFAULT_SEED_ROLES`) reproduces SOPHIA's
 * support / objection / reply / definition_distinction model; a host can pass any role set.
 */
export interface SeedRoleConfig {
  /** Roles in priority order (first is treated as the primary / majority role). */
  order: SeedRole[];
  /** Classify a candidate into one of `order`. */
  classify: (candidate: { claim_type: string; text: string }) => SeedRole;
  /** Target quota per role for a given topK. */
  defaultQuotas: (topK: number) => Record<SeedRole, number>;
  /** Two roles whose joint presence signals a balanced (non-mono) perspective. */
  diversityPair: [SeedRole, SeedRole];
}

export interface SeedCandidate extends HybridCandidate {
  claim_type: string;
  embedding?: number[] | null;
  /** Optional: used by inquiry-time KG balance (retrieval). */
  domain?: string;
  source_url?: string | null;
  source_source_type?: string | null;
}

export interface SeedBalanceStats {
  selection_strategy: 'mmr_quota_v1' | 'mmr_quota_kg_balance_v1';
  mmr_lambda: number;
  role_counts_pool: Record<SeedRole, number>;
  role_counts_selected: Record<SeedRole, number>;
  role_quotas: Record<SeedRole, number>;
  quota_satisfied_roles: SeedRole[];
  avg_pairwise_similarity_before: number;
  avg_pairwise_similarity_after: number;
  objection_reply_presence_before: boolean;
  objection_reply_presence_after: boolean;
  mono_perspective_before: boolean;
  mono_perspective_after: boolean;
  /** Present when retrieval applies ideal SEP/Gutenberg/domain balance (not DB snapshot metrics). */
  kg_balance?: {
    ideal_origin: Record<RetrievalOriginBalanceKey, number>;
    selected_origin_counts: Record<RetrievalOriginBalanceKey, number>;
    domains_in_pool: string[];
    selected_domain_counts: Record<string, number>;
  };
}

export interface SeedSetConstructionResult<T extends SeedCandidate> {
  seeds: T[];
  stats: SeedBalanceStats;
}

function normalizeText(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

/** SOPHIA's philosophy seed-role taxonomy (the default when a host supplies none). */
export const DEFAULT_SEED_ROLES: SeedRoleConfig = {
  order: ['support', 'objection', 'reply', 'definition_distinction'],
  classify: (candidate) => {
    const claimType = candidate.claim_type.toLowerCase();
    if (claimType === 'objection') return 'objection';
    if (claimType === 'response' || claimType === 'reply') return 'reply';
    if (claimType === 'definition' || normalizeText(candidate.text).includes('distinction')) {
      return 'definition_distinction';
    }
    return 'support';
  },
  defaultQuotas: (topK) => {
    const quotas: Record<SeedRole, number> = {
      support: 0,
      objection: 0,
      reply: 0,
      definition_distinction: 0,
    };
    if (topK >= 4) {
      quotas.support = 1;
      quotas.objection = 1;
      quotas.reply = 1;
      quotas.definition_distinction = 1;
      quotas.support += topK - 4;
    } else if (topK === 3) {
      quotas.support = 1;
      quotas.objection = 1;
      quotas.reply = 1;
    } else if (topK === 2) {
      quotas.support = 1;
      quotas.objection = 1;
    } else {
      quotas.support = 1;
    }
    return quotas;
  },
  diversityPair: ['objection', 'reply'],
};

function cosineSimilarity(a?: number[] | null, b?: number[] | null): number {
  if (!a || !b || a.length === 0 || b.length === 0 || a.length !== b.length) return 0;
  let dot = 0;
  let aNorm = 0;
  let bNorm = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    aNorm += a[i] * a[i];
    bNorm += b[i] * b[i];
  }
  if (aNorm === 0 || bNorm === 0) return 0;
  return dot / (Math.sqrt(aNorm) * Math.sqrt(bNorm));
}

function tokenOverlapSimilarity(aText: string, bText: string): number {
  const aSet = new Set(normalizeText(aText));
  const bSet = new Set(normalizeText(bText));
  if (aSet.size === 0 || bSet.size === 0) return 0;
  let overlap = 0;
  for (const token of aSet) {
    if (bSet.has(token)) overlap += 1;
  }
  return overlap / Math.max(aSet.size, bSet.size);
}

function pairwiseSimilarity(a: SeedCandidate, b: SeedCandidate): number {
  const vectorSim = cosineSimilarity(a.embedding, b.embedding);
  if (vectorSim > 0) return vectorSim;
  return tokenOverlapSimilarity(a.text, b.text);
}

function makeEmptyRoleCounts(order: SeedRole[]): Record<SeedRole, number> {
  const counts: Record<SeedRole, number> = {};
  for (const role of order) counts[role] = 0;
  return counts;
}

function makeEmptyOriginCounts(): Record<RetrievalOriginBalanceKey, number> {
  return { sep: 0, gutenberg: 0, other: 0 };
}

function averagePairwiseSimilarity(candidates: SeedCandidate[]): number {
  if (candidates.length < 2) return 0;
  let sum = 0;
  let pairs = 0;
  for (let i = 0; i < candidates.length; i++) {
    for (let j = i + 1; j < candidates.length; j++) {
      sum += pairwiseSimilarity(candidates[i], candidates[j]);
      pairs += 1;
    }
  }
  return pairs === 0 ? 0 : sum / pairs;
}

function hasDiversityPresence(
  roleCounts: Record<SeedRole, number>,
  pair: [SeedRole, SeedRole]
): boolean {
  return (roleCounts[pair[0]] ?? 0) > 0 && (roleCounts[pair[1]] ?? 0) > 0;
}

function isMonoPerspective(
  roleCounts: Record<SeedRole, number>,
  total: number,
  order: SeedRole[]
): boolean {
  if (total === 0) return true;
  const primary = order[0];
  const primaryCount = roleCounts[primary] ?? 0;
  const maxCount = Math.max(0, ...order.map((role) => roleCounts[role] ?? 0));
  return primaryCount >= total || maxCount >= total * 0.85;
}

function adaptQuotasToPool(
  quotas: Record<SeedRole, number>,
  poolCounts: Record<SeedRole, number>,
  topK: number,
  order: SeedRole[]
): Record<SeedRole, number> {
  const adapted: Record<SeedRole, number> = { ...quotas };
  let used = 0;
  for (const role of order) {
    adapted[role] = Math.min(adapted[role] ?? 0, poolCounts[role] ?? 0);
    used += adapted[role];
  }
  if (used >= topK) return adapted;

  while (used < topK) {
    let topped = false;
    for (const role of order) {
      if ((adapted[role] ?? 0) < (poolCounts[role] ?? 0)) {
        adapted[role] = (adapted[role] ?? 0) + 1;
        used += 1;
        topped = true;
        if (used >= topK) break;
      }
    }
    if (!topped) break;
  }
  return adapted;
}

function relevanceToQuery(candidate: SeedCandidate, queryEmbedding?: number[]): number {
  const vectorSim = cosineSimilarity(candidate.embedding, queryEmbedding ?? null);
  if (vectorSim > 0) return vectorSim;
  return Math.max(0, candidate.confidence);
}

export function constructSeedSet<T extends SeedCandidate>(params: {
  candidates: T[];
  topK: number;
  queryEmbedding?: number[];
  mmrLambda?: number;
  /** Seed-role taxonomy (defaults to SOPHIA's philosophy roles). */
  roles?: SeedRoleConfig;
  /**
   * Optional inquiry-time balance: ideal origin mix + uniform domain targets among domains
   * present in the candidate pool (see `kg-balance.ts`).
   */
  kgBalance?: {
    idealOrigin: Record<RetrievalOriginBalanceKey, number>;
    domainsInPool: Set<string>;
    getOrigin: (c: T) => RetrievalOriginBalanceKey;
    getDomainKey: (c: T) => string;
    originStrength?: number;
    domainStrength?: number;
  };
}): SeedSetConstructionResult<T> {
  const { candidates, topK, queryEmbedding, mmrLambda = 0.72, kgBalance } = params;
  const roles = params.roles ?? DEFAULT_SEED_ROLES;
  const roleOrder = roles.order;
  const cappedCandidates = candidates.slice(0, Math.max(topK * 4, topK));
  const targetSize = Math.min(topK, cappedCandidates.length);
  const roleCountsPool = makeEmptyRoleCounts(roleOrder);
  const candidateRole = new Map<string, SeedRole>();
  for (const candidate of cappedCandidates) {
    const role = roles.classify(candidate);
    candidateRole.set(candidate.id, role);
    roleCountsPool[role] = (roleCountsPool[role] ?? 0) + 1;
  }

  const defaultQuotas = roles.defaultQuotas(targetSize);
  const adaptedQuotas = adaptQuotasToPool(defaultQuotas, roleCountsPool, targetSize, roleOrder);
  const selected: T[] = [];
  const selectedIds = new Set<string>();
  const roleCountsSelected = makeEmptyRoleCounts(roleOrder);
  const selectedOriginCounts = makeEmptyOriginCounts();
  const selectedDomainCounts = new Map<string, number>();
  const relevanceById = new Map<string, number>();
  for (const candidate of cappedCandidates) {
    relevanceById.set(candidate.id, relevanceToQuery(candidate, queryEmbedding));
  }

  while (selected.length < targetSize) {
    const remaining = cappedCandidates.filter((candidate) => !selectedIds.has(candidate.id));
    if (remaining.length === 0) break;

    const unmetRoles = roleOrder.filter(
      (role) => (roleCountsSelected[role] ?? 0) < (adaptedQuotas[role] ?? 0)
    );
    const roleRestricted =
      unmetRoles.length > 0
        ? remaining.filter((candidate) => unmetRoles.includes(candidateRole.get(candidate.id) ?? roleOrder[0]))
        : remaining;
    const pool = roleRestricted.length > 0 ? roleRestricted : remaining;

    let best: T | null = null;
    let bestScore = Number.NEGATIVE_INFINITY;
    const totalSel = selected.length;
    for (const candidate of pool) {
      const relevance = relevanceById.get(candidate.id) ?? 0;
      let maxSimilarity = 0;
      for (const chosen of selected) {
        maxSimilarity = Math.max(maxSimilarity, pairwiseSimilarity(candidate, chosen));
      }
      let balanceMult = 1;
      if (kgBalance && totalSel > 0) {
        balanceMult = computeKgBalanceMultiplier({
          origin: kgBalance.getOrigin(candidate),
          domain: kgBalance.getDomainKey(candidate),
          selectedOriginCounts,
          selectedDomainCounts,
          totalSelected: totalSel,
          idealOrigin: kgBalance.idealOrigin,
          domainsInPool: kgBalance.domainsInPool,
          ...(kgBalance.originStrength !== undefined ? { originStrength: kgBalance.originStrength } : {}),
          ...(kgBalance.domainStrength !== undefined ? { domainStrength: kgBalance.domainStrength } : {}),
        });
      } else if (kgBalance && totalSel === 0) {
        balanceMult = 1;
      }
      const score = mmrLambda * relevance * balanceMult - (1 - mmrLambda) * maxSimilarity;
      if (score > bestScore) {
        best = candidate;
        bestScore = score;
      }
    }

    if (!best) break;
    selected.push(best);
    selectedIds.add(best.id);
    const role = candidateRole.get(best.id) ?? roleOrder[0];
    roleCountsSelected[role] = (roleCountsSelected[role] ?? 0) + 1;
    if (kgBalance) {
      const o = kgBalance.getOrigin(best);
      selectedOriginCounts[o] += 1;
      const dk = kgBalance.getDomainKey(best);
      selectedDomainCounts.set(dk, (selectedDomainCounts.get(dk) ?? 0) + 1);
    }
  }

  const baseline = cappedCandidates.slice(0, targetSize);
  const baselineRoleCounts = makeEmptyRoleCounts(roleOrder);
  for (const candidate of baseline) {
    const role = candidateRole.get(candidate.id) ?? roleOrder[0];
    baselineRoleCounts[role] = (baselineRoleCounts[role] ?? 0) + 1;
  }

  const quotaSatisfiedRoles = roleOrder.filter(
    (role) => (roleCountsSelected[role] ?? 0) >= (adaptedQuotas[role] ?? 0)
  );

  const kgStats =
    kgBalance && selected.length > 0
      ? {
          ideal_origin: { ...kgBalance.idealOrigin },
          selected_origin_counts: { ...selectedOriginCounts },
          domains_in_pool: [...kgBalance.domainsInPool].sort(),
          selected_domain_counts: Object.fromEntries(
            [...selectedDomainCounts.entries()].sort((a, b) => a[0].localeCompare(b[0]))
          ),
        }
      : undefined;

  return {
    seeds: selected,
    stats: {
      selection_strategy: kgBalance ? 'mmr_quota_kg_balance_v1' : 'mmr_quota_v1',
      mmr_lambda: mmrLambda,
      role_counts_pool: roleCountsPool,
      role_counts_selected: roleCountsSelected,
      role_quotas: adaptedQuotas,
      quota_satisfied_roles: quotaSatisfiedRoles,
      avg_pairwise_similarity_before: averagePairwiseSimilarity(baseline),
      avg_pairwise_similarity_after: averagePairwiseSimilarity(selected),
      objection_reply_presence_before: hasDiversityPresence(baselineRoleCounts, roles.diversityPair),
      objection_reply_presence_after: hasDiversityPresence(roleCountsSelected, roles.diversityPair),
      mono_perspective_before: isMonoPerspective(baselineRoleCounts, baseline.length, roleOrder),
      mono_perspective_after: isMonoPerspective(roleCountsSelected, selected.length, roleOrder),
      ...(kgStats ? { kg_balance: kgStats } : {}),
    },
  };
}
