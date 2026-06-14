import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fetchBm25ClaimCandidates,
  fetchNativeGraphNeighbors,
  ensurePassageEmbeddingIndex,
  DEFAULT_PASSAGE_EMBEDDING_DIMENSIONS,
  type GraphStore,
} from "../index.js";

/** Captures the SQL a single store.query receives. */
function recordingStore(rows: unknown[] = []): { store: GraphStore; sql: () => string } {
  let captured = "";
  const store: GraphStore = {
    async query<T>(sql: string): Promise<T> {
      captured = sql;
      return rows as unknown as T;
    },
    isDatabaseUnavailable() {
      return false;
    },
  };
  return { store, sql: () => captured };
}

/** Captures the SQL a single db.query receives (for DDL-emitting helpers). */
function recordingDb(): { db: { query: (sql: string) => Promise<unknown> }; sql: () => string } {
  let captured = "";
  const db = {
    async query(sql: string): Promise<unknown> {
      captured = sql;
      return undefined;
    },
  };
  return { db, sql: () => captured };
}

describe("surreal-retrieval-enhancements parameterization", () => {
  const prev = process.env.RETRIEVAL_NATIVE_GRAPH;
  afterEach(() => {
    process.env.RETRIEVAL_NATIVE_GRAPH = prev;
    vi.restoreAllMocks();
  });

  it("BM25 candidate fetch targets the configured unit table", async () => {
    const { store, sql } = recordingStore([]);
    await fetchBm25ClaimCandidates(store, {
      terms: ["epistemic"],
      limit: 10,
      reviewFilter: "review_state = 'accepted'",
      unitTable: "statement_v2",
    });
    expect(sql()).toContain("FROM statement_v2");
    expect(sql()).not.toContain("FROM claim");
  });

  it("native graph neighbours traverse the configured edges + unit table", async () => {
    process.env.RETRIEVAL_NATIVE_GRAPH = "1";
    const { store, sql } = recordingStore([]);
    await fetchNativeGraphNeighbors(store, {
      seedIds: ["statement_v2:1"],
      limit: 16,
      unitTable: "statement_v2",
      relationEdges: ["cites", "overrules"],
    });
    const q = sql();
    expect(q).toContain("FROM statement_v2");
    expect(q).toContain("->cites->statement_v2");
    expect(q).toContain("<-overrules<-statement_v2");
    expect(q).not.toContain("->depends_on->claim");
  });
});

describe("ensurePassageEmbeddingIndex dimension parameterization", () => {
  const prevFlag = process.env.RETRIEVAL_PASSAGE_GROUNDED;

  afterEach(() => {
    if (prevFlag === undefined) {
      delete process.env.RETRIEVAL_PASSAGE_GROUNDED;
    } else {
      process.env.RETRIEVAL_PASSAGE_GROUNDED = prevFlag;
    }
    vi.restoreAllMocks();
  });

  it("emits DDL with the explicitly supplied dimension", async () => {
    process.env.RETRIEVAL_PASSAGE_GROUNDED = "1";
    const { db, sql } = recordingDb();
    await ensurePassageEmbeddingIndex(db, { dimensions: 1536 });
    expect(sql()).toContain("DIMENSION 1536");
    expect(sql()).not.toContain("DIMENSION 768");
  });

  it("falls back to DEFAULT_PASSAGE_EMBEDDING_DIMENSIONS (1024) when omitted", async () => {
    process.env.RETRIEVAL_PASSAGE_GROUNDED = "1";
    const { db, sql } = recordingDb();
    await ensurePassageEmbeddingIndex(db);
    expect(sql()).toContain(`DIMENSION ${DEFAULT_PASSAGE_EMBEDDING_DIMENSIONS}`);
    expect(sql()).toContain("DIMENSION 1024");
    expect(sql()).not.toContain("DIMENSION 768");
  });

  it("uses the configured passage table name in the DDL", async () => {
    process.env.RETRIEVAL_PASSAGE_GROUNDED = "1";
    const { db, sql } = recordingDb();
    await ensurePassageEmbeddingIndex(db, { passageTable: "chunk", dimensions: 256 });
    expect(sql()).toContain("chunk_embedding");
    expect(sql()).toContain("ON chunk");
    expect(sql()).toContain("DIMENSION 256");
  });

  it("emits no DDL when feature flag is off", async () => {
    delete process.env.RETRIEVAL_PASSAGE_GROUNDED;
    const { db, sql } = recordingDb();
    await ensurePassageEmbeddingIndex(db, { dimensions: 1024 });
    // query should not have been called
    expect(sql()).toBe("");
  });
});
