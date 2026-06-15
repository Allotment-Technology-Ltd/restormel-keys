import type { GraphStore } from "./ports.js";

const DEFAULT_UNIT_TABLE = "claim";
const DEFAULT_PASSAGE_TABLE = "passage";
const DEFAULT_GROUNDED_IN_EDGE = "grounded_in";

/**
 * Default vector dimension for the Surreal HNSW passage-embedding index.
 *
 * 1024 matches the domain-pack default (voyage-3 / voyage-3-large at their
 * native width, and the Together-gateway embedding model). The Neo4j adapter
 * uses DEFAULT_EMBEDDING_DIMENSIONS = 1536 (OpenAI text-embedding-3-small);
 * that constant is NOT reused here because OpenAI is not the primary embedding
 * provider for the Surreal path and conflating the two would misrepresent both.
 *
 * NOTE: HNSW DDL uses `IF NOT EXISTS`, so indexes created with the old
 * hardcoded 768 are NOT altered — they stay at 768 until you drop and recreate
 * the index after re-embedding (see the re-embed roadmap item).  Do NOT
 * attempt dimension migration here.
 */
export const DEFAULT_PASSAGE_EMBEDDING_DIMENSIONS = 1024;

export function isRetrievalBm25Enabled(): boolean {
  const v = (process.env.RETRIEVAL_USE_BM25 ?? "").trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

export function isRetrievalNativeGraphEnabled(): boolean {
  const v = (process.env.RETRIEVAL_NATIVE_GRAPH ?? "").trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

export async function fetchBm25ClaimCandidates(
  store: GraphStore,
  params: {
    terms: string[];
    limit: number;
    reviewFilter: string;
    /** Unit table name (default `claim`). */
    unitTable?: string;
  }
): Promise<Array<{ id: string; text: string; confidence: number }>> {
  if (params.terms.length === 0) return [];
  const unitTable = params.unitTable ?? DEFAULT_UNIT_TABLE;
  const searchQuery = params.terms.slice(0, 8).join(" ");
  try {
    const rows = await store.query<Array<{ id: string; text: string; confidence: number }>>(
      `SELECT id, text, confidence FROM ${unitTable}
        WHERE text @@ $q AND ${params.reviewFilter}
        ORDER BY confidence DESC
        LIMIT $limit`,
      { q: searchQuery, limit: params.limit }
    );
    return rows ?? [];
  } catch {
    return [];
  }
}

export async function fetchNativeGraphNeighbors(
  store: GraphStore,
  params: {
    seedIds: string[];
    limit: number;
    /** Unit table name (default `claim`). */
    unitTable?: string;
    /** Relation edge tables to traverse in both directions (default supports/contradicts/depends_on/responds_to). */
    relationEdges?: string[];
  }
): Promise<string[]> {
  if (!isRetrievalNativeGraphEnabled() || params.seedIds.length === 0) return [];
  const unitTable = params.unitTable ?? DEFAULT_UNIT_TABLE;
  const edges =
    params.relationEdges && params.relationEdges.length > 0
      ? params.relationEdges
      : ["depends_on", "supports", "contradicts", "responds_to"];
  const traversals = edges
    .flatMap((edge) => [`->${edge}->${unitTable}`, `<-${edge}<-${unitTable}`])
    .join(", ");
  try {
    const rows = await store.query<Array<{ neighbors?: Array<{ id?: string }> }>>(
      `SELECT array::distinct(array::flatten([${traversals}])) AS neighbors
        FROM ${unitTable}
        WHERE id INSIDE $seed_ids
        LIMIT $limit`,
      { seed_ids: params.seedIds, limit: params.limit }
    );
    const out = new Set<string>();
    for (const row of rows ?? []) {
      for (const n of row.neighbors ?? []) {
        if (typeof n?.id === "string") out.add(n.id);
      }
    }
    return [...out];
  } catch {
    return [];
  }
}

export async function ensureClaimSearchIndex(
  db: { query: (sql: string) => Promise<unknown> },
  opts?: { unitTable?: string }
): Promise<void> {
  if (!isRetrievalBm25Enabled()) return;
  const unitTable = opts?.unitTable ?? DEFAULT_UNIT_TABLE;
  await db.query(`
    DEFINE ANALYZER IF NOT EXISTS ${unitTable}_english TOKENIZERS blank,class FILTERS lowercase,ascii;
    DEFINE INDEX IF NOT EXISTS ${unitTable}_search ON ${unitTable} FIELDS text SEARCH ANALYZER ${unitTable}_english BM25;
  `);
}

export function isRetrievalPassageGroundedEnabled(): boolean {
  const v = (process.env.RETRIEVAL_PASSAGE_GROUNDED ?? "").trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

export function isRetrievalTaxonomyRoutingEnabled(): boolean {
  const v = (process.env.RETRIEVAL_TAXONOMY_ROUTING ?? "").trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

export function isKgEnforcePassageOnAcceptEnabled(): boolean {
  const v = (process.env.KG_ENFORCE_PASSAGE_ON_ACCEPT ?? "").trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

export async function fetchPassageGroundedClaimIds(
  store: GraphStore,
  params: {
    queryEmbedding: number[];
    limit: number;
    reviewFilter: string;
    /** Unit table name (default `claim`). */
    unitTable?: string;
    /** Passage table name (default `passage`). */
    passageTable?: string;
    /** Passage→unit grounding edge (default `grounded_in`). */
    groundedInEdge?: string;
  }
): Promise<string[]> {
  if (!isRetrievalPassageGroundedEnabled()) return [];
  const unitTable = params.unitTable ?? DEFAULT_UNIT_TABLE;
  const passageTable = params.passageTable ?? DEFAULT_PASSAGE_TABLE;
  const groundedInEdge = params.groundedInEdge ?? DEFAULT_GROUNDED_IN_EDGE;
  try {
    const rows = await store.query<Array<{ claim_ids?: string[] }>>(
      `SELECT array::distinct(array::flatten(<-${groundedInEdge}<-${unitTable}.id)) AS claim_ids
        FROM (
          SELECT id FROM ${passageTable}
          WHERE embedding <|$limit,64|> $query_embedding
          LIMIT $limit
        )
        WHERE claim_ids != NONE`,
      { query_embedding: params.queryEmbedding, limit: params.limit }
    );
    const out = new Set<string>();
    for (const row of rows ?? []) {
      for (const id of row.claim_ids ?? []) {
        if (typeof id === "string") out.add(id);
      }
    }
    return [...out].slice(0, params.limit);
  } catch {
    return [];
  }
}

export async function fetchTaxonomySeedClaimIds(
  store: GraphStore,
  params: {
    terms: string[];
    limit: number;
    reviewFilter: string;
    /** Unit table name (default `claim`). */
    unitTable?: string;
    /** Taxonomy subject edge (default `about_subject`). */
    subjectEdge?: string;
    /** Author/entity edge (default `authored`). */
    authorEdge?: string;
  }
): Promise<string[]> {
  if (!isRetrievalTaxonomyRoutingEnabled() || params.terms.length === 0) return [];
  const unitTable = params.unitTable ?? DEFAULT_UNIT_TABLE;
  const subjectEdge = params.subjectEdge ?? "about_subject";
  const authorEdge = params.authorEdge ?? "authored";
  const needles = params.terms.slice(0, 6).map((t) => t.toLowerCase());
  try {
    const rows = await store.query<Array<{ id?: string }>>(
      `SELECT id FROM ${unitTable}
        WHERE ${params.reviewFilter}
        AND (
          id IN (
            SELECT VALUE in FROM ${subjectEdge}
            WHERE out.name ~ $needle OR out.slug ~ $needle
          )
          OR id IN (
            SELECT VALUE in FROM ${authorEdge}
            WHERE out.name ~ $needle OR out.canonical_name ~ $needle
          )
        )
        LIMIT $limit`,
      { needle: needles[0], limit: params.limit }
    );
    return (rows ?? []).map((r) => String(r.id)).filter(Boolean);
  } catch {
    return [];
  }
}

export async function ensurePassageEmbeddingIndex(
  db: { query: (sql: string) => Promise<unknown> },
  opts?: { passageTable?: string; dimensions?: number }
): Promise<void> {
  if (!isRetrievalPassageGroundedEnabled()) return;
  const passageTable = opts?.passageTable ?? DEFAULT_PASSAGE_TABLE;
  const dimensions = opts?.dimensions ?? DEFAULT_PASSAGE_EMBEDDING_DIMENSIONS;
  await db.query(`
    DEFINE INDEX IF NOT EXISTS ${passageTable}_embedding ON ${passageTable} FIELDS embedding HNSW DIMENSION ${dimensions} DIST COSINE;
  `);
}

export async function ensureClaimAcceptPassageEvent(
  db: { query: (sql: string) => Promise<unknown> },
  opts?: { unitTable?: string; passageTable?: string; groundedInEdge?: string }
): Promise<void> {
  if (!isKgEnforcePassageOnAcceptEnabled()) return;
  const unitTable = opts?.unitTable ?? DEFAULT_UNIT_TABLE;
  const passageTable = opts?.passageTable ?? DEFAULT_PASSAGE_TABLE;
  const groundedInEdge = opts?.groundedInEdge ?? DEFAULT_GROUNDED_IN_EDGE;
  await db.query(`
    DEFINE EVENT IF NOT EXISTS ${unitTable}_accept_requires_passage ON ${unitTable}
    WHEN $event = 'CREATE' OR $event = 'UPDATE'
    THEN {
      IF $after.review_state = 'accepted' AND count(<-${groundedInEdge}<-${passageTable} WHERE in = $after.id) = 0 {
        THROW 'accepted ${unitTable}s must link to at least one ${passageTable}';
      };
    };
  `);
}
