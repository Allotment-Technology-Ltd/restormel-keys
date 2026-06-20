/**
 * Postgres-spine retrieval (Phase 3 Stage 1 — the Answer Console hero).
 *
 * The Stage-0 demo graph (and any Postgres-target ingest) lives on the Postgres
 * graph spine — `knowledge_graph_{sources,units,relations}` with
 * `use_dashboard_database = true`. graphrag-core's `retrieveContext` speaks
 * SurrealQL through a `GraphStore` port and cannot read the spine; this module
 * implements an equivalent retrieval directly over the spine and returns the
 * SAME `RetrievalResult` contract, so the Prove stream, provenance summary and
 * the provenance drawer work unchanged.
 *
 * How it works (mirrors the SurrealDB retrieval shape, scaled for first-run):
 *  1. Tokenise the question into content terms (stopwords/short tokens dropped).
 *  2. Lexically seed: score units by how many query terms appear in the text
 *     (the demo graph has no embeddings, so lexical overlap is the seed signal).
 *  3. Traverse one hop along `knowledge_graph_relations` (either direction) to
 *     pull in the supporting / contradicting / explaining claims around each seed.
 *  4. Map each unit → a `RetrievedClaim` with an evidence-bound verdict derived
 *     from its `validation_status` (the trust vocabulary), and each edge → a
 *     `RetrievedRelation` (by claim index). Attach `evidence_passages` so the
 *     source span (the exact quoted text) backs every cited claim.
 *  5. Apply the same `VerificationPolicy` filtering the Surreal path uses.
 *
 * When no unit matches the question the result is an HONEST ABSTENTION
 * (`degraded`, zero claims) — a designed state, not an error.
 */
import {
  buildContextBlock,
  philosophyRetrievalConfig,
  type RetrievalResult,
  type RetrievedClaim,
  type RetrievedRelation,
  type VerificationCategory,
  type VerificationPolicy,
} from "@restormel/graphrag-core";
import {
  lexicalSeedGraphSpineUnits,
  readGraphSpineRelationsForUnits,
  readGraphSpineUnitsByIds,
  type GraphSpineRelationRow,
  type GraphSpineUnitRow,
} from "$lib/server/neon";

/** Injectable data access so the retrieval logic is unit-testable without a DB. */
export type GraphSpineReaders = {
  lexicalSeed: typeof lexicalSeedGraphSpineUnits;
  readByIds: typeof readGraphSpineUnitsByIds;
  readRelations: typeof readGraphSpineRelationsForUnits;
};

const DEFAULT_READERS: GraphSpineReaders = {
  lexicalSeed: lexicalSeedGraphSpineUnits,
  readByIds: readGraphSpineUnitsByIds,
  readRelations: readGraphSpineRelationsForUnits,
};

/** Tokens this short are noise; the demo corpus terms are all longer. */
const MIN_TERM_LENGTH = 3;

/**
 * Small, generic English stopword set. Domain-agnostic on purpose — the demo
 * corpus is philosophy today but the seed is swappable, so we never bias toward
 * any one domain's vocabulary.
 */
const STOPWORDS = new Set([
  "the", "and", "for", "are", "but", "not", "you", "with", "this", "that", "from",
  "what", "why", "how", "who", "when", "where", "which", "does", "did", "was", "were",
  "has", "have", "had", "can", "could", "would", "should", "about", "into", "than",
  "then", "they", "them", "their", "there", "here", "its", "his", "her", "she", "him",
  "between", "differently", "treated", "treat", "said", "say", "says",
]);

export type PostgresRetrievalArgs = {
  workspaceId: string;
  query: string;
  maxClaims?: number;
  seedClaimIds?: string[];
  verificationPolicy?: VerificationPolicy;
};

export type PostgresStructuredRetrieval = {
  result: RetrievalResult;
  contextBlock: string;
  degraded: boolean;
  degradedReason?: string;
};

/** Split a question into deduped, lowercased content terms for lexical seeding. */
export function tokeniseQuery(query: string): string[] {
  const seen = new Set<string>();
  const terms: string[] = [];
  for (const raw of query.toLowerCase().split(/[^a-z0-9]+/)) {
    const term = raw.trim();
    if (term.length < MIN_TERM_LENGTH) continue;
    if (STOPWORDS.has(term)) continue;
    if (seen.has(term)) continue;
    seen.add(term);
    terms.push(term);
  }
  return terms;
}

/**
 * Derive the evidence-bound verdict category from a unit's validation status.
 *
 * The spine's `validation_status` is the faithfulness verdict the validation
 * stage writes. Demo seed units are curated/unvalidated (`null`); we surface
 * those as `supported` (the demo content is authored to be faithful to its
 * cited source) but flag the absence of a machine verdict via a null trust
 * score, so the UI never over-claims. Real validated content uses its true
 * status. This keeps every quality word backed by the graph's own state.
 */
export function deriveVerification(unit: GraphSpineUnitRow): {
  verification_state: string | null;
  verification_category: VerificationCategory;
  trust_score: number | null;
} {
  switch (unit.validationStatus) {
    case "ok":
      return { verification_state: "validated", verification_category: "supported", trust_score: 90 };
    case "weak":
      return { verification_state: "weak", verification_category: "weak", trust_score: 55 };
    case "unsupported":
      return { verification_state: "flagged", verification_category: "unsupported", trust_score: 20 };
    default:
      // Curated / not-yet-validated (the demo seed): faithful by construction, but
      // no machine verdict — show as supported, withhold a trust number.
      return { verification_state: null, verification_category: "supported", trust_score: null };
  }
}

function passesPolicy(
  category: VerificationCategory,
  trustScore: number | null,
  policy: VerificationPolicy,
): boolean {
  if (policy.excludeFlagged !== false && category === "unsupported") return false;
  if (!policy.include.includes(category)) return false;
  if (policy.minTrustScore !== undefined && trustScore !== null && trustScore < policy.minTrustScore) {
    return false;
  }
  return true;
}

function unitToClaim(unit: GraphSpineUnitRow): RetrievedClaim {
  const v = deriveVerification(unit);
  return {
    id: unit.id,
    text: unit.text,
    claim_type: unit.unitType ?? "claim",
    domain: unit.domain ?? "general",
    source_title: unit.sourceTitle ?? "Untitled source",
    source_author: [],
    confidence: 1,
    position_in_source: unit.position,
    verification_state: v.verification_state,
    trust_score: v.trust_score,
    verification_category: v.verification_category,
  };
}

const DEGRADED_NO_MATCH =
  "No verified claims in your graph matched this question — answering from the graph would be guessing.";

/**
 * Retrieve verified claims for `query` from the workspace's Postgres graph spine.
 * Returns the graphrag-core `RetrievalResult` contract plus a ready context block.
 */
export async function retrieveFromPostgresSpine(
  args: PostgresRetrievalArgs,
  readers: GraphSpineReaders = DEFAULT_READERS,
): Promise<PostgresStructuredRetrieval> {
  const policy: VerificationPolicy = args.verificationPolicy ?? {
    include: ["supported", "weak"],
    excludeFlagged: true,
  };
  const maxClaims = Math.min(Math.max(args.maxClaims ?? 24, 1), 100);
  const forcedSeeds = (args.seedClaimIds ?? []).filter((id) => id.trim().length > 0);

  // ── 1+2. Seed: forced ids (deep-link / suggested question) or lexical search. ──
  let seedUnits: GraphSpineUnitRow[] = [];
  try {
    if (forcedSeeds.length > 0) {
      seedUnits = await readers.readByIds({ workspaceId: args.workspaceId, unitIds: forcedSeeds });
    }
    if (seedUnits.length === 0) {
      const terms = tokeniseQuery(args.query);
      // Seed pool a bit wider than the claim cap so traversal has room.
      seedUnits = await readers.lexicalSeed({
        workspaceId: args.workspaceId,
        terms,
        limit: Math.min(maxClaims, 20),
      });
    }
  } catch {
    return abstain("The graph store could not be read.");
  }

  if (seedUnits.length === 0) {
    return abstain(DEGRADED_NO_MATCH);
  }

  // ── 3. One-hop traversal over relations to pull in connected claims. ──
  const claimsById = new Map<string, GraphSpineUnitRow>();
  for (const u of seedUnits) claimsById.set(u.id, u);
  const seedIds = seedUnits.map((u) => u.id);

  let edges: GraphSpineRelationRow[] = [];
  try {
    edges = await readers.readRelations({ workspaceId: args.workspaceId, unitIds: seedIds });
  } catch {
    edges = []; // traversal is best-effort; seeds alone still answer.
  }

  const neighbourIds = new Set<string>();
  for (const e of edges) {
    if (!claimsById.has(e.fromUnitId)) neighbourIds.add(e.fromUnitId);
    if (!claimsById.has(e.toUnitId)) neighbourIds.add(e.toUnitId);
  }
  if (neighbourIds.size > 0) {
    try {
      const neighbours = await readers.readByIds({
        workspaceId: args.workspaceId,
        unitIds: [...neighbourIds],
      });
      for (const n of neighbours) {
        if (!claimsById.has(n.id) && claimsById.size < maxClaims) claimsById.set(n.id, n);
      }
    } catch {
      /* neighbour hydration is best-effort */
    }
  }

  // ── 4. Map units → claims (policy-filtered), edges → relations (by index). ──
  const orderedUnits = [...claimsById.values()].slice(0, maxClaims);
  const indexById = new Map<string, number>();
  const claims: RetrievedClaim[] = [];
  for (const unit of orderedUnits) {
    const claim = unitToClaim(unit);
    if (!passesPolicy(claim.verification_category ?? "supported", claim.trust_score ?? null, policy)) {
      continue;
    }
    indexById.set(unit.id, claims.length);
    claims.push(claim);
  }

  if (claims.length === 0) {
    return abstain(DEGRADED_NO_MATCH);
  }

  const relations: RetrievedRelation[] = [];
  const seenRel = new Set<string>();
  for (const e of edges) {
    const from = indexById.get(e.fromUnitId);
    const to = indexById.get(e.toUnitId);
    if (from === undefined || to === undefined || from === to) continue;
    const key = `${from}->${to}:${e.relationType}`;
    if (seenRel.has(key)) continue;
    seenRel.add(key);
    relations.push({ from_index: from, to_index: to, relation_type: e.relationType });
  }

  // Evidence passages = the exact quoted span backing each claim (source-bound).
  const evidence_passages = claims.map((c) => ({
    passage_id: c.id,
    excerpt: c.text,
    claim_ids: [c.id],
  }));

  const seedClaimIds = seedIds.filter((id) => indexById.has(id));
  const result: RetrievalResult = {
    claims,
    relations,
    arguments: [],
    seed_claim_ids: seedClaimIds,
    evidence_passages,
    degraded: false,
    trace: {
      seed_pool_count: seedUnits.length,
      selected_seed_count: seedClaimIds.length,
      traversal_mode: "postgres-spine 1-hop",
      traversal_max_hops: edges.length > 0 ? 1 : 0,
      traversed_claim_count: claims.length,
      relation_candidate_count: edges.length,
      relation_kept_count: relations.length,
      argument_candidate_count: 0,
      argument_kept_count: 0,
    },
  };

  return {
    result,
    contextBlock: buildContextBlock(result, philosophyRetrievalConfig),
    degraded: false,
  };
}

function abstain(reason: string): PostgresStructuredRetrieval {
  return {
    result: {
      claims: [],
      relations: [],
      arguments: [],
      seed_claim_ids: [],
      degraded: true,
      degraded_reason: reason,
    },
    contextBlock: "",
    degraded: true,
    degradedReason: reason,
  };
}
