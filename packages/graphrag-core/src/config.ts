/**
 * RetrievalConfig — the domain knobs the engine reads instead of hardcoding philosophy.
 *
 * Every field that used to be a literal in `retrieve-context.ts` / `seed-set-constructor.ts`
 * (claim-type taxonomy, relation edge priors, traversal tuning, verification policy, entity
 * enrichment, presentation prose) now lives here. `philosophyRetrievalConfig` reproduces SOPHIA's
 * exact prior behaviour, so omitting a config leaves retrieval byte-for-byte identical.
 *
 * The engine is domain-agnostic: a host can supply e.g. a legal config (holding/dicta claim types,
 * cites/overrules relations) and retrieval works without touching the package.
 */
import type { GraphStore, RetrievalOriginBalanceKey } from "./ports.js";
import {
  DEFAULT_SEED_ROLES,
  type SeedRoleConfig,
} from "./seed-set-constructor.js";
import {
  IDEAL_RETRIEVAL_ORIGIN_FRACTIONS,
  RETRIEVAL_ORIGIN_BALANCE_STRENGTH,
  RETRIEVAL_DOMAIN_BALANCE_STRENGTH,
} from "./kg-balance.js";

// ─── Entity enrichment (was thinker-context, now a generic hook) ────────────

export interface ThinkerSummary {
  wikidata_id: string;
  name: string;
  birth_year: number | null;
  death_year: number | null;
  traditions: string[];
}

export interface ThinkerContext {
  direct_authors: ThinkerSummary[];
  influences: ThinkerSummary[];
  teachers: ThinkerSummary[];
}

// ─── Config sub-shapes ──────────────────────────────────────────────────────

export interface ClaimTaxonomyConfig {
  /** Claim types treated as theses / conclusions (closure anchors). */
  thesisTypes: string[];
  /** Claim types treated as objections / counterarguments. */
  objectionTypes: string[];
  /** Claim types treated as replies / rebuttals. */
  replyTypes: string[];
  /** Fallback anchor types when thesis typing is sparse. */
  thesisFallbackTypes: string[];
  /** Normalise a raw claim_type before matching (default: trim + lowercase). */
  normalize?: (claimType: string) => string;
}

export interface RelationTraversalEdge {
  table: string;
  edgePrior: number;
}

export interface RelationFetchEdge {
  table: string;
  relationType: string;
}

export interface RelationsConfig {
  /** Edge tables walked during beam traversal, with per-edge priors. */
  traversalEdges: RelationTraversalEdge[];
  /** Edge tables resolved into inter-claim relations in the result set. */
  fetchEdges: RelationFetchEdge[];
  /** Edge used to find objections to a thesis during closure. */
  contradictionEdge: string;
  /** Edge used to find replies to an objection during closure. */
  replyEdge: string;
  /** Multipliers applied to traversal score by edge `strength`. */
  strengthWeights: { strong: number; weak: number; default: number };
}

export interface ArgumentsConfig {
  /** Edge linking claims to the argument they belong to. */
  membershipEdge: string;
  conclusionRole: string;
  keyPremiseRole: string;
  supportingPremiseRole: string;
  /** Lower rank = surfaced first when expanding argument neighbourhoods. */
  membershipRoleRank: Record<string, number>;
}

export interface TraversalConfig {
  /** Trace label for the traversal strategy. */
  mode: string;
  defaultMaxHops: (topK: number) => number;
  defaultClaimCap: (topK: number) => number;
  hopDecayFactor: number;
  baseConfidence: number;
  hopConfidence: {
    baseFloor: number;
    baseCeil: number;
    floor: number;
    ceil: number;
    perHopIncrement: number;
  };
  beam: {
    newPerHop: (topK: number) => number;
    width: (topK: number) => number;
    queryLimitPerTable: (topK: number) => number;
  };
  domainExpansionWeights: {
    sameTarget: number;
    offTarget: number;
    sameAnchor: number;
    offAnchor: number;
    neutral: number;
  };
  /** When true, traversal only follows `review_state = 'accepted'` edges. */
  trustedEdgesOnly: boolean;
}

export interface ClosureConfig {
  /** Enforce thesis → objection → reply closure units. */
  enabled: boolean;
  maxMajorTheses: (topK: number) => number;
}

export interface DomainConfig {
  /** When false, domain filtering / domain-aware expansion is neutralised. */
  enabled: boolean;
  /** Domain assigned to lexically-recovered (e.g. BM25) seed rows lacking one. */
  fallbackDomain: string;
  /** Claim type assigned to lexically-recovered seed rows lacking one. */
  fallbackClaimType: string;
}

export interface OriginBalanceConfig {
  enabled: boolean;
  idealFractions: Record<RetrievalOriginBalanceKey, number>;
  originStrength: number;
  domainStrength: number;
}

export interface LexicalConfig {
  corpusLevelSignals: string[];
  knownPhrases: string[];
}

/** Trust category a claim falls into, derived from its verification state. */
export type VerificationCategory = "supported" | "weak" | "unsupported";

export interface VerificationConfig {
  /**
   * Require `verification_state = 'validated'` for trusted-graph claims.
   * @deprecated Legacy env-driven flag. Use a per-query `verificationPolicy` instead.
   * When undefined the engine falls back to the `RETRIEVAL_REQUIRE_VERIFIED` env var.
   */
  requireVerified?: boolean;
  /** `verification_state` values that count as `supported` (high trust). */
  supportedStates: string[];
  /** `verification_state` values that count as `unsupported` (flagged / refuted). */
  flaggedStates: string[];
}

export interface EntityEnrichmentConfig {
  /** Fetch advisory entity context for the retrieved claim ids (or null to skip). */
  fetch: (store: GraphStore, claimIds: string[]) => Promise<ThinkerContext | null>;
  /** Render the fetched context into an LLM-ready block. */
  format: (ctx: ThinkerContext | null) => string;
}

export interface PresentationConfig {
  header: string;
  intro: string;
  footer: string;
  /** Annotate each claim in the context block with its verification status (default true). */
  annotateVerification: boolean;
}

export interface RetrievalConfig {
  claimTaxonomy: ClaimTaxonomyConfig;
  relations: RelationsConfig;
  arguments: ArgumentsConfig;
  seedRoles: SeedRoleConfig;
  traversal: TraversalConfig;
  closure: ClosureConfig;
  domain: DomainConfig;
  originBalance: OriginBalanceConfig;
  lexical: LexicalConfig;
  verification: VerificationConfig;
  /** Optional advisory enrichment (philosophy wires thinker/Wikidata lineage; legal omits it). */
  entityEnrichment?: EntityEnrichmentConfig;
  presentation: PresentationConfig;
}

// ─── Philosophy preset — reproduces SOPHIA's prior hardcoded behaviour ──────

function toThinkerSummary(node: unknown): ThinkerSummary | null {
  if (!node || typeof node !== "object") return null;
  const row = node as Record<string, unknown>;
  const wikidata_id = typeof row.wikidata_id === "string" ? row.wikidata_id : "";
  const name = typeof row.name === "string" ? row.name.trim() : "";
  if (!name) return null;
  return {
    wikidata_id,
    name,
    birth_year: typeof row.birth_year === "number" ? row.birth_year : null,
    death_year: typeof row.death_year === "number" ? row.death_year : null,
    traditions: Array.isArray(row.traditions)
      ? row.traditions.filter(
          (value): value is string => typeof value === "string" && value.trim().length > 0
        )
      : [],
  };
}

function capThinkerContext(context: ThinkerContext, maxNodes = 10): ThinkerContext {
  const seen = new Set<string>();
  const take = (items: ThinkerSummary[]): ThinkerSummary[] => {
    const result: ThinkerSummary[] = [];
    for (const item of items) {
      const key = item.wikidata_id || item.name.toLowerCase();
      if (seen.has(key)) continue;
      if (seen.size >= maxNodes) break;
      seen.add(key);
      result.push(item);
    }
    return result;
  };
  return {
    direct_authors: take(context.direct_authors),
    influences: take(context.influences),
    teachers: take(context.teachers),
  };
}

async function fetchThinkerContext(
  store: GraphStore,
  claimIds: string[]
): Promise<ThinkerContext | null> {
  if (!Array.isArray(claimIds) || claimIds.length === 0) return null;

  try {
    type ThinkerQueryResult = {
      direct_authors?: unknown[];
      influences?: unknown[];
      teachers?: unknown[];
    };

    const result = await store.query<ThinkerQueryResult[]>(
      `LET $source_ids = array::distinct((SELECT VALUE source FROM claim WHERE id INSIDE $claim_ids));
			 LET $author_rows = (SELECT <-authored<-thinker AS thinkers FROM $source_ids FETCH thinkers);
			 LET $direct_authors = array::flatten($author_rows.thinkers);
			 LET $influence_rows = (SELECT ->influenced_by->thinker AS thinkers FROM $direct_authors.id FETCH thinkers);
			 LET $teacher_rows = (SELECT ->student_of->thinker AS thinkers FROM $direct_authors.id FETCH thinkers);
			 RETURN {
			 	direct_authors: $direct_authors,
			 	influences: array::flatten($influence_rows.thinkers),
			 	teachers: array::flatten($teacher_rows.thinkers)
			 };`,
      { claim_ids: claimIds }
    );

    const row = Array.isArray(result) ? result[0] : null;
    if (!row) return null;

    const directAuthors = (row.direct_authors ?? [])
      .map((entry) => toThinkerSummary(entry))
      .filter((entry): entry is ThinkerSummary => entry !== null);
    const influences = (row.influences ?? [])
      .map((entry) => toThinkerSummary(entry))
      .filter((entry): entry is ThinkerSummary => entry !== null);
    const teachers = (row.teachers ?? [])
      .map((entry) => toThinkerSummary(entry))
      .filter((entry): entry is ThinkerSummary => entry !== null);

    if (directAuthors.length === 0 && influences.length === 0 && teachers.length === 0) {
      return null;
    }

    return capThinkerContext(
      {
        direct_authors: directAuthors,
        influences,
        teachers,
      },
      10
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const lower = message.toLowerCase();
    if (
      (lower.includes("authored") ||
        lower.includes("thinker") ||
        lower.includes("influenced_by") ||
        lower.includes("student_of")) &&
      (lower.includes("table") ||
        lower.includes("record") ||
        lower.includes("not found") ||
        lower.includes("does not exist") ||
        lower.includes("invalid"))
    ) {
      console.debug(
        "[RETRIEVAL] Thinker enrichment unavailable (missing thinker graph tables); returning null"
      );
      return null;
    }
    console.debug("[RETRIEVAL] Thinker enrichment failed; returning null:", message);
    return null;
  }
}

function formatThinkerDisplayName(thinker: ThinkerSummary): string {
  const years =
    thinker.birth_year === null && thinker.death_year === null
      ? ""
      : ` (${thinker.birth_year ?? "?"}-${thinker.death_year ?? "?"})`;
  const tradition = thinker.traditions.length > 0 ? `, ${thinker.traditions[0]}` : "";
  return `${thinker.name}${years}${tradition}`;
}

/** Render the philosophy lineage block (advisory Wikidata thinker context). */
export function formatThinkerContextBlock(context: ThinkerContext | null): string {
  if (!context) return "";

  const directAuthors = context.direct_authors.filter((thinker) => thinker.name.trim().length > 0);
  const influences = context.influences.filter((thinker) => thinker.name.trim().length > 0).slice(0, 5);
  const teachers = context.teachers.filter((thinker) => thinker.name.trim().length > 0);

  if (directAuthors.length === 0 && influences.length === 0 && teachers.length === 0) {
    return "";
  }

  const lines: string[] = [];
  lines.push("PHILOSOPHICAL LINEAGE CONTEXT (advisory — heuristic data from Wikidata)");
  lines.push("(sourced from Wikidata thinker graph — advisory context only)");
  lines.push("");

  if (directAuthors.length > 0) {
    lines.push(
      `Authors of retrieved sources: ${directAuthors.map((thinker) => formatThinkerDisplayName(thinker)).join(", ")}`
    );
  }
  if (influences.length > 0) {
    lines.push(`Influences in this lineage: ${influences.map((thinker) => formatThinkerDisplayName(thinker)).join(", ")}`);
  }
  if (teachers.length > 0) {
    lines.push(`Teachers in this lineage: ${teachers.map((thinker) => formatThinkerDisplayName(thinker)).join(", ")}`);
  }

  return lines.join("\n");
}

/**
 * SOPHIA's philosophy retrieval configuration. Used as the default when no config is supplied,
 * keeping retrieval byte-for-byte identical to the pre-extraction behaviour.
 */
export const philosophyRetrievalConfig: RetrievalConfig = {
  claimTaxonomy: {
    thesisTypes: ["thesis", "conclusion"],
    objectionTypes: ["objection", "counterargument", "counter_argument"],
    replyTypes: ["response", "reply", "rebuttal"],
    thesisFallbackTypes: ["premise", "support", "methodological"],
  },
  relations: {
    traversalEdges: [
      { table: "supports", edgePrior: 1.04 },
      { table: "contradicts", edgePrior: 1.16 },
      { table: "depends_on", edgePrior: 0.92 },
      { table: "responds_to", edgePrior: 1.2 },
      { table: "defines", edgePrior: 0.9 },
      { table: "qualifies", edgePrior: 0.88 },
      { table: "refines", edgePrior: 0.86 },
      { table: "exemplifies", edgePrior: 0.82 },
    ],
    fetchEdges: [
      { table: "supports", relationType: "supports" },
      { table: "contradicts", relationType: "contradicts" },
      { table: "depends_on", relationType: "depends_on" },
      { table: "responds_to", relationType: "responds_to" },
      { table: "defines", relationType: "defines" },
      { table: "qualifies", relationType: "qualifies" },
      { table: "refines", relationType: "qualifies" },
      { table: "exemplifies", relationType: "supports" },
    ],
    contradictionEdge: "contradicts",
    replyEdge: "responds_to",
    strengthWeights: { strong: 1.08, weak: 0.86, default: 1 },
  },
  arguments: {
    membershipEdge: "part_of",
    conclusionRole: "conclusion",
    keyPremiseRole: "key_premise",
    supportingPremiseRole: "supporting_premise",
    membershipRoleRank: { conclusion: 0, key_premise: 1, supporting_premise: 2 },
  },
  seedRoles: DEFAULT_SEED_ROLES,
  traversal: {
    mode: "beam_trusted_v1",
    defaultMaxHops: (topK) => (topK >= 10 ? 3 : topK <= 3 ? 1 : 2),
    defaultClaimCap: (topK) => (topK >= 10 ? 120 : topK <= 3 ? 32 : 72),
    hopDecayFactor: 0.78,
    baseConfidence: 0.38,
    hopConfidence: { baseFloor: 0.2, baseCeil: 0.85, floor: 0.2, ceil: 0.9, perHopIncrement: 0.08 },
    beam: {
      newPerHop: (topK) => (topK >= 10 ? 48 : topK <= 3 ? 12 : 28),
      width: (topK) => (topK >= 10 ? 44 : topK <= 3 ? 10 : 24),
      queryLimitPerTable: (topK) => (topK >= 10 ? 260 : topK <= 3 ? 64 : 140),
    },
    domainExpansionWeights: {
      sameTarget: 1.05,
      offTarget: 0.72,
      sameAnchor: 1.0,
      offAnchor: 0.84,
      neutral: 0.92,
    },
    trustedEdgesOnly: true,
  },
  closure: {
    enabled: true,
    maxMajorTheses: (topK) => Math.max(1, Math.min(3, Math.ceil(topK / 4))),
  },
  domain: {
    enabled: true,
    fallbackDomain: "ethics",
    fallbackClaimType: "premise",
  },
  originBalance: {
    enabled: true,
    idealFractions: IDEAL_RETRIEVAL_ORIGIN_FRACTIONS,
    originStrength: RETRIEVAL_ORIGIN_BALANCE_STRENGTH,
    domainStrength: RETRIEVAL_DOMAIN_BALANCE_STRENGTH,
  },
  lexical: {
    corpusLevelSignals: [
      "across philosophy",
      "across traditions",
      "across thinkers",
      "historical development",
      "main positions",
      "overview",
      "survey",
      "big picture",
      "in general",
    ],
    knownPhrases: ["public reason", "epistemic injustice", "non-identity problem"],
  },
  verification: {
    supportedStates: ["validated"],
    flaggedStates: ["flagged"],
  },
  entityEnrichment: {
    fetch: fetchThinkerContext,
    format: formatThinkerContextBlock,
  },
  presentation: {
    header: "=== PHILOSOPHICAL KNOWLEDGE GRAPH CONTEXT ===",
    intro:
      "The following are structured claims from SOPHIA's curated philosophical knowledge graph. " +
      "Use these as your philosophical foundation, noting their typed logical relations and source attributions.",
    footer: "Use Google Search to verify, challenge, or extend these claims with current sources.",
    annotateVerification: true,
  },
};
