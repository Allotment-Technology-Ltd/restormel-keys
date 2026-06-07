/**
 * Cypher DDL for Restormel's graph schema in Neo4j 5.x.
 *
 * Restormel models claims as `:Claim` nodes carrying a vector `embedding`, a
 * full-text-searchable `text`, and verification metadata. Relationships use the
 * domain pack's edge types (e.g. SUPPORTS, CONTRADICTS) between claims.
 *
 * The adapter runs these statements in `ensureSchema()`. All are idempotent
 * (`IF NOT EXISTS`) so re-running is safe.
 */
import type { DomainPackSchema } from "../GraphStoreAdapter.js";

/** Canonical node label for claims. */
export const CLAIM_LABEL = "Claim";

/** Index names — referenced by the adapter's vector/fulltext queries. */
export const NEO4J_INDEX_NAMES = {
  claimId: "claim_id",
  vector: "claim_embedding",
  fulltext: "claim_fulltext",
} as const;

/** Default embedding width when the domain pack does not declare one (OpenAI text-embedding-3-small). */
export const DEFAULT_EMBEDDING_DIMENSIONS = 1536;

export interface Neo4jSchemaOptions {
  /** Node label (defaults to "Claim"). */
  nodeLabel?: string;
  /** Vector width for the HNSW index. */
  embeddingDimensions?: number;
  /** "cosine" | "euclidean" — Restormel uses cosine. */
  similarityFunction?: "cosine" | "euclidean";
}

/** Backtick-escape a Cypher identifier (label / property / index name). */
export function escapeCypherIdentifier(name: string): string {
  return `\`${name.replace(/`/g, "``")}\``;
}

/**
 * Build the idempotent Cypher DDL statements that prepare a Neo4j database for
 * Restormel ingestion + retrieval:
 *  1. uniqueness constraint on Claim.id
 *  2. HNSW vector index on Claim.embedding (Neo4j 5.x `CREATE VECTOR INDEX`)
 *  3. full-text index on Claim.text (for searchByText)
 */
export function buildNeo4jSchemaStatements(
  domainPack?: DomainPackSchema,
  options: Neo4jSchemaOptions = {},
): string[] {
  const label = options.nodeLabel ?? CLAIM_LABEL;
  const escapedLabel = escapeCypherIdentifier(label);
  const dimensions =
    options.embeddingDimensions ?? domainPack?.embeddingDimensions ?? DEFAULT_EMBEDDING_DIMENSIONS;
  const similarity = options.similarityFunction ?? "cosine";

  return [
    `CREATE CONSTRAINT ${NEO4J_INDEX_NAMES.claimId} IF NOT EXISTS ` +
      `FOR (c:${escapedLabel}) REQUIRE c.id IS UNIQUE`,
    `CREATE VECTOR INDEX ${NEO4J_INDEX_NAMES.vector} IF NOT EXISTS ` +
      `FOR (c:${escapedLabel}) ON (c.embedding) ` +
      `OPTIONS { indexConfig: { ` +
      `\`vector.dimensions\`: ${dimensions}, ` +
      `\`vector.similarity_function\`: '${similarity}' } }`,
    `CREATE FULLTEXT INDEX ${NEO4J_INDEX_NAMES.fulltext} IF NOT EXISTS ` +
      `FOR (c:${escapedLabel}) ON EACH [c.text]`,
  ];
}
