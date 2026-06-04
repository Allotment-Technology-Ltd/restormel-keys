import type { GraphStore } from "./ports.js";

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
  }
): Promise<Array<{ id: string; text: string; confidence: number }>> {
  if (params.terms.length === 0) return [];
  const searchQuery = params.terms.slice(0, 8).join(" ");
  try {
    const rows = await store.query<Array<{ id: string; text: string; confidence: number }>>(
      `SELECT id, text, confidence FROM claim
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
  }
): Promise<string[]> {
  if (!isRetrievalNativeGraphEnabled() || params.seedIds.length === 0) return [];
  try {
    const rows = await store.query<Array<{ neighbors?: Array<{ id?: string }> }>>(
      `SELECT array::distinct(
				array::flatten([
					->depends_on->claim,
					->supports->claim,
					<-contradicts<-claim,
					->responds_to->claim
				])
			) AS neighbors
			FROM claim
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

export async function ensureClaimSearchIndex(db: { query: (sql: string) => Promise<unknown> }): Promise<void> {
  if (!isRetrievalBm25Enabled()) return;
  await db.query(`
		DEFINE ANALYZER IF NOT EXISTS claim_english TOKENIZERS blank,class FILTERS lowercase,ascii;
		DEFINE INDEX IF NOT EXISTS claim_search ON claim FIELDS text SEARCH ANALYZER claim_english BM25;
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
  }
): Promise<string[]> {
  if (!isRetrievalPassageGroundedEnabled()) return [];
  try {
    const rows = await store.query<Array<{ claim_ids?: string[] }>>(
      `SELECT array::distinct(array::flatten(<-grounded_in<-claim.id)) AS claim_ids
			 FROM (
				SELECT id FROM passage
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
  }
): Promise<string[]> {
  if (!isRetrievalTaxonomyRoutingEnabled() || params.terms.length === 0) return [];
  const needles = params.terms.slice(0, 6).map((t) => t.toLowerCase());
  try {
    const rows = await store.query<Array<{ id?: string }>>(
      `SELECT id FROM claim
			 WHERE ${params.reviewFilter}
			 AND (
				id IN (
					SELECT VALUE in FROM about_subject
					WHERE out.name ~ $needle OR out.slug ~ $needle
				)
				OR id IN (
					SELECT VALUE in FROM authored
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

export async function ensurePassageEmbeddingIndex(db: { query: (sql: string) => Promise<unknown> }): Promise<void> {
  if (!isRetrievalPassageGroundedEnabled()) return;
  await db.query(`
		DEFINE INDEX IF NOT EXISTS passage_embedding ON passage FIELDS embedding HNSW DIMENSION 768 DIST COSINE;
	`);
}

export async function ensureClaimAcceptPassageEvent(db: { query: (sql: string) => Promise<unknown> }): Promise<void> {
  if (!isKgEnforcePassageOnAcceptEnabled()) return;
  await db.query(`
		DEFINE EVENT IF NOT EXISTS claim_accept_requires_passage ON claim
		WHEN $event = 'CREATE' OR $event = 'UPDATE'
		THEN {
			IF $after.review_state = 'accepted' AND count(<-grounded_in<-passage WHERE in = $after.id) = 0 {
				THROW 'accepted claims must link to at least one passage';
			};
		};
	`);
}
