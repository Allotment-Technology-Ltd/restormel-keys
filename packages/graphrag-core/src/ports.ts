/**
 * Injected graph read port — Surreal (or other) implementations live in the host app.
 */
export interface GraphStore {
  query<T>(sql: string, vars?: Record<string, unknown>): Promise<T>;
  isDatabaseUnavailable(error: unknown): boolean;
}

export interface EmbeddingPort {
  embedQuery(text: string): Promise<number[]>;
}

export type RetrievalOriginBalanceKey = "sep" | "gutenberg" | "other";

/** Host resolves corpus origin bucket (SOPHIA uses ingestRuns URL heuristics). */
export type OriginBucketResolver = (
  url: string | null | undefined,
  storedSourceType?: string | null
) => RetrievalOriginBalanceKey;

export interface GraphRagDeps {
  store: GraphStore;
  embedder: EmbeddingPort;
  resolveOriginBucket: OriginBucketResolver;
}
